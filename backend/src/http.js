// Utilitários HTTP: roteador simples, leitura de JSON e entrega dos arquivos do front-end.
const fs = require('node:fs');
const path = require('node:path');
const { ErroNegocio } = require('./errors');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

function criarRoteador() {
  const rotas = [];
  return {
    adicionar(metodo, caminho, opcoes, handler) {
      const nomes = [];
      const re = new RegExp('^' + caminho.replace(/:[a-z]+/gi, (m) => { nomes.push(m.slice(1)); return '([^/]+)'; }) + '$');
      rotas.push({ metodo, re, nomes, opcoes, handler });
    },
    // Devolve { rota, params } ou { existe } quando o caminho existe mas o método não.
    achar(metodo, caminho) {
      let existe = false;
      for (const rota of rotas) {
        const m = rota.re.exec(caminho);
        if (!m) continue;
        existe = true;
        if (rota.metodo !== metodo) continue;
        const params = {};
        try {
          rota.nomes.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
        } catch {
          throw new ErroNegocio('Endereço inválido.', { status: 400, codigo: 'DADO_INVALIDO' });
        }
        return { rota, params };
      }
      return { existe };
    },
  };
}

function lerCorpo(req, limite = 1_000_000) {
  return new Promise((resolve, reject) => {
    const partes = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > limite) { reject(new ErroNegocio('Requisição grande demais.', { status: 413, codigo: 'GRANDE_DEMAIS' })); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => {
      const bruto = Buffer.concat(partes).toString('utf8').trim();
      if (!bruto) return resolve({});
      try {
        const dados = JSON.parse(bruto);
        if (dados === null || typeof dados !== 'object' || Array.isArray(dados)) throw new Error('formato');
        resolve(dados);
      } catch {
        reject(new ErroNegocio('Corpo da requisição inválido (esperado um objeto JSON).', { status: 400, codigo: 'JSON_INVALIDO' }));
      }
    });
    req.on('error', reject);
  });
}

function enviarJson(res, status, dados) {
  const corpo = JSON.stringify(dados);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Length': Buffer.byteLength(corpo),
  });
  res.end(corpo);
}

function servirEstatico(req, res, dir) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  let rel = '/';
  try { rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { /* usa a raiz */ }
  if (rel.endsWith('/')) rel += 'index.html';
  const arquivo = path.normalize(path.join(dir, rel));
  if (!arquivo.startsWith(dir + path.sep)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Não encontrado'); }
  fs.readFile(arquivo, (erro, conteudo) => {
    if (erro) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Não encontrado'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(arquivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : conteudo);
  });
}

module.exports = { criarRoteador, lerCorpo, enviarJson, servirEstatico };

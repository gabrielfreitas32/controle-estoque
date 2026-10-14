// Monta o servidor: rotas da API, autenticação, permissões e entrega do front-end.
const fs = require('node:fs');
const http = require('node:http');
const { criarRoteador, lerCorpo, enviarJson, servirEstatico } = require('./http');
const { ErroNegocio } = require('./errors');
const { criarEstoque } = require('./estoque');
const { criarUsuarios } = require('./usuarios');
const { criarToken, verificarToken } = require('./auth');

const ADMIN = ['admin'];
const TODOS = ['admin', 'operador'];

function criarServidor({ db, segredo, tokenHoras = 12, frontendDir, caArquivo = null }) {
  const estoque = criarEstoque(db);
  const usuarios = criarUsuarios(db);
  const r = criarRoteador();
  const tentativas = new Map(); // ip -> { n, janela, bloqueadoAte }

  // ---------- Rotas ----------
  r.adicionar('GET', '/api/saude', { publico: true }, () => ({ ok: true }));

  r.adicionar('POST', '/api/auth/login', { publico: true }, ({ body, ip }) => {
    const agora = Date.now();
    const t = tentativas.get(ip);
    if (t && t.bloqueadoAte > agora) {
      throw new ErroNegocio('Muitas tentativas. Aguarde alguns minutos e tente novamente.', { status: 429, codigo: 'MUITAS_TENTATIVAS' });
    }
    const u = usuarios.autenticar(body.nome, body.senha);
    if (!u) {
      const n = (t && t.janela > agora ? t.n : 0) + 1;
      tentativas.set(ip, { n, janela: agora + 15 * 60_000, bloqueadoAte: n >= 5 ? agora + 15 * 60_000 : 0 });
      throw new ErroNegocio('Usuário ou senha incorretos.', { status: 401, codigo: 'LOGIN_INVALIDO' });
    }
    tentativas.delete(ip);
    return { token: criarToken({ sub: u.id }, segredo, tokenHoras), usuario: { nome: u.nome, perfil: u.perfil } };
  });
  r.adicionar('POST', '/api/auth/senha', {}, ({ body, usuario }) => {
    const chave = 'senha:' + usuario.id; // limita tentativas de adivinhar a senha atual
    const agora = Date.now();
    const t = tentativas.get(chave);
    if (t && t.bloqueadoAte > agora) {
      throw new ErroNegocio('Muitas tentativas. Aguarde alguns minutos e tente novamente.', { status: 429, codigo: 'MUITAS_TENTATIVAS' });
    }
    try {
      const r2 = usuarios.alterarMinhaSenha(usuario.id, body.atual, body.nova);
      tentativas.delete(chave);
      return r2;
    } catch (e) {
      if (e.codigo === 'SENHA_ATUAL_INCORRETA') {
        const n = (t && t.janela > agora ? t.n : 0) + 1;
        tentativas.set(chave, { n, janela: agora + 15 * 60_000, bloqueadoAte: n >= 5 ? agora + 15 * 60_000 : 0 });
      }
      throw e;
    }
  });
  r.adicionar('GET', '/api/auth/eu', {}, ({ usuario }) => ({ nome: usuario.nome, perfil: usuario.perfil }));

  r.adicionar('GET', '/api/produtos', {}, ({ usuario }) => estoque.listarProdutos(usuario.perfil === 'admin'));
  r.adicionar('GET', '/api/ranking', {}, ({ query, usuario }) => estoque.ranking(query.periodo || 'hoje', usuario.perfil === 'admin'));
  r.adicionar('GET', '/api/resumo', {}, ({ usuario }) => estoque.resumoEstoque(usuario.perfil === 'admin'));
  r.adicionar('POST', '/api/produtos', { perfis: ADMIN, status: 201 }, ({ body, usuario }) => estoque.criarProduto(body, usuario.nome));
  r.adicionar('PUT', '/api/produtos/:ean', { perfis: ADMIN }, ({ params, body, usuario }) => estoque.atualizarProduto(params.ean, body, usuario.nome));
  r.adicionar('DELETE', '/api/produtos/:ean', { perfis: ADMIN }, ({ params }) => estoque.excluirProduto(params.ean));

  r.adicionar('GET', '/api/kits', {}, () => estoque.listarKits());
  r.adicionar('POST', '/api/kits', { perfis: ADMIN, status: 201 }, ({ body }) => estoque.criarKit(body));
  r.adicionar('DELETE', '/api/kits/:codigo', { perfis: ADMIN }, ({ params }) => estoque.excluirKit(params.codigo));

  r.adicionar('POST', '/api/movimentacoes', { perfis: TODOS }, ({ body, usuario }) => estoque.movimentar({ ...body, usuario: usuario.nome }));
  r.adicionar('POST', '/api/movimentacoes/:id/estorno', { perfis: ADMIN }, ({ params, body, usuario }) => estoque.estornar(params.id, body.motivo, usuario.nome));
  r.adicionar('GET', '/api/movimentacoes', {}, ({ query }) => estoque.listarMovimentacoes(query));

  r.adicionar('POST', '/api/inventario', { perfis: ADMIN }, ({ body, usuario }) => estoque.aplicarInventario(body.contagens, usuario.nome));

  r.adicionar('GET', '/api/usuarios', { perfis: ADMIN }, () => usuarios.listar());
  r.adicionar('POST', '/api/usuarios', { perfis: ADMIN, status: 201 }, ({ body }) => usuarios.criar(body));
  r.adicionar('PUT', '/api/usuarios/:id/senha', { perfis: ADMIN }, ({ params, body }) => usuarios.definirSenha(Number(params.id), body.nova));
  r.adicionar('PUT', '/api/usuarios/:id/ativo', { perfis: ADMIN }, ({ params, body, usuario: eu }) => usuarios.definirAtivo(Number(params.id), !!body.ativo, eu.id));

  // ---------- Servidor ----------
  const tratador = async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      // Certificado da autoridade local, para instalar no celular (público: não contém segredo)
      if (caArquivo && url.pathname === '/estoque-ca.crt') {
        return fs.readFile(caArquivo, (erro, pem) => {
          if (erro) { res.writeHead(404); return res.end(); }
          res.writeHead(200, { 'Content-Type': 'application/x-x509-ca-cert', 'Content-Disposition': 'attachment; filename="estoque-ca.crt"' });
          res.end(pem);
        });
      }
      if (!url.pathname.startsWith('/api/')) return servirEstatico(req, res, frontendDir);

      const { rota, params, existe } = r.achar(req.method, url.pathname);
      if (!rota) {
        return enviarJson(res, existe ? 405 : 404, { erro: existe ? 'Método não permitido.' : 'Rota não encontrada.', codigo: existe ? 'METODO' : 'ROTA' });
      }

      let usuario = null;
      if (!rota.opcoes.publico) {
        const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
        const dados = m && verificarToken(m[1], segredo);
        usuario = dados && usuarios.porId(dados.sub); // consulta o banco: perfil e "ativo" valem na hora
        if (!usuario) return enviarJson(res, 401, { erro: 'Faça login para continuar.', codigo: 'NAO_AUTENTICADO' });
        if (rota.opcoes.perfis && !rota.opcoes.perfis.includes(usuario.perfil)) {
          return enviarJson(res, 403, { erro: 'Você não tem permissão para esta ação.', codigo: 'SEM_PERMISSAO' });
        }
      }

      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await lerCorpo(req) : {};
      const dados = await rota.handler({ body, params, query: Object.fromEntries(url.searchParams), usuario, ip: req.socket.remoteAddress });
      enviarJson(res, rota.opcoes.status || 200, dados ?? {});
    } catch (e) {
      if (e instanceof ErroNegocio) return enviarJson(res, e.status, { erro: e.message, codigo: e.codigo });
      console.error('Erro inesperado:', e);
      enviarJson(res, 500, { erro: 'Erro interno do servidor.', codigo: 'ERRO_INTERNO' });
    }
  };
  const servidor = http.createServer(tratador);
  servidor.tratador = tratador; // o mesmo tratador atende também o servidor HTTPS
  return servidor;
}

module.exports = { criarServidor };

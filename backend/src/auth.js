// Senhas (scrypt) e tokens de login (JWT HS256) usando apenas o módulo crypto do Node.
const crypto = require('node:crypto');

function hashSenha(senha) {
  const sal = crypto.randomBytes(16);
  const hash = crypto.scryptSync(senha, sal, 64);
  return `scrypt$${sal.toString('base64')}$${hash.toString('base64')}`;
}

function conferirSenha(senha, guardado) {
  const [alg, sal, hash] = String(guardado).split('$');
  if (alg !== 'scrypt' || !sal || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  const obtido = crypto.scryptSync(senha, Buffer.from(sal, 'base64'), esperado.length);
  return crypto.timingSafeEqual(obtido, esperado);
}

const b64u = (x) => Buffer.from(x).toString('base64url');
const assinar = (dados, segredo) => crypto.createHmac('sha256', segredo).update(dados).digest();

function criarToken(payload, segredo, horas = 12) {
  const cabecalho = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const corpo = b64u(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + horas * 3600 }));
  return `${cabecalho}.${corpo}.${assinar(`${cabecalho}.${corpo}`, segredo).toString('base64url')}`;
}

// Devolve os dados do token ou null se for inválido/expirado.
function verificarToken(token, segredo) {
  const partes = String(token || '').split('.');
  if (partes.length !== 3) return null;
  const esperado = assinar(`${partes[0]}.${partes[1]}`, segredo);
  const recebido = Buffer.from(partes[2], 'base64url');
  if (recebido.length !== esperado.length || !crypto.timingSafeEqual(recebido, esperado)) return null;
  try {
    const dados = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'));
    return dados.exp && dados.exp > Date.now() / 1000 ? dados : null;
  } catch {
    return null;
  }
}

module.exports = { hashSenha, conferirSenha, criarToken, verificarToken };

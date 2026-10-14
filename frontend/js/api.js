// Comunicação com a API do servidor e conversão para o formato usado pelas telas.
const TOKEN_KEY = 'estoque_token';
let token = null;
let usuario = null; // { nome, perfil }
try { token = localStorage.getItem(TOKEN_KEY); } catch (e) { /* sem armazenamento */ }

function guardarToken(t) {
  token = t;
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignora */ }
}

function criarErro(mensagem, status, codigo) {
  const e = new Error(mensagem);
  e.status = status;
  e.codigo = codigo;
  return e;
}

async function api(metodo, caminho, corpo) {
  let resp;
  const ctl = new AbortController();
  const limite = setTimeout(() => ctl.abort(), 10000); // não deixa uma requisição presa travar a fila de bipes
  try {
    resp = await fetch('/api' + caminho, {
      signal: ctl.signal,
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
  } catch (e) {
    clearTimeout(limite);
    if (e.name === 'AbortError') throw criarErro('O servidor demorou mais de 10 segundos para responder.', 0, 'TIMEOUT');
    throw criarErro('Sem conexão com o servidor. Verifique se ele está ligado e se você está na rede da empresa.', 0, 'SEM_CONEXAO');
  }
  clearTimeout(limite);
  let dados = null;
  try { dados = await resp.json(); } catch (e) { /* sem corpo */ }
  if (resp.status === 401 && caminho !== '/auth/login') {
    sair();
    throw criarErro('Sessão expirada. Entre novamente.', 401, 'NAO_AUTENTICADO');
  }
  if (!resp.ok) throw criarErro((dados && dados.erro) || 'Erro inesperado (' + resp.status + ').', resp.status, dados && dados.codigo);
  return dados;
}

// API (português, banco) -> formato usado pelas telas
const dProduto = (p) => ({ ean: p.ean, name: p.nome, sku: p.sku || '', loc: p.localizacao || '', min: p.estoque_minimo, qty: p.saldo, cost: p.preco_custo_centavos, val: p.valor_estoque_centavos });
const dKit = (k) => ({ code: k.codigo, name: k.nome, items: k.itens.map((i) => ({ ean: i.ean, q: i.quantidade })) });
const dMov = (m) => ({ id: m.id, estornoDe: m.estorno_de, estornadoPor: m.estornado_por, t: m.t, type: m.tipo, ean: m.ean, name: m.nome, q: m.quantidade, bal: m.saldo_apos, ref: m.referencia, note: m.observacao, user: m.usuario });

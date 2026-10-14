const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { abrirBanco } = require('../src/db');
const { criarServidor } = require('../src/app');
const { criarUsuarios } = require('../src/usuarios');
const { criarToken } = require('../src/auth');

const SEGREDO = 'segredo-de-teste';
let servidor, base, tokenAdmin, tokenOp;

async function chamar(metodo, caminho, corpo, token) {
  const resp = await fetch(base + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let dados = null;
  try { dados = await resp.json(); } catch { /* sem corpo JSON */ }
  return { status: resp.status, dados };
}

test.before(async () => {
  const db = abrirBanco(':memory:');
  const u = criarUsuarios(db);
  u.criar({ nome: 'admin', senha: 'senha123', perfil: 'admin' });
  u.criar({ nome: 'maria', senha: 'senha456', perfil: 'operador' });
  servidor = criarServidor({ db, segredo: SEGREDO, frontendDir: path.resolve(__dirname, '..', '..', 'frontend') });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${servidor.address().port}`;
  tokenAdmin = (await chamar('POST', '/api/auth/login', { nome: 'admin', senha: 'senha123' })).dados.token;
  tokenOp = (await chamar('POST', '/api/auth/login', { nome: 'maria', senha: 'senha456' })).dados.token;
});
test.after(() => servidor.close());

test('rotas protegidas exigem login', async () => {
  assert.equal((await chamar('GET', '/api/produtos')).status, 401);
  assert.equal((await chamar('GET', '/api/produtos', null, 'lixo.lixo.lixo')).status, 401);
  assert.equal((await chamar('GET', '/api/saude')).status, 200);
});

test('token expirado ou assinado com outro segredo é recusado', async () => {
  const expirado = criarToken({ sub: 1 }, SEGREDO, -1);
  const falso = criarToken({ sub: 1 }, 'outro-segredo', 1);
  assert.equal((await chamar('GET', '/api/auth/eu', null, expirado)).status, 401);
  assert.equal((await chamar('GET', '/api/auth/eu', null, falso)).status, 401);
});

test('login com senha errada devolve 401 e a mesma mensagem para usuário inexistente', async () => {
  const a = await chamar('POST', '/api/auth/login', { nome: 'admin', senha: 'errada' });
  const b = await chamar('POST', '/api/auth/login', { nome: 'ninguem', senha: 'errada' });
  assert.equal(a.status, 401);
  assert.equal(a.dados.erro, b.dados.erro);
});

test('operador não cadastra, não exclui e não faz inventário (403)', async () => {
  assert.equal((await chamar('POST', '/api/produtos', { ean: '1', nome: 'X' }, tokenOp)).status, 403);
  assert.equal((await chamar('DELETE', '/api/produtos/1', null, tokenOp)).status, 403);
  assert.equal((await chamar('POST', '/api/inventario', { contagens: [] }, tokenOp)).status, 403);
  assert.equal((await chamar('GET', '/api/usuarios', null, tokenOp)).status, 403);
});

test('fluxo completo: admin cadastra, operador bipa, histórico mostra o usuário', async () => {
  const p1 = await chamar('POST', '/api/produtos', { ean: '111', nome: 'Shampoo', saldo: 5 }, tokenAdmin);
  assert.equal(p1.status, 201);
  await chamar('POST', '/api/produtos', { ean: '222', nome: 'Condicionador', saldo: 1 }, tokenAdmin);
  const k = await chamar('POST', '/api/kits', { codigo: 'kit-1', nome: 'Kit 1', itens: [{ ean: '111', quantidade: 1 }, { ean: '222', quantidade: 1 }] }, tokenAdmin);
  assert.equal(k.status, 201);

  const ok = await chamar('POST', '/api/movimentacoes', { tipo: 'saida', codigo: '111', quantidade: 2, referencia: 'PED-9' }, tokenOp);
  assert.equal(ok.status, 200);
  assert.match(ok.dados.mensagem, /saldo 3/);

  const semSaldo = await chamar('POST', '/api/movimentacoes', { tipo: 'saida', codigo: 'KIT-1', quantidade: 2 }, tokenOp);
  assert.equal(semSaldo.status, 409);
  assert.equal(semSaldo.dados.codigo, 'SEM_SALDO');

  const naoCad = await chamar('POST', '/api/movimentacoes', { tipo: 'saida', codigo: '999', quantidade: 1 }, tokenOp);
  assert.equal(naoCad.status, 404);

  const hist = await chamar('GET', '/api/movimentacoes?limite=1', null, tokenOp);
  assert.equal(hist.dados[0].usuario, 'maria');
  assert.equal(hist.dados[0].referencia, 'PED-9');
});

test('corpo inválido e rota inexistente', async () => {
  const resp = await fetch(base + '/api/produtos', { method: 'POST', headers: { Authorization: 'Bearer ' + tokenAdmin }, body: '{quebrado' });
  assert.equal(resp.status, 400);
  assert.equal((await chamar('GET', '/api/nada', null, tokenAdmin)).status, 404);
  assert.equal((await chamar('PATCH', '/api/produtos', {}, tokenAdmin)).status, 405);
});

test('front-end é entregue e não deixa sair da pasta (path traversal)', async () => {
  const home = await fetch(base + '/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Controle de Estoque/);
  for (const caminho of ['/..%2f..%2fbackend%2fpackage.json', '/%2e%2e/backend/package.json', '/js/../../backend/package.json']) {
    const r = await fetch(base + caminho);
    assert.notEqual(r.status, 200, caminho);
    assert.doesNotMatch(await r.text(), /controle-estoque-backend/);
  }
});

test('usuário troca a própria senha; admin redefine e desativa outros', async () => {
  // senha atual errada, curta ou igual à atual
  assert.equal((await chamar('POST', '/api/auth/senha', { atual: 'errada123', nova: 'nova-senha-1' }, tokenOp)).dados.codigo, 'SENHA_ATUAL_INCORRETA');
  assert.equal((await chamar('POST', '/api/auth/senha', { atual: 'senha456', nova: 'curta' }, tokenOp)).status, 400);
  assert.equal((await chamar('POST', '/api/auth/senha', { atual: 'senha456', nova: 'senha456' }, tokenOp)).status, 400);
  assert.equal((await chamar('POST', '/api/auth/senha', { atual: 'senha456', nova: 'nova-senha-1' }, tokenOp)).status, 200);
  assert.equal((await chamar('POST', '/api/auth/login', { nome: 'maria', senha: 'senha456' })).status, 401);
  assert.equal((await chamar('POST', '/api/auth/login', { nome: 'maria', senha: 'nova-senha-1' })).status, 200);

  const lista = (await chamar('GET', '/api/usuarios', null, tokenAdmin)).dados;
  const maria = lista.find((u) => u.nome === 'maria');
  const admin = lista.find((u) => u.nome === 'admin');
  // operador não administra usuários
  assert.equal((await chamar('PUT', `/api/usuarios/${maria.id}/senha`, { nova: 'qualquer-123' }, tokenOp)).status, 403);
  // admin redefine a senha de outro usuário
  assert.equal((await chamar('PUT', `/api/usuarios/${maria.id}/senha`, { nova: 'redefinida-9' }, tokenAdmin)).status, 200);
  assert.equal((await chamar('POST', '/api/auth/login', { nome: 'maria', senha: 'redefinida-9' })).status, 200);
  // não pode desativar a si mesmo, nem o último admin
  assert.equal((await chamar('PUT', `/api/usuarios/${admin.id}/ativo`, { ativo: false }, tokenAdmin)).status, 409);
  // desativar e reativar o operador
  assert.equal((await chamar('PUT', `/api/usuarios/${maria.id}/ativo`, { ativo: false }, tokenAdmin)).status, 200);
  assert.equal((await chamar('POST', '/api/auth/login', { nome: 'maria', senha: 'redefinida-9' })).status, 401);
  assert.equal((await chamar('PUT', `/api/usuarios/${maria.id}/ativo`, { ativo: true }, tokenAdmin)).status, 200);
  assert.equal((await chamar('PUT', '/api/usuarios/9999/senha', { nova: 'redefinida-9' }, tokenAdmin)).status, 404);
});

test('estorno pela API: só admin, com motivo, e o histórico mostra quem fez', async () => {
  await chamar('POST', '/api/produtos', { ean: '777', nome: 'Sabonete', saldo: 5 }, tokenAdmin);
  await chamar('POST', '/api/movimentacoes', { tipo: 'saida', codigo: '777', quantidade: 2 }, tokenOp);
  const id = (await chamar('GET', '/api/movimentacoes?limite=1', null, tokenOp)).dados[0].id;
  assert.equal((await chamar('POST', `/api/movimentacoes/${id}/estorno`, { motivo: 'Erro de bipagem' }, tokenOp)).status, 403);
  assert.equal((await chamar('POST', `/api/movimentacoes/${id}/estorno`, { motivo: '' }, tokenAdmin)).status, 400);
  const ok = await chamar('POST', `/api/movimentacoes/${id}/estorno`, { motivo: 'Erro de bipagem' }, tokenAdmin);
  assert.equal(ok.status, 200);
  assert.match(ok.dados.mensagem, /Estorno feito/);
  const h = (await chamar('GET', '/api/movimentacoes?limite=2', null, tokenAdmin)).dados;
  assert.equal(h[0].usuario, 'admin');
  assert.equal(h[0].estorno_de, id);
  assert.equal((await chamar('POST', `/api/movimentacoes/${id}/estorno`, { motivo: 'Erro de bipagem' }, tokenAdmin)).status, 409);
});

test('bloqueio após 5 logins errados (429)', async () => {
  let ultimo;
  for (let i = 0; i < 6; i++) ultimo = await chamar('POST', '/api/auth/login', { nome: 'admin', senha: 'x' + i });
  assert.equal(ultimo.status, 429);
});

test('custo e valor do estoque: admin vê, operador não', async () => {
  await chamar('POST', '/api/produtos', { ean: '555', nome: 'Perfume', saldo: 4, preco_custo: '25,00' }, tokenAdmin);
  const adm = await chamar('GET', '/api/produtos', null, tokenAdmin);
  assert.equal(adm.dados.find((p) => p.ean === '555').valor_estoque_centavos, 10000);
  const op = await chamar('GET', '/api/produtos', null, tokenOp);
  assert.equal('preco_custo_centavos' in op.dados.find((p) => p.ean === '555'), false);
  const rAdm = await chamar('GET', '/api/resumo', null, tokenAdmin);
  assert.ok(rAdm.dados.valor_total_custo_centavos >= 10000);
  const rOp = await chamar('GET', '/api/resumo', null, tokenOp);
  assert.equal(rOp.status, 200);
  assert.equal('valor_total_custo_centavos' in rOp.dados, false);
  assert.equal((await chamar('GET', '/api/resumo')).status, 401);
  const ruim = await chamar('POST', '/api/produtos', { ean: '556', nome: 'Ruim', preco_custo: 'abc' }, tokenAdmin);
  assert.equal(ruim.status, 400);
});

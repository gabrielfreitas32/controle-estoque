const test = require('node:test');
const assert = require('node:assert/strict');
const { abrirBanco } = require('../src/db');
const { criarEstoque } = require('../src/estoque');

function novo() {
  const estoque = criarEstoque(abrirBanco(':memory:'));
  estoque.criarProduto({ ean: '111', nome: 'Shampoo', saldo: 10, estoque_minimo: 3 }, 'ana');
  estoque.criarProduto({ ean: '222', nome: 'Condicionador', saldo: 2 }, 'ana');
  estoque.criarProduto({ ean: '333', nome: 'Máscara', saldo: 5, sku: 'MASC-1' }, 'ana');
  estoque.criarKit({ codigo: 'kit-a', nome: 'Kit A', itens: [{ ean: '111', quantidade: 1 }, { ean: '222', quantidade: 1 }, { ean: '333', quantidade: 1 }] });
  return estoque;
}
const saldo = (e, ean) => e.listarProdutos().find((p) => p.ean === ean).saldo;
const rejeita = (fn, codigo) => assert.throws(fn, (e) => e.codigo === codigo, `esperava erro ${codigo}`);

test('saldo inicial gera movimentação de entrada', () => {
  const e = novo();
  const h = e.listarMovimentacoes({ limite: 50 }).filter((m) => m.ean === '111');
  assert.equal(h.length, 1);
  assert.equal(h[0].tipo, 'entrada');
  assert.equal(h[0].observacao, 'Saldo inicial');
});

test('entrada e saída atualizam o saldo e o histórico', () => {
  const e = novo();
  e.movimentar({ tipo: 'saida', codigo: '111', quantidade: 4, referencia: 'PED-1', usuario: 'ana' });
  e.movimentar({ tipo: 'entrada', codigo: '111', quantidade: 1, usuario: 'ana' });
  assert.equal(saldo(e, '111'), 7);
  const [ultima, anterior] = e.listarMovimentacoes({ limite: 2 });
  assert.equal(ultima.quantidade, 1);
  assert.equal(anterior.referencia, 'PED-1');
  assert.equal(anterior.saldo_apos, 6);
});

test('RN01: saída sem saldo é bloqueada e não altera nada', () => {
  const e = novo();
  rejeita(() => e.movimentar({ tipo: 'saida', codigo: '222', quantidade: 3, usuario: 'ana' }), 'SEM_SALDO');
  assert.equal(saldo(e, '222'), 2);
});

test('SKU também localiza o produto, sem diferenciar maiúsculas', () => {
  const e = novo();
  e.movimentar({ tipo: 'saida', codigo: 'masc-1', quantidade: 1, usuario: 'ana' });
  assert.equal(saldo(e, '333'), 4);
});

test('EAN não cadastrado devolve NAO_CADASTRADO', () => {
  rejeita(() => novo().movimentar({ tipo: 'saida', codigo: '999', quantidade: 1 }), 'NAO_CADASTRADO');
});

test('quantidade inválida é recusada', () => {
  const e = novo();
  for (const q of [0, -1, 1.5, 'abc', null]) rejeita(() => e.movimentar({ tipo: 'saida', codigo: '111', quantidade: q }), 'DADO_INVALIDO');
});

test('saída de kit baixa todos os componentes (código do kit sem diferenciar maiúsculas)', () => {
  const e = novo();
  const r = e.movimentar({ tipo: 'saida', codigo: 'Kit-A', quantidade: 2, usuario: 'ana' });
  assert.equal(r.alvo, 'kit');
  assert.deepEqual([saldo(e, '111'), saldo(e, '222'), saldo(e, '333')], [8, 0, 3]);
});

test('RN03: kit é tudo ou nada', () => {
  const e = novo();
  rejeita(() => e.movimentar({ tipo: 'saida', codigo: 'KIT-A', quantidade: 3, usuario: 'ana' }), 'SEM_SALDO');
  assert.deepEqual([saldo(e, '111'), saldo(e, '222'), saldo(e, '333')], [10, 2, 5]);
});

test('kit só pode ser usado na saída', () => {
  rejeita(() => novo().movimentar({ tipo: 'entrada', codigo: 'KIT-A', quantidade: 1 }), 'KIT_SO_SAIDA');
});

test('RN04: EAN e SKU são únicos', () => {
  const e = novo();
  rejeita(() => e.criarProduto({ ean: '111', nome: 'Outro' }), 'EAN_EXISTE');
  rejeita(() => e.criarProduto({ ean: '444', nome: 'Outro', sku: 'masc-1' }), 'SKU_EXISTE');
});

test('RN05: código de kit não pode coincidir com produto, e vice-versa', () => {
  const e = novo();
  rejeita(() => e.criarKit({ codigo: '111', nome: 'X', itens: [{ ean: '222', quantidade: 1 }] }), 'CODIGO_EM_USO');
  rejeita(() => e.criarProduto({ ean: 'KIT-A', nome: 'X' }), 'CODIGO_EM_USO');
  rejeita(() => e.criarKit({ codigo: 'KIT-A', nome: 'X', itens: [{ ean: '222', quantidade: 1 }] }), 'KIT_EXISTE');
});

test('RN06: produto usado em kit não pode ser excluído', () => {
  const e = novo();
  rejeita(() => e.excluirProduto('111'), 'PRODUTO_EM_KIT');
  e.excluirKit('KIT-A');
  e.excluirProduto('111');
  assert.equal(e.listarProdutos().length, 2);
  assert.ok(e.listarMovimentacoes({ limite: 50 }).some((m) => m.ean === '111'), 'histórico é mantido');
});

test('kit com componente inexistente ou repetido é recusado', () => {
  const e = novo();
  rejeita(() => e.criarKit({ codigo: 'K2', nome: 'K2', itens: [{ ean: '000', quantidade: 1 }] }), 'DADO_INVALIDO');
  rejeita(() => e.criarKit({ codigo: 'K3', nome: 'K3', itens: [{ ean: '111', quantidade: 1 }, { ean: '111', quantidade: 2 }] }), 'DADO_INVALIDO');
  assert.equal(e.listarKits().length, 1, 'kit parcial não pode ficar gravado');
});

test('edição de saldo gera ajuste no histórico', () => {
  const e = novo();
  e.atualizarProduto('111', { nome: 'Shampoo 500', saldo: 15, estoque_minimo: 3 }, 'ana');
  assert.equal(saldo(e, '111'), 15);
  assert.equal(e.listarMovimentacoes({ limite: 1 })[0].tipo, 'ajuste');
});

test('inventário ajusta só o que diverge', () => {
  const e = novo();
  const r = e.aplicarInventario([{ ean: '111', quantidade: 10 }, { ean: '222', quantidade: 5 }], 'ana');
  assert.equal(r.ajustes, 1);
  assert.equal(saldo(e, '222'), 5);
  assert.equal(e.listarMovimentacoes({ limite: 1 })[0].tipo, 'inventario');
});

test('inventário com produto inexistente não aplica nada', () => {
  const e = novo();
  rejeita(() => e.aplicarInventario([{ ean: '222', quantidade: 9 }, { ean: '000', quantidade: 1 }], 'ana'), 'NAO_CADASTRADO');
  assert.equal(saldo(e, '222'), 2);
});

test('busca no histórico', () => {
  const e = novo();
  e.movimentar({ tipo: 'saida', codigo: '111', quantidade: 1, referencia: 'SHOPEE-77', usuario: 'ana' });
  assert.equal(e.listarMovimentacoes({ busca: 'shopee-77' }).length, 1);
  assert.ok(e.listarMovimentacoes({ busca: 'saída' }).length >= 1);
});

/* ---------- Preço de custo e valor do estoque ---------- */
test('preço de custo aceita vírgula, ponto e R$ e guarda em centavos', () => {
  const e = novo();
  const custo = (v) => { e.criarProduto({ ean: 'c' + v, nome: 'P' + v, preco_custo: v }, 'ana'); return e.listarProdutos(true).find((p) => p.ean === 'c' + v).preco_custo_centavos; };
  assert.equal(custo('12,50'), 1250);
  assert.equal(custo('12.5'), 1250);
  assert.equal(custo('R$ 1.234,56'), 123456);
  assert.equal(custo(7), 700);
  assert.equal(custo(''), 0);
});

test('preço de custo inválido ou negativo é recusado', () => {
  const e = novo();
  for (const v of ['abc', '-5', '1,234', '12,5,0']) {
    rejeita(() => e.criarProduto({ ean: 'x' + v, nome: 'X', preco_custo: v }, 'ana'), 'DADO_INVALIDO');
  }
});

test('valor total do estoque = soma de saldo × custo, e acompanha as movimentações', () => {
  const e = novo();
  e.atualizarProduto('111', { nome: 'Shampoo', estoque_minimo: 3, preco_custo: '10,00' }, 'ana'); // 10 un
  e.atualizarProduto('222', { nome: 'Condicionador', preco_custo: '2,50' }, 'ana');               // 2 un
  let r = e.resumoEstoque(true);
  assert.equal(r.valor_total_custo_centavos, 10 * 1000 + 2 * 250);
  assert.equal(r.produtos_sem_custo, 1);           // a máscara
  assert.equal(r.produtos_sem_custo_com_saldo, 1);
  e.movimentar({ tipo: 'saida', codigo: '111', quantidade: 4, usuario: 'ana' });
  e.movimentar({ tipo: 'entrada', codigo: '222', quantidade: 8, usuario: 'ana' });
  r = e.resumoEstoque(true);
  assert.equal(r.valor_total_custo_centavos, 6 * 1000 + 10 * 250);
  assert.equal(r.maiores_valores[0].ean, '111');
});

test('editar sem informar o custo não apaga o custo existente', () => {
  const e = novo();
  e.atualizarProduto('111', { nome: 'Shampoo', preco_custo: '9,90' }, 'ana');
  e.atualizarProduto('111', { nome: 'Shampoo novo' }, 'ana');
  assert.equal(e.listarProdutos(true).find((p) => p.ean === '111').preco_custo_centavos, 990);
});

test('sem permissão de custo, valores em dinheiro não são enviados', () => {
  const e = novo();
  e.atualizarProduto('111', { nome: 'Shampoo', preco_custo: '9,90' }, 'ana');
  const p = e.listarProdutos(false).find((x) => x.ean === '111');
  assert.equal('preco_custo_centavos' in p, false);
  const r = e.resumoEstoque(false);
  assert.equal('valor_total_custo_centavos' in r, false);
  assert.equal(r.unidades, 17);
});

test('banco antigo (sem a coluna de custo) é migrado sem perder dados', () => {
  const { DatabaseSync } = require('node:sqlite');
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mig-')), 'velho.db');
  const velho = new DatabaseSync(arq);
  velho.exec(`CREATE TABLE produtos (ean TEXT PRIMARY KEY, nome TEXT NOT NULL, sku TEXT UNIQUE COLLATE NOCASE, localizacao TEXT NOT NULL DEFAULT '', estoque_minimo INTEGER NOT NULL DEFAULT 0, saldo INTEGER NOT NULL DEFAULT 0, criado_em INTEGER NOT NULL);
    INSERT INTO produtos (ean, nome, saldo, criado_em) VALUES ('999', 'Antigo', 7, 1);`);
  velho.close();
  const e = criarEstoque(abrirBanco(arq));
  const p = e.listarProdutos(true)[0];
  assert.equal(p.saldo, 7);
  assert.equal(p.preco_custo_centavos, 0);
});

/* ---------- Estorno ---------- */
const ultima = (e) => e.listarMovimentacoes({ limite: 1 })[0];

test('estorno de saída devolve o saldo, registra motivo e usuário e marca o original', () => {
  const e = novo();
  e.movimentar({ tipo: 'saida', codigo: '111', quantidade: 4, referencia: 'PED-7', usuario: 'maria' });
  const orig = ultima(e);
  const r = e.estornar(orig.id, 'Bipei o produto errado', 'ana');
  assert.equal(r.estornados, 1);
  assert.equal(saldo(e, '111'), 10);
  const est = ultima(e);
  assert.equal(est.usuario, 'ana');
  assert.equal(est.estorno_de, orig.id);
  assert.equal(est.quantidade, 4);
  assert.match(est.observacao, /Bipei o produto errado/);
  assert.equal(est.referencia, 'PED-7');
  assert.ok(e.listarMovimentacoes({ limite: 5 }).find((m) => m.id === orig.id).estornado_por);
});

test('estorno de entrada tira do saldo; sem saldo suficiente é recusado', () => {
  const e = novo();
  e.movimentar({ tipo: 'entrada', codigo: '222', quantidade: 5, usuario: 'ana' }); // 2 -> 7
  const ent = ultima(e);
  e.movimentar({ tipo: 'saida', codigo: '222', quantidade: 6, usuario: 'ana' });   // 7 -> 1
  rejeita(() => e.estornar(ent.id, 'Contei errado', 'ana'), 'SEM_SALDO');
  assert.equal(saldo(e, '222'), 1); // nada mudou
});

test('não estorna duas vezes, nem um estorno, nem ajuste; motivo é obrigatório', () => {
  const e = novo();
  e.movimentar({ tipo: 'saida', codigo: '111', quantidade: 1, usuario: 'ana' });
  const id = ultima(e).id;
  rejeita(() => e.estornar(id, '', 'ana'), 'DADO_INVALIDO');
  rejeita(() => e.estornar(id, 'ab', 'ana'), 'DADO_INVALIDO');
  e.estornar(id, 'Erro de bipagem', 'ana');
  rejeita(() => e.estornar(id, 'Erro de bipagem', 'ana'), 'JA_ESTORNADO');
  rejeita(() => e.estornar(ultima(e).id, 'Desfazer o estorno', 'ana'), 'JA_ESTORNO');
  const ajuste = e.listarMovimentacoes({ limite: 50 }).find((m) => m.observacao === 'Saldo inicial' && m.tipo === 'entrada');
  e.atualizarProduto('333', { nome: 'Máscara', sku: 'MASC-1', saldo: 9 }, 'ana'); // gera um ajuste
  rejeita(() => e.estornar(ultima(e).id, 'Tentando estornar ajuste', 'ana'), 'TIPO_NAO_ESTORNAVEL');
  rejeita(() => e.estornar(99999, 'Não existe', 'ana'), 'NAO_ENCONTRADO');
  assert.ok(ajuste);
});

test('estorno de uma saída de kit devolve todos os componentes juntos', () => {
  const e = novo();
  e.movimentar({ tipo: 'saida', codigo: 'KIT-A', quantidade: 2, usuario: 'maria' }); // 111:10->8, 222:2->0, 333:5->3
  const linha = e.listarMovimentacoes({ limite: 3 }).find((m) => m.ean === '222');
  const r = e.estornar(linha.id, 'Cliente cancelou o pedido', 'ana');
  assert.equal(r.estornados, 3);
  assert.equal(saldo(e, '111'), 10);
  assert.equal(saldo(e, '222'), 2);
  assert.equal(saldo(e, '333'), 5);
  rejeita(() => e.estornar(e.listarMovimentacoes({ limite: 6 }).find((m) => m.ean === '111' && m.tipo === 'saida').id, 'De novo', 'ana'), 'JA_ESTORNADO');
});

test('estorno de kit soma de volta mesmo com um componente já zerado', () => {
  const e = novo();
  e.movimentar({ tipo: 'saida', codigo: 'KIT-A', quantidade: 1, usuario: 'maria' }); // 111:9, 222:1, 333:4
  const linha = e.listarMovimentacoes({ limite: 3 }).find((m) => m.ean === '111');
  e.movimentar({ tipo: 'entrada', codigo: '111', quantidade: 1, usuario: 'ana' });
  e.movimentar({ tipo: 'saida', codigo: '333', quantidade: 4, usuario: 'ana' }); // 333 vai a 0: estorno do kit vai somar, não falha
  const r = e.estornar(linha.id, 'Erro', 'ana');
  assert.equal(r.estornados, 3);
  assert.equal(saldo(e, '333'), 1);
});

test('banco antigo sem as colunas de estorno é migrado e continua funcionando', () => {
  const { DatabaseSync } = require('node:sqlite');
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mig2-')), 'velho.db');
  const velho = new DatabaseSync(arq);
  velho.exec(`CREATE TABLE movimentacoes (id INTEGER PRIMARY KEY AUTOINCREMENT, produto_ean TEXT NOT NULL, produto_nome TEXT NOT NULL, tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida','ajuste','inventario')), quantidade INTEGER NOT NULL, saldo_apos INTEGER NOT NULL, referencia TEXT NOT NULL DEFAULT '', observacao TEXT NOT NULL DEFAULT '', usuario TEXT NOT NULL DEFAULT '', criado_em INTEGER NOT NULL);
    INSERT INTO movimentacoes (produto_ean, produto_nome, tipo, quantidade, saldo_apos, criado_em) VALUES ('1', 'P', 'entrada', 5, 5, 1);`);
  velho.close();
  const db = abrirBanco(arq);
  const e = criarEstoque(db);
  assert.equal(e.listarMovimentacoes()[0].estornado_por, null);
});

/* ---------- Ranking de vendas ---------- */
function comSaidasEm(datas) { // datas: [[timestamp, ean, qtd]]
  const db = abrirBanco(':memory:');
  const e = criarEstoque(db);
  e.criarProduto({ ean: '111', nome: 'Shampoo', saldo: 100, preco_custo: 10 }, 'ana');
  e.criarProduto({ ean: '222', nome: 'Condicionador', saldo: 100, preco_custo: 5 }, 'ana');
  for (const [t, ean, q] of datas) {
    e.movimentar({ tipo: 'saida', codigo: ean, quantidade: q, usuario: 'ana' });
    db.prepare('UPDATE movimentacoes SET criado_em = ? WHERE id = (SELECT MAX(id) FROM movimentacoes)').run(t);
  }
  return { e, db };
}
const hora = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();

test('ranking soma por período e ordena pelo que mais saiu', () => {
  // quarta 14/10/2026 às 15h; segunda da semana = 12/10
  const agora = hora(2026, 10, 14, 15);
  const { e } = comSaidasEm([
    [hora(2026, 10, 14, 9), '111', 3],
    [hora(2026, 10, 14, 10), '222', 1],
    [hora(2026, 10, 14, 11), '111', 2],
    [hora(2026, 10, 12, 10), '222', 5],   // segunda: só semana/mês
    [hora(2026, 10, 3, 10), '111', 7],    // só mês
    [hora(2026, 9, 10, 10), '111', 9],    // mês passado, dentro do mesmo trecho decorrido
  ]);
  const hoje = e.ranking('hoje', false, agora);
  assert.equal(hoje.unidades, 6);
  assert.equal(hoje.produtos_vendidos, 2);
  assert.deepEqual(hoje.produtos.map((p) => [p.ean, p.unidades]), [['111', 5], ['222', 1]]);
  assert.equal(hoje.produtos[0].valor_custo_centavos, undefined, 'sem custo para operador');
  const semana = e.ranking('semana', false, agora);
  assert.equal(semana.unidades, 11);
  assert.equal(semana.produtos[0].ean, '222');
  const mes = e.ranking('mes', true, agora);
  assert.equal(mes.unidades, 18);
  assert.equal(mes.produtos[0].ean, '111');
  assert.equal(mes.produtos[0].valor_custo_centavos, 12 * 10 * 100);
  assert.deepEqual(mes.por_dia.map((d) => [d.dia, d.unidades]), [['2026-10-03', 7], ['2026-10-12', 5], ['2026-10-14', 6]]);
  assert.equal(mes.anterior.unidades, 9, 'mês anterior até o mesmo ponto');
});

test('ranking desconta saída estornada e ignora entradas', () => {
  const agora = hora(2026, 10, 14, 15);
  const { e, db } = comSaidasEm([[hora(2026, 10, 14, 9), '111', 4], [hora(2026, 10, 14, 10), '111', 2]]);
  e.movimentar({ tipo: 'entrada', codigo: '111', quantidade: 50, usuario: 'ana' });
  db.prepare('UPDATE movimentacoes SET criado_em = ? WHERE tipo = ?').run(hora(2026, 10, 14, 11), 'entrada');
  const id = db.prepare("SELECT id FROM movimentacoes WHERE tipo = 'saida' ORDER BY id LIMIT 1").get().id;
  e.estornar(id, 'errado', 'ana');
  db.prepare('UPDATE movimentacoes SET criado_em = ? WHERE tipo = ?').run(hora(2026, 10, 14, 12), 'ajuste');
  const r = e.ranking('hoje', false, agora);
  assert.equal(r.unidades, 2);
  assert.deepEqual(r.produtos.map((p) => [p.ean, p.unidades]), [['111', 2]]);
});

test('ranking: saída de kit conta cada produto que saiu', () => {
  const db = abrirBanco(':memory:'); const e = criarEstoque(db);
  e.criarProduto({ ean: '111', nome: 'A', saldo: 10 }, 'x'); e.criarProduto({ ean: '222', nome: 'B', saldo: 10 }, 'x');
  e.criarKit({ codigo: 'KIT-X', nome: 'Kit X', itens: [{ ean: '111', quantidade: 1 }, { ean: '222', quantidade: 2 }] });
  e.movimentar({ tipo: 'saida', codigo: 'KIT-X', quantidade: 1, usuario: 'x' });
  e.movimentar({ tipo: 'saida', codigo: '111', quantidade: 1, usuario: 'x' });
  const r = e.ranking('hoje', false, Date.now());
  assert.equal(r.unidades, 4);
  assert.deepEqual(r.produtos.map((p) => [p.ean, p.unidades]).sort(), [['111', 2], ['222', 2]]);
});

test('ranking rejeita período inválido', () => {
  rejeita(() => novo().ranking('ano'), 'DADO_INVALIDO');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { abrirBanco } = require('../src/db');
const { criarEstoque } = require('../src/estoque');
const { criarBackup, horasDesdeUltimo, iniciarBackupAutomatico } = require('../src/backup');

const pastaTmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'bkp-'));

test('backup gera uma cópia legível do banco, com os dados', () => {
  const origem = path.join(pastaTmp(), 'estoque.db');
  const db = abrirBanco(origem);
  criarEstoque(db).criarProduto({ ean: '1', nome: 'Produto', saldo: 5, preco_custo: '10,00' }, 'ana');
  const pasta = path.join(pastaTmp(), 'novo', 'backups'); // a pasta é criada se não existir
  const arq = criarBackup(db, pasta);
  const copia = criarEstoque(abrirBanco(arq));
  assert.equal(copia.listarProdutos(true)[0].saldo, 5);
  assert.equal(copia.resumoEstoque(true).valor_total_custo_centavos, 5000);
});

test('mantém apenas os backups mais recentes', () => {
  const db = abrirBanco(':memory:');
  const pasta = pastaTmp();
  for (let i = 0; i < 5; i++) criarBackup(db, pasta, 3, new Date(2026, 0, 1 + i, 10, 0));
  const arquivos = fs.readdirSync(pasta).sort();
  assert.equal(arquivos.length, 3);
  assert.match(arquivos[0], /2026-01-03/);
});

test('backup automático roda ao ligar quando não há backup recente, e não repete se há', () => {
  const db = abrirBanco(':memory:');
  const pasta = pastaTmp();
  assert.equal(horasDesdeUltimo(pasta), Infinity);
  const parar = iniciarBackupAutomatico(db, { pasta, horas: 24 });
  assert.equal(fs.readdirSync(pasta).length, 1);
  assert.ok(horasDesdeUltimo(pasta) < 1);
  parar();
  const parar2 = iniciarBackupAutomatico(db, { pasta, horas: 24 }); // já existe um de hoje
  assert.equal(fs.readdirSync(pasta).length, 1);
  parar2();
});

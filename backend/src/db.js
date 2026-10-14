// Banco SQLite (módulo nativo do Node) e criação das tabelas.
const { DatabaseSync } = require('node:sqlite');

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS produtos (
  ean            TEXT PRIMARY KEY,
  nome           TEXT NOT NULL,
  sku            TEXT UNIQUE COLLATE NOCASE,
  localizacao    TEXT NOT NULL DEFAULT '',
  estoque_minimo INTEGER NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
  saldo          INTEGER NOT NULL DEFAULT 0 CHECK (saldo >= 0),
  preco_custo_centavos INTEGER NOT NULL DEFAULT 0 CHECK (preco_custo_centavos >= 0),
  criado_em      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS kits (
  codigo    TEXT PRIMARY KEY,
  nome      TEXT NOT NULL,
  criado_em INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS kit_itens (
  kit_codigo  TEXT NOT NULL REFERENCES kits (codigo) ON DELETE CASCADE,
  produto_ean TEXT NOT NULL REFERENCES produtos (ean),
  quantidade  INTEGER NOT NULL CHECK (quantidade > 0),
  PRIMARY KEY (kit_codigo, produto_ean)
);

-- O nome do produto é copiado para o histórico, que continua legível mesmo se o produto for excluído.
CREATE TABLE IF NOT EXISTS movimentacoes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_ean  TEXT NOT NULL,
  produto_nome TEXT NOT NULL,
  tipo         TEXT NOT NULL CHECK (tipo IN ('entrada','saida','ajuste','inventario')),
  quantidade   INTEGER NOT NULL,
  saldo_apos   INTEGER NOT NULL,
  referencia   TEXT NOT NULL DEFAULT '',
  observacao   TEXT NOT NULL DEFAULT '',
  usuario      TEXT NOT NULL DEFAULT '',
  criado_em    INTEGER NOT NULL,
  grupo        TEXT,
  estorno_de   INTEGER,
  estornado_por INTEGER
);
CREATE INDEX IF NOT EXISTS idx_mov_ean ON movimentacoes (produto_ean);

CREATE TABLE IF NOT EXISTS usuarios (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nome       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  senha_hash TEXT NOT NULL,
  perfil     TEXT NOT NULL CHECK (perfil IN ('admin','operador')),
  ativo      INTEGER NOT NULL DEFAULT 1,
  criado_em  INTEGER NOT NULL
);
`;

// Bancos criados antes do preço de custo ganham a coluna nova, sem perder nenhum dado.
function migrar(db) {
  const tem = (tabela) => db.prepare(`PRAGMA table_info(${tabela})`).all().map((c) => c.name);
  if (!tem('produtos').includes('preco_custo_centavos')) {
    db.exec('ALTER TABLE produtos ADD COLUMN preco_custo_centavos INTEGER NOT NULL DEFAULT 0 CHECK (preco_custo_centavos >= 0)');
  }
  // Estorno: "grupo" liga as linhas de uma saída de kit; "estorno_de"/"estornado_por" ligam o estorno ao lançamento original.
  const mov = tem('movimentacoes');
  for (const [coluna, tipo] of [['grupo', 'TEXT'], ['estorno_de', 'INTEGER'], ['estornado_por', 'INTEGER']]) {
    if (!mov.includes(coluna)) db.exec(`ALTER TABLE movimentacoes ADD COLUMN ${coluna} ${tipo}`);
  }
}

function abrirBanco(arquivo) {
  const db = new DatabaseSync(arquivo);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (arquivo !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(ESQUEMA);
  migrar(db);
  return db;
}

// Executa tudo ou nada: se algo falhar, nenhuma alteração é gravada.
function transacao(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* já encerrada */ }
    throw e;
  }
}

module.exports = { abrirBanco, transacao };

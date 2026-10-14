// Uso: npm run criar-usuario -- <nome> <senha> [admin|operador]
const config = require('../src/config');
const { abrirBanco } = require('../src/db');
const { criarUsuarios } = require('../src/usuarios');

const [nome, senha, perfil = 'operador'] = process.argv.slice(2);
if (!nome || !senha) {
  console.error('Uso: npm run criar-usuario -- <nome> <senha> [admin|operador]');
  process.exit(1);
}
try {
  const db = abrirBanco(config.dbArquivo);
  const u = criarUsuarios(db).criar({ nome, senha, perfil });
  console.log(`Usuário criado: ${u.nome} (${u.perfil})`);
  db.close();
} catch (e) {
  console.error('Erro:', e.message);
  process.exit(1);
}

// Uso: npm run backup [-- <pasta-destino>]
// Cria uma cópia consistente do banco (mesmo com o servidor ligado) e mantém as 30 mais recentes.
const path = require('node:path');
const config = require('../src/config');
const { abrirBanco } = require('../src/db');
const { criarBackup } = require('../src/backup');

const destino = path.resolve(process.argv[2] || config.backupDir);
const db = abrirBanco(config.dbArquivo);
const arquivo = criarBackup(db, destino, config.backupManter);
db.close();
console.log('Backup criado:', arquivo);

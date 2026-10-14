// Ponto de entrada: abre o banco, sobe o servidor e mostra os endereços de acesso.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const config = require('./config');
const { abrirBanco } = require('./db');
const { criarServidor } = require('./app');
const { criarUsuarios } = require('./usuarios');
const { iniciarBackupAutomatico } = require('./backup');

// Na primeira vez, tenta gerar o certificado HTTPS sozinho (precisa do OpenSSL do Git para Windows).
// Se não conseguir, o sistema sobe normalmente só com HTTP. Para desligar: HTTPS=desligado no .env.
if (config.httpsDesligado !== true && !fs.existsSync(path.join(config.certsDir, 'servidor.crt'))) {
  try {
    require('node:child_process').execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'gerar-certificado.js')], { stdio: 'pipe', timeout: 60000 });
    console.log('Certificado HTTPS criado automaticamente.');
  } catch (e) { console.log('HTTPS não configurado (OpenSSL não encontrado). Instale o Git para Windows e reinicie; o sistema segue só com HTTP.'); }
}

const db = abrirBanco(config.dbArquivo);
const servidor = criarServidor({ db, segredo: config.jwtSegredo, tokenHoras: config.tokenHoras, frontendDir: config.frontendDir, caArquivo: fs.existsSync(path.join(config.certsDir, 'ca.crt')) ? path.join(config.certsDir, 'ca.crt') : null });

iniciarBackupAutomatico(db, { pasta: config.backupDir, horas: config.backupHoras, manter: config.backupManter });
console.log(`Backup automático ligado: a cada ${config.backupHoras}h em ${config.backupDir}`);

servidor.listen(config.porta, config.host, () => {
  console.log('Controle de Estoque no ar.');
  console.log(`  Neste computador: http://localhost:${config.porta}`);
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const i of lista || []) {
      if (i.family === 'IPv4' && !i.internal) console.log(`  Na rede da empresa: http://${i.address}:${config.porta}`);
    }
  }
  iniciarHttps();
  if (criarUsuarios(db).quantos() === 0) {
    console.log('\nAtenção: nenhum usuário cadastrado. Crie o administrador com:');
    console.log('  npm run criar-usuario -- admin SUA-SENHA admin');
  }
});

// HTTPS na rede interna: sobe junto com o HTTP quando o certificado foi gerado (npm run gerar-certificado).
let servidorHttps = null;
function iniciarHttps() {
  const chave = path.join(config.certsDir, 'servidor.key');
  const cert = path.join(config.certsDir, 'servidor.crt');
  if (!fs.existsSync(chave) || !fs.existsSync(cert)) {
    console.log('  HTTPS desligado (para ligar: npm run gerar-certificado e reiniciar).');
    return;
  }
  try {
    servidorHttps = https.createServer({ key: fs.readFileSync(chave), cert: fs.readFileSync(cert) }, servidor.tratador);
    servidorHttps.on('error', (e) => console.log(`  HTTPS não iniciou: ${e.message}`));
    servidorHttps.listen(config.httpsPorta, config.host, () => {
      for (const lista of Object.values(os.networkInterfaces())) {
        for (const i of lista || []) {
          if (i.family === 'IPv4' && !i.internal) console.log(`  HTTPS (câmera do celular): https://${i.address}:${config.httpsPorta}`);
        }
      }
    });
  } catch (e) { console.log(`  HTTPS não iniciou: ${e.message}`); }
}

function encerrar() {
  if (servidorHttps) servidorHttps.close();
  servidor.close(() => { db.close(); process.exit(0); });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);

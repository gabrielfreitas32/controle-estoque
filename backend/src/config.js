// Configuração: lê o arquivo .env (se existir) e as variáveis de ambiente.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const raiz = path.join(__dirname, '..');

function lerEnv() {
  const arquivo = path.join(raiz, '.env');
  const env = {};
  if (!fs.existsSync(arquivo)) return env;
  for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    if (linha.trim().startsWith('#')) continue;
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = { ...lerEnv(), ...process.env };
const dadosDir = path.resolve(raiz, env.DATA_DIR || 'data');
fs.mkdirSync(dadosDir, { recursive: true });

// Sem JWT_SECRET definido, gera um segredo aleatório e o guarda em data/jwt.secret
function segredoJwt() {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  const arquivo = path.join(dadosDir, 'jwt.secret');
  if (fs.existsSync(arquivo)) return fs.readFileSync(arquivo, 'utf8').trim();
  const segredo = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(arquivo, segredo, { mode: 0o600 });
  return segredo;
}

module.exports = {
  porta: Number(env.PORT || 3000),
  host: env.HOST || '0.0.0.0',
  dadosDir,
  dbArquivo: path.join(dadosDir, 'estoque.db'),
  jwtSegredo: segredoJwt(),
  tokenHoras: Number(env.TOKEN_HORAS || 12),
  // Backup automático (BACKUP_DIR no .env muda a pasta; BACKUP_HORAS o intervalo; BACKUP_MANTER quantos guardar)
  backupDir: path.resolve(raiz, env.BACKUP_DIR || env.BACKUP_PASTA || path.join(dadosDir, 'backups')),
  backupHoras: Number(env.BACKUP_HORAS || 24),
  backupManter: Number(env.BACKUP_MANTER || 30),
  // HTTPS (opcional): ligado quando existem servidor.key e servidor.crt em <dados>/certs (npm run gerar-certificado)
  httpsDesligado: env.HTTPS === 'desligado',
  httpsPorta: Number(env.HTTPS_PORT || 3443),
  certsDir: path.join(dadosDir, 'certs'),
  frontendDir: path.resolve(raiz, '..', 'frontend'),
};

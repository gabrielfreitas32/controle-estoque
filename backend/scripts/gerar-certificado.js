// Gera o certificado HTTPS da rede interna (precisa do OpenSSL, que acompanha o Git para Windows).
// 1ª vez: cria uma "autoridade" própria (ca.crt) + o certificado do servidor com os IPs deste computador.
// Depois: só refaz o certificado do servidor e REAPROVEITA a autoridade, então o celular não precisa reinstalar nada.
// Uso: npm run gerar-certificado [-- 192.168.0.50 outro-nome]   (argumentos extras = IPs/nomes adicionais)
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const config = require('../src/config');

function acharOpenssl() {
  const candidatos = ['openssl'];
  if (process.platform === 'win32') {
    for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs')].filter(Boolean)) {
      candidatos.push(path.join(base, 'Git', 'usr', 'bin', 'openssl.exe'), path.join(base, 'Git', 'mingw64', 'bin', 'openssl.exe'));
    }
  }
  for (const c of candidatos) {
    try { execFileSync(c, ['version'], { stdio: 'ignore' }); return c; } catch { /* tenta o próximo */ }
  }
  return null;
}

const openssl = acharOpenssl();
if (!openssl) {
  console.error('OpenSSL não encontrado. Instale o Git para Windows (https://git-scm.com), que já traz o OpenSSL, e rode de novo.');
  process.exit(1);
}

const ips = new Set(['127.0.0.1']);
for (const lista of Object.values(os.networkInterfaces())) for (const i of lista || []) if (i.family === 'IPv4' && !i.internal) ips.add(i.address);
const nomes = new Set(['localhost', os.hostname()]);
for (const extra of process.argv.slice(2)) (/^\d+\.\d+\.\d+\.\d+$/.test(extra) ? ips : nomes).add(extra);

const dir = config.certsDir;
fs.mkdirSync(dir, { recursive: true });
const f = (n) => path.join(dir, n);
const rodar = (...args) => execFileSync(openssl, args, { stdio: 'pipe' });

if (!fs.existsSync(f('ca.key')) || !fs.existsSync(f('ca.crt'))) {
  fs.writeFileSync(f('ca.cnf'), '[req]\ndistinguished_name=dn\nprompt=no\nx509_extensions=ext\n[dn]\nCN=Controle de Estoque - Autoridade local\nO=Controle de Estoque\n[ext]\nbasicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\n');
  rodar('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', f('ca.key'), '-out', f('ca.crt'), '-days', '3650', '-sha256', '-config', f('ca.cnf'));
  console.log('Autoridade local criada (vale 10 anos).');
} else {
  console.log('Autoridade local já existente: será reaproveitada (o celular não precisa reinstalar).');
}

const san = [...[...nomes].map((n) => `DNS:${n}`), ...[...ips].map((i) => `IP:${i}`)].join(',');
fs.writeFileSync(f('servidor.cnf'), `[req]\ndistinguished_name=dn\nprompt=no\n[dn]\nCN=Controle de Estoque\n[ext]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=${san}\n`);
rodar('req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', f('servidor.key'), '-out', f('servidor.csr'), '-config', f('servidor.cnf'));
// iOS exige validade de no máximo 825 dias para certificados de servidor
rodar('x509', '-req', '-in', f('servidor.csr'), '-CA', f('ca.crt'), '-CAkey', f('ca.key'), '-CAcreateserial', '-out', f('servidor.crt'), '-days', '800', '-sha256', '-extfile', f('servidor.cnf'), '-extensions', 'ext');
for (const lixo of ['servidor.csr', 'ca.cnf', 'servidor.cnf', 'ca.srl']) fs.rmSync(f(lixo), { force: true });

console.log(`\nCertificado do servidor criado (vale 800 dias) para: ${san}`);
console.log(`Arquivos em: ${dir}`);
console.log('\nPróximos passos:');
console.log('  1. Reinicie o sistema (parar-estoque.bat e abrir de novo).');
console.log(`  2. No celular, abra http://${[...ips].find((i) => i !== '127.0.0.1') || 'IP-DO-PC'}:${config.porta}/estoque-ca.crt e instale o certificado (veja docs/https-celular.md).`);
console.log(`  3. Libere a porta ${config.httpsPorta} no Firewall do Windows (veja docs/https-celular.md).`);
console.log('IMPORTANTE: não copie nem envie a pasta certs; o arquivo ca.key é a chave da autoridade.');

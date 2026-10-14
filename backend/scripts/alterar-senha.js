// Uso: npm run alterar-senha -- <usuario> [nova-senha]
// Sem a nova senha na linha de comando, o script pergunta (a digitação fica oculta).
const config = require('../src/config');
const { abrirBanco } = require('../src/db');
const { hashSenha } = require('../src/auth');

function lerSenhaOculta(pergunta) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      console.error('Não foi possível pedir a senha aqui. Informe-a na linha de comando.');
      process.exit(1);
    }
    process.stdout.write(pergunta);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let texto = '';
    const aoDigitar = (teclas) => {
      for (const t of teclas) {
        if (t === '\r' || t === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', aoDigitar);
          process.stdout.write('\n');
          return resolve(texto);
        }
        if (t === '\u0003') process.exit(1); // Ctrl+C
        if (t === '\u007f' || t === '\b') texto = texto.slice(0, -1);
        else texto += t;
      }
    };
    stdin.on('data', aoDigitar);
  });
}

async function principal() {
  const [nome, senhaInformada] = process.argv.slice(2);
  if (!nome) {
    console.error('Uso: npm run alterar-senha -- <usuario> [nova-senha]');
    process.exit(1);
  }
  const db = abrirBanco(config.dbArquivo);
  const usuario = db.prepare('SELECT id, nome FROM usuarios WHERE nome = ?').get(nome);
  if (!usuario) {
    console.error('Usuário não encontrado: ' + nome);
    process.exit(1);
  }

  let senha = senhaInformada;
  if (senha === undefined) {
    senha = await lerSenhaOculta(`Nova senha para ${usuario.nome}: `);
    const repeticao = await lerSenhaOculta('Repita a nova senha: ');
    if (senha !== repeticao) {
      console.error('As senhas não conferem. Nada foi alterado.');
      process.exit(1);
    }
  }
  if (senha.length < 8) {
    console.error('A senha deve ter pelo menos 8 caracteres. Nada foi alterado.');
    process.exit(1);
  }

  db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hashSenha(senha), usuario.id);
  db.close();
  console.log(`Senha de "${usuario.nome}" alterada com sucesso.`);
}

principal();

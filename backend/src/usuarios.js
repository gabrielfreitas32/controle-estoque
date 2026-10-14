// Usuários e perfis. admin: tudo. operador: bipar (entrada/saída) e consultar.
const { ErroNegocio } = require('./errors');
const { hashSenha, conferirSenha } = require('./auth');

const PERFIS = ['admin', 'operador'];
const MIN_SENHA = 8;

function validarSenha(senha) {
  if (senha.length < MIN_SENHA) throw new ErroNegocio(`A senha deve ter pelo menos ${MIN_SENHA} caracteres.`, { codigo: 'DADO_INVALIDO' });
  if (senha.length > 200) throw new ErroNegocio('A senha é grande demais.', { codigo: 'DADO_INVALIDO' });
}

function criarUsuarios(db) {
  const porNome = db.prepare('SELECT * FROM usuarios WHERE nome = ?');
  const porId = db.prepare('SELECT * FROM usuarios WHERE id = ?');
  const inserir = db.prepare('INSERT INTO usuarios (nome, senha_hash, perfil, ativo, criado_em) VALUES (?, ?, ?, 1, ?)');
  const todos = db.prepare('SELECT id, nome, perfil, ativo, criado_em FROM usuarios ORDER BY nome');
  const gravarSenha = db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?');
  const gravarAtivo = db.prepare('UPDATE usuarios SET ativo = ? WHERE id = ?');
  const adminsAtivos = db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE perfil = 'admin' AND ativo = 1");
  const existente = (id) => {
    const u = porId.get(id);
    if (!u) throw new ErroNegocio('Usuário não encontrado.', { status: 404, codigo: 'NAO_ENCONTRADO' });
    return u;
  };
  const contar = db.prepare('SELECT COUNT(*) AS n FROM usuarios');
  // Hash usado quando o usuário não existe, para o tempo de resposta não revelar isso.
  const hashFalso = hashSenha('senha-falsa-para-igualar-o-tempo');

  return {
    criar({ nome, senha, perfil }) {
      nome = String(nome ?? '').trim();
      senha = String(senha ?? '');
      if (nome.length < 3 || nome.length > 40) throw new ErroNegocio('O nome de usuário deve ter de 3 a 40 caracteres.', { codigo: 'DADO_INVALIDO' });
      validarSenha(senha);
      if (!PERFIS.includes(perfil)) throw new ErroNegocio('Perfil inválido. Use admin ou operador.', { codigo: 'DADO_INVALIDO' });
      if (porNome.get(nome)) throw new ErroNegocio('Já existe um usuário com esse nome.', { status: 409, codigo: 'USUARIO_EXISTE' });
      inserir.run(nome, hashSenha(senha), perfil, Date.now());
      return { nome, perfil };
    },
    autenticar(nome, senha) {
      const u = porNome.get(String(nome ?? '').trim());
      const ok = conferirSenha(String(senha ?? ''), u ? u.senha_hash : hashFalso);
      return u && u.ativo && ok ? { id: u.id, nome: u.nome, perfil: u.perfil } : null;
    },
    porId(id) {
      const u = porId.get(id);
      return u && u.ativo ? { id: u.id, nome: u.nome, perfil: u.perfil } : null;
    },
    // O próprio usuário troca a senha: precisa informar a atual.
    alterarMinhaSenha(id, atual, nova) {
      const u = existente(id);
      nova = String(nova ?? '');
      if (!conferirSenha(String(atual ?? ''), u.senha_hash)) {
        throw new ErroNegocio('A senha atual está incorreta.', { status: 400, codigo: 'SENHA_ATUAL_INCORRETA' });
      }
      validarSenha(nova);
      if (nova === String(atual)) throw new ErroNegocio('A nova senha precisa ser diferente da atual.', { codigo: 'DADO_INVALIDO' });
      gravarSenha.run(hashSenha(nova), id);
      return { ok: true };
    },
    // O administrador define uma nova senha para outro usuário (esqueceu a senha, por exemplo).
    definirSenha(id, nova) {
      const u = existente(id);
      nova = String(nova ?? '');
      validarSenha(nova);
      gravarSenha.run(hashSenha(nova), u.id);
      return { ok: true };
    },
    definirAtivo(id, ativo, solicitanteId) {
      const u = existente(id);
      if (!ativo) {
        if (id === solicitanteId) throw new ErroNegocio('Você não pode desativar o seu próprio usuário.', { status: 409, codigo: 'REGRA_NEGOCIO' });
        if (u.perfil === 'admin' && u.ativo && adminsAtivos.get().n <= 1) {
          throw new ErroNegocio('Precisa existir pelo menos um administrador ativo.', { status: 409, codigo: 'REGRA_NEGOCIO' });
        }
      }
      gravarAtivo.run(ativo ? 1 : 0, id);
      return { ok: true };
    },
    listar: () => todos.all().map((u) => ({ ...u, ativo: !!u.ativo })),
    quantos: () => contar.get().n,
  };
}

module.exports = { criarUsuarios, PERFIS };

// Senhas (mostrar/ocultar, alterar a própria senha) e tela de usuários (somente administrador).

/* ---------- Mostrar / ocultar o que está sendo digitado ---------- */
function ajustarOlho(btn, visivel) {
  btn.textContent = visivel ? 'Ocultar' : 'Mostrar';
  btn.setAttribute('aria-pressed', String(visivel));
  btn.setAttribute('aria-label', visivel ? 'Ocultar senha' : 'Mostrar senha');
}
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.eye');
  if (!btn) return;
  const campo = btn.parentElement.querySelector('input');
  const visivel = campo.type === 'password';
  campo.type = visivel ? 'text' : 'password';
  ajustarOlho(btn, visivel);
  campo.focus();
});
function ocultarSenhas(raiz) {
  raiz.querySelectorAll('.pw input').forEach((i) => { i.type = 'password'; });
  raiz.querySelectorAll('.eye').forEach((b) => ajustarOlho(b, false));
}

/* ---------- Janela de senha: a própria (pede a atual) ou a de outro usuário (administrador) ---------- */
let alvoSenha = null; // null = minha senha; { id, nome } = administrador redefinindo

function abrirSenha(alvo) {
  alvoSenha = alvo;
  const dlg = $('#dSenha');
  $('#dTitulo').textContent = alvo ? 'Nova senha de ' + alvo.nome : 'Alterar minha senha';
  $('#dAtualBox').hidden = !!alvo;
  ['#sAtual', '#sNova', '#sConf'].forEach((s) => { $(s).value = ''; });
  $('#sFb').hidden = true;
  ocultarSenhas(dlg);
  dlg.showModal();
  (alvo ? $('#sNova') : $('#sAtual')).focus();
}

$('#bSenha').onclick = () => abrirSenha(null);
$('#sCancelar').onclick = () => $('#dSenha').close();
$('#dSenha').addEventListener('close', () => { if (tab === 'bipar') $('#scan').focus(); });

$('#fSenha').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = $('#sFb');
  const nova = $('#sNova').value;
  if (nova.length < 8) return fb(f, 'A nova senha deve ter pelo menos 8 caracteres.', 0, 1);
  if (nova !== $('#sConf').value) return fb(f, 'As duas senhas digitadas não são iguais.', 0, 1);
  try {
    if (alvoSenha) await api('PUT', '/usuarios/' + alvoSenha.id + '/senha', { nova });
    else await api('POST', '/auth/senha', { atual: $('#sAtual').value, nova });
    const msg = alvoSenha ? 'Senha de ' + alvoSenha.nome + ' redefinida.' : 'Senha alterada.';
    $('#dSenha').close();
    if (tab === 'usuarios') fb($('#uFb'), '✔ ' + esc(msg), 1);
    else if (tab === 'bipar') fb($('#fb'), '✔ ' + esc(msg), 1);
  } catch (err) { fb(f, esc(err.message), 0, 1); }
});

/* ---------- Tela Usuários ---------- */
async function usuariosTela() {
  try {
    const lista = await api('GET', '/usuarios');
    $('#uList').innerHTML = '<tr><th>Usuário</th><th>Perfil</th><th>Situação</th><th>Criado em</th><th>Ações</th></tr>' +
      lista.map((u) => {
        const eu = u.nome === usuario.nome;
        return `<tr><td><b>${esc(u.nome)}</b>${eu ? ' <span class="note">(você)</span>' : ''}</td>` +
          `<td>${u.perfil === 'admin' ? 'Administrador' : 'Operador'}</td>` +
          `<td><span class="tag ${u.ativo ? '' : 'zero'}">${u.ativo ? 'Ativo' : 'Desativado'}</span></td>` +
          `<td>${fmt(u.criado_em)}</td>` +
          `<td><button class="b g mini" data-senha="${u.id}" data-nome="${esc(u.nome)}">Redefinir senha</button>` +
          (eu ? '' : `<button class="b g mini" data-ativo="${u.id}" data-novo="${u.ativo ? 0 : 1}">${u.ativo ? 'Desativar' : 'Reativar'}</button>`) + '</td></tr>';
      }).join('');
  } catch (e) { fb($('#uFb'), esc(e.message), 0); }
}

$('#uList').onclick = async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.senha) return abrirSenha({ id: b.dataset.senha, nome: b.dataset.nome });
  if (b.dataset.ativo) {
    if (b.dataset.novo === '0' && b.textContent === 'Desativar') { b.textContent = 'Confirmar'; return; }
    try {
      await api('PUT', '/usuarios/' + b.dataset.ativo + '/ativo', { ativo: b.dataset.novo === '1' });
      fb($('#uFb'), '✔ Usuário atualizado.', 1);
    } catch (err) { fb($('#uFb'), esc(err.message), 0); }
    usuariosTela();
  }
};

$('#uSave').onclick = async () => {
  const f = $('#uFb');
  try {
    const nome = $('#uNome').value.trim();
    await api('POST', '/usuarios', { nome, senha: $('#uSenha').value, perfil: $('#uPerfil').value });
    $('#uNome').value = ''; $('#uSenha').value = '';
    ocultarSenhas($('#t-usuarios'));
    fb(f, '✔ Usuário criado: ' + esc(nome), 1);
    usuariosTela();
  } catch (e) { fb(f, esc(e.message), 0); }
};

// Login, navegação entre abas e inicialização. Deve ser o último script carregado.
const ABAS = ['bipar', 'estoque', 'ranking', 'cadastro', 'hist', 'inv', 'usuarios'];

async function go(t) {
  if (!ehAdmin() && ['cadastro', 'inv', 'usuarios'].includes(t)) t = 'bipar';
  tab = t;
  ABAS.forEach((x) => { $('#t-' + x).hidden = x !== t; });
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
  try { if (t !== 'bipar' && t !== 'hist' && t !== 'ranking') await carregar(); } catch (e) { /* api() já trata sessão expirada */ }
  if (tab !== t) return; // o usuário trocou de aba enquanto carregava
  if (t === 'bipar') { recent(); $('#scan').focus(); marcarLeitor(); }
  if (t === 'estoque') stock();
  if (t === 'cadastro') { kitRows(); kitList(); }
  if (t === 'hist') hist();
  if (t === 'ranking') ranking();
  if (t === 'inv') { ctab(); $('#cscan').focus(); }
  if (t === 'usuarios') usuariosTela();
}
$('#nav').onclick = (e) => { if (e.target.dataset.t) go(e.target.dataset.t); };

function mostrarLogin() {
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#lUser').focus();
}

function sair() {
  guardarToken(null);
  usuario = null;
  S = { products: {}, kits: {} };
  mostrarLogin();
}
$('#sair').onclick = sair;

async function entrar() {
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#quemNome').textContent = usuario.nome;
  $('#quemPerfil').textContent = usuario.perfil === 'admin' ? 'Administrador' : 'Operador';
  $('#avatar').textContent = usuario.nome.charAt(0).toUpperCase();
  document.querySelectorAll('[data-admin]').forEach((el) => { el.hidden = !ehAdmin(); });
  setMode('saida');
  await go('bipar');
}

$('#lForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const r = await api('POST', '/auth/login', { nome: $('#lUser').value.trim(), senha: $('#lSenha').value });
    guardarToken(r.token);
    usuario = r.usuario;
    $('#lSenha').value = '';
    $('#lFb').hidden = true;
    entrar();
  } catch (err) { fb($('#lFb'), esc(err.message), 0, 1); }
});

// Clicar fora de um campo na aba Bipar devolve o foco ao leitor.
document.addEventListener('click', (e) => {
  if (tab === 'bipar' && !$('#app').hidden && !['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) $('#scan').focus();
});

// Leitor = teclado que digita muito rápido. Se o foco não estiver num campo de texto, o primeiro
// caractere bipado leva o foco ao campo certo (sem perder o código inteiro).
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1 || $('#app').hidden) return;
  const alvo = tab === 'bipar' ? $('#scan') : tab === 'inv' ? $('#cscan') : null;
  if (alvo && !CAMPOS_TEXTO.includes(document.activeElement.tagName)) alvo.focus();
}, true);

// Ao abrir: se houver login válido guardado, entra direto.
(async () => {
  if (!token) return mostrarLogin();
  try { usuario = await api('GET', '/auth/eu'); entrar(); } catch (e) { mostrarLogin(); }
})();

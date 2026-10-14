// Tela Bipar: envia cada bipe ao servidor, que valida o saldo e grava a movimentação.
let fila = Promise.resolve(); // bipes são processados em ordem, sem perder nenhum

function setMode(m) {
  mode = m;
  $('#mIn').classList.toggle('on', m === 'entrada');
  $('#mOut').classList.toggle('on', m === 'saida');
  $('#scan').focus();
}
$('#mIn').onclick = () => setMode('entrada');
$('#mOut').onclick = () => setMode('saida');

/* ---------- Leitor pronto? O código bipado só entra se o campo de bipagem estiver com o foco ---------- */
const CAMPOS_TEXTO = ['INPUT', 'SELECT', 'TEXTAREA'];

function marcarLeitor() {
  const ativo = tab === 'bipar' && document.activeElement === $('#scan') && document.hasFocus();
  $('#leitor').className = 'leitor ' + (ativo ? 'ok' : 'off');
  $('#leitor').textContent = ativo ? '● Leitor pronto (v3): pode bipar' : '○ Leitor inativo (v3): clique aqui ou aperte qualquer tecla';
}

// Se o foco ficou num botão ou na página (não num campo de texto), devolve ao campo de bipagem.
function refocarLeitor() {
  if (tab !== 'bipar' || $('#app').hidden) return;
  if (!CAMPOS_TEXTO.includes(document.activeElement.tagName)) $('#scan').focus();
}

$('#leitor').onclick = () => $('#scan').focus();
$('#scan').addEventListener('focus', marcarLeitor);
$('#scan').addEventListener('blur', () => setTimeout(() => { refocarLeitor(); marcarLeitor(); }, 0));
window.addEventListener('focus', () => { refocarLeitor(); marcarLeitor(); });
window.addEventListener('blur', marcarLeitor);

// Enter na quantidade ou na referência devolve o foco ao campo de bipagem.
['#qty', '#ref'].forEach((sel) => $(sel).addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('#scan').focus(); }
}));

async function recent() {
  try {
    const l = (await api('GET', '/movimentacoes?limite=8')).map(dMov);
    $('#recent').innerHTML = '<tr><th>Hora</th><th>Tipo</th><th>Produto</th><th>Qtd</th><th>Saldo</th><th>Ref.</th></tr>' +
      l.map((m) => `<tr><td>${fmt(m.t)}</td><td>${rotuloTipo(m)}</td><td>${esc(m.name)}</td><td class="${m.q < 0 ? 'neg' : 'pos'}">${m.q > 0 ? '+' : ''}${m.q}</td><td>${m.bal}</td><td>${esc(m.ref)}</td></tr>`).join('');
  } catch (e) { /* mantém a tabela anterior */ }
}

// Guarda as últimas tentativas na tela: o que foi lido e se foi aceito ou recusado (e por quê).
const tentativas = [];
function anotar(ok, codigo, texto, ms) {
  const p = document.getElementById('proc'); if (p) p.remove();
  tentativas.unshift({ ok, codigo, texto, ms, hora: new Date().toLocaleTimeString('pt-BR') });
  tentativas.length = Math.min(tentativas.length, 5);
  $('#tent').innerHTML = tentativas.map((t) =>
    `<div class="${t.ok ? 'bom' : 'ruim'}">${t.ok ? '✔' : '✖ RECUSADO'} ${t.hora} · código ${esc(t.codigo)} · ${esc(t.texto)}${t.ms != null ? " · " + t.ms + " ms" : ""}</div>`).join('');
}

async function processarBipe(codigo, quantidade, referencia, modo) {
  const f = $('#fb');
  const t0 = performance.now();
  $('#tent').insertAdjacentHTML('afterbegin', '<div id="proc">⏳ Registrando ' + esc(codigo) + '…</div>');
  try {
    const r = await api('POST', '/movimentacoes', { tipo: modo, codigo, quantidade, referencia });
    anotar(true, codigo, r.mensagem, Math.round(performance.now() - t0));
    beep(1);
    fb(f, '✔ ' + esc(r.mensagem), 1, 1);
    recent();
  } catch (e) {
    anotar(false, codigo, e.message, Math.round(performance.now() - t0));
    beep(0);
    if (e.codigo === 'NAO_CADASTRADO' && ehAdmin()) {
      fb(f, esc(e.message) + ' <button class="b" style="margin:0 0 0 8px;padding:4px 10px" id="goReg">Cadastrar</button>', 0, 1);
      $('#goReg').onclick = () => { go('cadastro'); fillForm({ ean: codigo, name: '', sku: '', loc: '', min: 0, qty: 0 }, true); $('#pName').focus(); };
    } else {
      fb(f, esc(e.message), 0, 1);
    }
  }
  $('#scan').focus();
}

// Usado pelo leitor USB (campo de bipagem) e pela câmera: coloca o código na fila de registro.
function registrarCodigo(codigo) {
  const quantidade = Math.max(1, parseInt($('#qty').value, 10) || 1);
  const referencia = $('#ref').value.trim();
  const modo = mode;
  $('#lido').textContent = 'Último código lido: ' + codigo + ' (' + codigo.length + ' caracteres)';
  $('#qty').value = 1;
  fila = fila.then(() => processarBipe(codigo, quantidade, referencia, modo)).catch(() => {});
}

$('#scan').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const codigo = e.target.value.trim();
  if (!codigo) return;
  e.target.value = '';
  registrarCodigo(codigo);
});

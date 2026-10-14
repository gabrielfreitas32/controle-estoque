// Tela Histórico: movimentações com filtro (a busca é feita no servidor) e estorno (somente administrador).
let tempoBusca;
let estornando = null; // lançamento escolhido para estornar

function rotuloTipo(m) { return m.estornoDe ? 'Estorno' : TN[m.type]; }

async function hist() {
  const q = $('#hq').value.trim();
  const adm = ehAdmin();
  try {
    const l = (await api('GET', '/movimentacoes?limite=300' + (q ? '&busca=' + encodeURIComponent(q) : ''))).map(dMov);
    const acao = (m) => {
      if (m.estornadoPor) return '<span class="tag">Estornado</span>';
      if (m.estornoDe) return `<span class="note">estorno de #${m.estornoDe}</span>`;
      return (m.type === 'entrada' || m.type === 'saida') ? `<button class="b g mini" data-estornar="${m.id}">Estornar</button>` : '';
    };
    $('#hist').innerHTML = '<tr><th>Data/hora</th><th>Tipo</th><th>Produto</th><th>EAN</th><th>Qtd</th><th>Saldo após</th><th>Referência</th><th>Usuário</th><th>Obs.</th>' + (adm ? '<th class="acao"></th>' : '') + '</tr>' +
      (l.map((m) => `<tr class="${m.estornadoPor ? 'estornado' : ''}"><td>${fmt(m.t)}</td><td>${rotuloTipo(m)}</td><td>${esc(m.name)}</td><td>${esc(m.ean)}</td><td class="${m.q < 0 ? 'neg' : 'pos'}">${m.q > 0 ? '+' : ''}${m.q}</td><td>${m.bal}</td><td>${esc(m.ref)}</td><td>${esc(m.user)}</td><td>${esc(m.note)}</td>${adm ? '<td class="acao">' + acao(m) + '</td>' : ''}</tr>`).join('')
        || `<tr><td colspan="${adm ? 10 : 9}" class="note">Sem movimentações.</td></tr>`);
    estornando = null;
    window._histLista = l;
  } catch (e) { /* mantém a tabela anterior */ }
}

$('#hq').oninput = () => { clearTimeout(tempoBusca); tempoBusca = setTimeout(hist, 250); };

/* ---------- Estorno ---------- */
$('#hist').onclick = (e) => {
  const b = e.target.closest('button[data-estornar]');
  if (!b) return;
  const m = (window._histLista || []).find((x) => String(x.id) === b.dataset.estornar);
  if (!m) return;
  estornando = m;
  $('#eResumo').textContent = `${rotuloTipo(m)} de ${Math.abs(m.q)} × ${m.name}` + (m.note && m.note.startsWith('Kit ') ? ` (${m.note}: o estorno desfaz todas as linhas do kit)` : '') + '. O lançamento original continua no histórico, marcado como estornado.';
  $('#eMotivo').value = '';
  $('#eFb').hidden = true;
  $('#dEstorno').showModal();
  $('#eMotivo').focus();
};
$('#eCancelar').onclick = () => $('#dEstorno').close();

$('#fEstorno').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!estornando) return;
  const motivo = $('#eMotivo').value.trim();
  if (motivo.length < 3) return fb($('#eFb'), 'Informe o motivo do estorno (pelo menos 3 caracteres).', 0, 1);
  try {
    const r = await api('POST', '/movimentacoes/' + estornando.id + '/estorno', { motivo });
    $('#dEstorno').close();
    await carregar();
    await hist();
    fb($('#hFb'), '✔ ' + esc(r.mensagem), 1);
  } catch (err) { fb($('#eFb'), esc(err.message), 0, 1); }
});

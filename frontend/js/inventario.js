// Tela Inventário (somente administrador): contagem bipada e aplicação dos ajustes.
function ctab() {
  const eans = Object.keys(count);
  $('#ctab').innerHTML = '<tr><th>Produto</th><th>Sistema</th><th>Contado</th><th>Diferença</th></tr>' +
    (eans.map((e) => {
      const p = S.products[e];
      const d = count[e] - p.qty;
      return `<tr><td>${esc(p.name)}</td><td>${p.qty}</td><td><b>${count[e]}</b></td><td class="${d < 0 ? 'neg' : d > 0 ? 'pos' : ''}">${d > 0 ? '+' : ''}${d}</td></tr>`;
    }).join('') || '<tr><td colspan="4" class="note">Nenhum item contado ainda.</td></tr>');
}

$('#cscan').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const p = find(e.target.value);
  const f = $('#cfb');
  if (!p) { beep(0); fb(f, 'EAN não cadastrado: ' + esc(e.target.value), 0); e.target.select(); return; }
  count[p.ean] = (count[p.ean] || 0) + 1;
  beep(1);
  fb(f, '✔ ' + esc(p.name) + ': ' + count[p.ean], 1);
  e.target.value = '';
  ctab();
});

$('#cApply').onclick = async () => {
  const contagens = Object.entries(count).map(([ean, quantidade]) => ({ ean, quantidade }));
  if (!contagens.length) return fb($('#cfb'), 'Nenhum item contado.', 0);
  try {
    const r = await api('POST', '/inventario', { contagens });
    count = {};
    await carregar();
    ctab();
    fb($('#cfb'), '✔ Inventário aplicado: ' + r.ajustes + ' ajuste(s).', 1);
  } catch (e) { fb($('#cfb'), esc(e.message), 0); }
};

$('#cClear').onclick = () => { count = {}; ctab(); };

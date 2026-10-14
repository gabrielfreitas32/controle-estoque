// Tela Cadastro (somente administrador): produtos e kits.
const PRODUTO_VAZIO = { ean: '', name: '', sku: '', loc: '', min: 0, qty: 0, cost: 0 };

function fillForm(p, isNew) {
  editing = isNew ? null : p.ean;
  delArm = false;
  $('#pTitle').textContent = editing ? 'Editar produto' : 'Novo produto';
  $('#pEan').value = p.ean; $('#pName').value = p.name; $('#pSku').value = p.sku || '';
  $('#pLoc').value = p.loc || ''; $('#pMin').value = p.min || 0; $('#pQty').value = p.qty || 0;
  $('#pCost').value = p.cost ? (p.cost / 100).toFixed(2).replace('.', ',') : '';
  $('#pDel').hidden = !editing;
  $('#pDel').textContent = 'Excluir';
  $('#pEan').readOnly = !!editing;
}

$('#pClear').onclick = () => { fillForm(PRODUTO_VAZIO, true); $('#pFb').hidden = true; };

$('#pSave').onclick = async () => {
  const f = $('#pFb');
  const dados = {
    ean: $('#pEan').value.trim(), nome: $('#pName').value.trim(), sku: $('#pSku').value.trim(),
    localizacao: $('#pLoc').value.trim(), estoque_minimo: $('#pMin').value, saldo: $('#pQty').value,
    preco_custo: $('#pCost').value.trim(),
  };
  try {
    if (editing) await api('PUT', '/produtos/' + encodeURIComponent(editing), dados);
    else await api('POST', '/produtos', dados);
    await carregar();
    fb(f, '✔ Produto salvo: ' + esc(dados.nome), 1);
    fillForm(PRODUTO_VAZIO, true);
    kitRows();
  } catch (e) { fb(f, esc(e.message), 0); }
};

// Exclusão em duas etapas: o primeiro clique pede confirmação.
$('#pDel').onclick = async () => {
  if (!delArm) { delArm = true; $('#pDel').textContent = 'Confirmar exclusão'; return; }
  try {
    await api('DELETE', '/produtos/' + encodeURIComponent(editing));
    await carregar();
    fb($('#pFb'), 'Produto excluído.', 1);
    fillForm(PRODUTO_VAZIO, true);
  } catch (e) {
    delArm = false; $('#pDel').textContent = 'Excluir';
    fb($('#pFb'), esc(e.message), 0);
  }
};

/* ---------- Kits ---------- */
function linhasDoKit() {
  return [...$('#kItems').querySelectorAll('.kit')].map((r) => ({ ean: r.querySelector('select').value, q: r.querySelector('input').value }));
}

function kitRows(manter) {
  const atuais = manter || linhasDoKit();
  const linhas = atuais.length ? atuais : [{ ean: '', q: 1 }];
  const opcoes = Object.values(S.products).sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => `<option value="${esc(p.ean)}">${esc(p.name)} (${esc(p.ean)})</option>`).join('');
  $('#kItems').innerHTML = linhas.map((l) =>
    `<div class="kit"><select><option value="">Produto…</option>${opcoes}</select><input type="number" min="1" value="${l.q || 1}"><button class="b g" style="margin:0;padding:6px" data-x>✕</button></div>`).join('');
  $('#kItems').querySelectorAll('select').forEach((s, i) => { s.value = linhas[i].ean || ''; });
}

$('#kAdd').onclick = () => kitRows([...linhasDoKit(), { ean: '', q: 1 }]);
$('#kItems').onclick = (e) => {
  if (e.target.dataset.x === undefined) return;
  e.target.closest('.kit').remove();
  if (!$('#kItems').children.length) kitRows([]);
};

$('#kSave').onclick = async () => {
  const f = $('#kFb');
  const itens = linhasDoKit().filter((l) => l.ean).map((l) => ({ ean: l.ean, quantidade: l.q }));
  try {
    await api('POST', '/kits', { codigo: $('#kCode').value.trim(), nome: $('#kName').value.trim(), itens });
    await carregar();
    fb(f, '✔ Kit salvo: ' + esc($('#kCode').value.trim().toUpperCase()), 1);
    $('#kCode').value = ''; $('#kName').value = '';
    kitRows([]); kitList();
  } catch (e) { fb(f, esc(e.message), 0); }
};

function kitList() {
  $('#kList').innerHTML = '<tr><th>Código</th><th>Nome</th><th>Composição</th><th></th></tr>' +
    (Object.values(S.kits).map((k) => `<tr><td>${esc(k.code)}</td><td>${esc(k.name)}</td><td>${k.items.map((i) => i.q + '× ' + esc(S.products[i.ean]?.name || '(excluído)')).join(' + ')}</td><td><button class="b g" style="margin:0;padding:4px 10px" data-k="${esc(k.code)}">Excluir</button></td></tr>`).join('')
      || '<tr><td colspan="4" class="note">Nenhum kit.</td></tr>');
}

$('#kList').onclick = async (e) => {
  const codigo = e.target.dataset.k;
  if (!codigo) return;
  if (e.target.textContent === 'Excluir') { e.target.textContent = 'Confirmar'; return; }
  try { await api('DELETE', '/kits/' + encodeURIComponent(codigo)); await carregar(); kitList(); }
  catch (err) { fb($('#kFb'), esc(err.message), 0); }
};

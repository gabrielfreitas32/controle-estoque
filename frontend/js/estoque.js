// Tela Estoque: lista de produtos, busca, alertas e kits possíveis.
function stock() {
  const q = $('#q').value.toLowerCase();
  const so = $('#low').checked;
  const todos = Object.values(S.products).sort((a, b) => a.name.localeCompare(b.name));
  const lista = todos.filter((p) => (!so || st(p)) && (!q || [p.name, p.ean, p.sku, p.loc].join(' ').toLowerCase().includes(q)));

  const zerados = todos.filter((p) => st(p) === 'zero').length;
  $('#sum').innerHTML = `<span>${todos.length} ${todos.length === 1 ? 'produto' : 'produtos'}</span><span>${todos.reduce((s, p) => s + p.qty, 0)} unidades</span>` +
    `<span class="low">${todos.filter((p) => st(p) === 'low').length} abaixo do mínimo</span><span class="zero">${zerados} ${zerados === 1 ? 'zerado' : 'zerados'}</span>`;

  // Valor total vem calculado do servidor (soma de saldo × custo de todos os produtos).
  if (ehAdmin()) valorTotal();

  const situacao = (p) => (st(p) === 'zero' ? 'Zerado' : st(p) === 'low' ? 'Baixo' : 'OK');
  const adm = ehAdmin();
  $('#stock').innerHTML = '<tr><th>Produto</th><th>EAN</th><th>SKU</th><th>Local</th><th>Saldo</th><th>Mín.</th>' + (adm ? '<th>Custo un.</th><th>Valor em estoque</th>' : '') + '<th>Situação</th></tr>' +
    (lista.map((p) => `<tr class="${adm ? 'click' : ''}" data-e="${esc(p.ean)}"><td>${esc(p.name)}</td><td>${esc(p.ean)}</td><td>${esc(p.sku)}</td><td>${esc(p.loc)}</td><td><b>${p.qty}</b></td><td>${p.min}</td>` +
      (adm ? `<td>${p.cost ? reais(p.cost) : '<span class="semcusto">sem custo</span>'}</td><td>${p.cost ? reais(p.val) : '—'}</td>` : '') +
      `<td><span class="tag ${st(p)}">${situacao(p)}</span></td></tr>`).join('')
      || `<tr><td colspan="${adm ? 9 : 7}" class="note">Nenhum produto encontrado.</td></tr>`);

  $('#kstock').innerHTML = '<tr><th>Kit</th><th>Código</th><th>Composição</th><th>Kits possíveis</th></tr>' +
    (Object.values(S.kits).map((k) => {
      const n = Math.min(...k.items.map((i) => (S.products[i.ean] ? Math.floor(S.products[i.ean].qty / i.q) : 0)));
      const comp = k.items.map((i) => i.q + '× ' + esc(S.products[i.ean]?.name || '(excluído)')).join(' + ');
      return `<tr><td>${esc(k.name)}</td><td>${esc(k.code)}</td><td>${comp}</td><td><b class="${n <= 0 ? 'zero' : ''}">${n}</b></td></tr>`;
    }).join('') || '<tr><td colspan="4" class="note">Nenhum kit cadastrado.</td></tr>');
}

async function valorTotal() {
  try {
    const r = await api('GET', '/resumo');
    const aviso = r.produtos_sem_custo_com_saldo
      ? `<div class="aviso">⚠ ${r.produtos_sem_custo_com_saldo} ${r.produtos_sem_custo_com_saldo === 1 ? 'produto com saldo está sem preço de custo e não entra' : 'produtos com saldo estão sem preço de custo e não entram'} neste valor. Clique no produto para informar o custo.</div>` : '';
    const top = r.maiores_valores.length
      ? '<div class="top"><b>Onde está o dinheiro:</b> ' + r.maiores_valores.map((m) => `${esc(m.nome)} <b>${reais(m.valor_centavos)}</b>`).join(' · ') + '</div>' : '';
    $('#valor').hidden = false;
    $('#valor').innerHTML = `<div class="n">${reais(r.valor_total_custo_centavos)}</div><div class="l">Valor total do estoque a preço de custo · ${r.unidades} unidades em ${r.produtos} produtos</div>${aviso}${top}`;
  } catch (e) { /* mantém o valor anterior */ }
}

$('#q').oninput = stock;
$('#low').onchange = stock;
$('#stock').onclick = (e) => {
  const tr = e.target.closest('tr[data-e]');
  if (tr && ehAdmin()) { go('cadastro'); fillForm(S.products[tr.dataset.e]); }
};

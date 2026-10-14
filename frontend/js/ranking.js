// Tela Ranking: o que mais saiu hoje, na semana e no mês, comparado com o período anterior.
let rankPeriodo = 'hoje';

const R_COMPARA = { hoje: 'ontem, até esta hora', semana: 'semana passada, até agora', mes: 'mês passado, até agora' };
const dd = (ms) => new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const chaveDia = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

function variacao(atual, anterior) {
  if (!anterior && !atual) return '<span class="var">sem vendas nos dois períodos</span>';
  if (!anterior) return '<span class="var up">novo: antes não havia vendas</span>';
  const p = Math.round(((atual - anterior) / anterior) * 100);
  if (p === 0) return `<span class="var">igual ao anterior (${anterior})</span>`;
  return `<span class="var ${p > 0 ? 'up' : 'down'}">${p > 0 ? '▲' : '▼'} ${Math.abs(p)}% (antes ${anterior})</span>`;
}

function tituloPeriodo(r) {
  const ini = new Date(r.inicio);
  if (r.periodo === 'hoje') return 'Hoje, ' + ini.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
  if (r.periodo === 'semana') return 'Semana de ' + dd(r.inicio) + ' (segunda) até hoje, ' + dd(r.fim - 1);
  return ini.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase()) + ', até hoje';
}

async function ranking() {
  document.querySelectorAll('#rPer button').forEach((b) => b.classList.toggle('on', b.dataset.p === rankPeriodo));
  let r;
  try { r = await api('GET', '/ranking?periodo=' + rankPeriodo); } catch (e) { return; }
  if (tab !== 'ranking') return;
  $('#rTit').textContent = tituloPeriodo(r) + '  ·  comparado com ' + R_COMPARA[r.periodo];
  const topo = r.produtos[0];
  const adm0 = ehAdmin();
  const valor = adm0 ? r.produtos.reduce((s, p) => s + p.valor_custo_centavos, 0) : 0;
  const semCusto = adm0 ? r.produtos.filter((p) => p.sem_custo).length : 0;
  $('#rCards').innerHTML =
    `<div class="card"><div class="k">Unidades vendidas</div><div class="n">${r.unidades}</div>${variacao(r.unidades, r.anterior.unidades)}</div>` +
    (adm0 ? `<div class="card destaque"><div class="k">Valor das saídas (a preço de custo)</div><div class="n">${reais(valor)}</div><span class="var">${semCusto ? '⚠ ' + semCusto + ' produto(s) sem custo cadastrado: o valor está incompleto' : 'quantidade × preço de custo de cada produto'}</span></div>` : '') +
    `<div class="card"><div class="k">Mais vendido</div><div class="n" style="font-size:24px;line-height:1.3">${topo ? esc(topo.nome) : '—'}</div><span class="var">${topo ? topo.unidades + ' un. · ' + r.produtos_vendidos + ' produto(s) diferentes no período' : 'nenhuma saída ainda'}</span></div>`;

  // Gráfico por dia (semana e mês): todos os dias do período, inclusive os sem venda
  const box = $('#rDiaBox');
  box.hidden = r.periodo === 'hoje';
  if (r.periodo !== 'hoje') {
    const mapa = Object.fromEntries(r.por_dia.map((d) => [d.dia, d]));
    const dias = [];
    for (let d = new Date(r.inicio); d.getTime() < r.fim; d.setDate(d.getDate() + 1)) dias.push(new Date(d));
    const max = Math.max(1, ...dias.map((d) => (mapa[chaveDia(d)] || {}).unidades || 0));
    $('#rDias').innerHTML = dias.map((d) => {
      const x = mapa[chaveDia(d)] || { unidades: 0 };
      const alt = Math.round((x.unidades / max) * 100);
      return `<div class="dia" title="${dd(d.getTime())}: ${x.unidades} un."><span class="v">${x.unidades || ''}</span><i style="height:${alt}%"></i><span class="d">${String(d.getDate()).padStart(2, '0')}</span></div>`;
    }).join('');
  }

  const adm = ehAdmin();
  const max = Math.max(1, ...r.produtos.map((p) => p.unidades));
  $('#rTab').innerHTML = '<tr><th>#</th><th>Produto</th><th>EAN</th><th class="barra"></th><th>Unidades vendidas</th>' + (adm ? '<th>Valor (custo × qtd)</th>' : '') + '</tr>' +
    (r.produtos.map((p, i) => `<tr><td class="pos p${i + 1}">${i + 1}</td><td>${esc(p.nome)}</td><td>${esc(p.ean)}</td><td class="barra"><i style="width:${Math.round((p.unidades / max) * 100)}%"></i></td><td><b>${p.unidades}</b></td>${adm ? '<td>' + (p.sem_custo ? '<span class="var">sem custo</span>' : '<b>' + reais(p.valor_custo_centavos) + '</b>') + '</td>' : ''}</tr>`).join('')
      || `<tr><td colspan="${adm ? 6 : 5}" class="note">Nenhuma saída neste período ainda.</td></tr>`);
}

$('#rPer').onclick = (e) => {
  const p = e.target.dataset && e.target.dataset.p;
  if (!p) return;
  rankPeriodo = p;
  ranking();
};

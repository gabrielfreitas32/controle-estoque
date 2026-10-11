// Tela Histórico: lista e filtro das movimentações.

function hist(){const q=$('#hq').value.toLowerCase();
const l=S.moves.filter(m=>!q||[m.name,m.ean,m.ref,m.note,TN[m.type]].join(' ').toLowerCase().includes(q)).slice(0,300);
$('#hist').innerHTML='<tr><th>Data/hora</th><th>Tipo</th><th>Produto</th><th>EAN</th><th>Qtd</th><th>Saldo após</th><th>Referência</th><th>Obs.</th></tr>'+(l.map(m=>`<tr><td>${fmt(m.t)}</td><td>${TN[m.type]}</td><td>${esc(m.name)}</td><td>${esc(m.ean)}</td><td class="${m.q<0?'neg':'pos'}">${m.q>0?'+':''}${m.q}</td><td>${m.bal}</td><td>${esc(m.ref)}</td><td>${esc(m.note)}</td></tr>`).join('')||'<tr><td colspan="8" class="note">Sem movimentações.</td></tr>')}
$('#hq').oninput=hist;

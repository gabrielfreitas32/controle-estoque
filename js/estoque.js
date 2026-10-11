// Tela Estoque: lista de produtos, busca, alertas de estoque baixo e kits possíveis.

function stock(){const q=$('#q').value.toLowerCase(),lo=$('#low').checked;
const all=Object.values(S.products).sort((a,b)=>a.name.localeCompare(b.name));
const list=all.filter(p=>(!lo||st(p))&&(!q||[p.name,p.ean,p.sku,p.loc].join(' ').toLowerCase().includes(q)));
$('#sum').innerHTML=`<span>${all.length} produtos</span><span>${all.reduce((s,p)=>s+p.qty,0)} unidades</span><span class="low">${all.filter(p=>st(p)==='low').length} abaixo do mínimo</span><span class="zero">${all.filter(p=>st(p)==='zero').length} zerados</span>`;
$('#stock').innerHTML='<tr><th>Produto</th><th>EAN</th><th>SKU</th><th>Local</th><th>Saldo</th><th>Mín.</th><th>Situação</th></tr>'+(list.map(p=>`<tr class="click" data-e="${esc(p.ean)}"><td>${esc(p.name)}</td><td>${esc(p.ean)}</td><td>${esc(p.sku)}</td><td>${esc(p.loc)}</td><td><b>${p.qty}</b></td><td>${p.min}</td><td><span class="tag ${st(p)}">${st(p)==='zero'?'Zerado':st(p)==='low'?'Baixo':'OK'}</span></td></tr>`).join('')||'<tr><td colspan="7" class="note">Nenhum produto. Cadastre na aba Cadastro.</td></tr>');
$('#kstock').innerHTML='<tr><th>Kit</th><th>Código</th><th>Composição</th><th>Kits possíveis</th></tr>'+(Object.values(S.kits).map(k=>{const n=Math.min(...k.items.map(i=>S.products[i.ean]?Math.floor(S.products[i.ean].qty/i.q):0));return`<tr><td>${esc(k.name)}</td><td>${esc(k.code)}</td><td>${k.items.map(i=>i.q+'× '+esc(S.products[i.ean]?.name||'(excluído)')).join(' + ')}</td><td><b class="${n<=0?'zero':''}">${n}</b></td></tr>`}).join('')||'<tr><td colspan="4" class="note">Nenhum kit cadastrado.</td></tr>')}
$('#q').oninput=stock;$('#low').onchange=stock;
$('#stock').onclick=e=>{const tr=e.target.closest('tr[data-e]');if(tr){go('cadastro');fillForm(S.products[tr.dataset.e])}};

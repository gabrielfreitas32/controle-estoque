// Tela Inventário: contagem rápida por bipagem e aplicação de ajustes.

function ctab(){const l=Object.keys(count);$('#ctab').innerHTML='<tr><th>Produto</th><th>Sistema</th><th>Contado</th><th>Diferença</th></tr>'+(l.map(e=>{const p=S.products[e],d=count[e]-p.qty;return`<tr><td>${esc(p.name)}</td><td>${p.qty}</td><td><b>${count[e]}</b></td><td class="${d<0?'neg':d>0?'pos':''}">${d>0?'+':''}${d}</td></tr>`}).join('')||'<tr><td colspan="4" class="note">Nenhum item contado ainda.</td></tr>')}
$('#cscan').addEventListener('keydown',e=>{if(e.key!=='Enter')return;const p=find(e.target.value),f=$('#cfb');if(!p){beep(0);fb(f,'EAN não cadastrado: '+esc(e.target.value),0);e.target.select();return}
count[p.ean]=(count[p.ean]||0)+1;beep(1);fb(f,'✔ '+esc(p.name)+': '+count[p.ean],1);e.target.value='';ctab()});
$('#cApply').onclick=()=>{let n=0;for(const e in count){const p=S.products[e],d=count[e]-p.qty;if(d){p.qty=count[e];mv('inv',e,d,'','Contagem de inventário');n++}}count={};save();ctab();fb($('#cfb'),'✔ Inventário aplicado: '+n+' ajuste(s).',1)};
$('#cClear').onclick=()=>{count={};ctab()};

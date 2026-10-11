// Tela Cadastro: cadastro e edição de produtos e kits (composição virtual).

let editing=null;
function fillForm(p,isNew){editing=isNew?null:p.ean;delArm=false;$('#pTitle').textContent=isNew||!p.name?'Novo produto':'Editar produto';
$('#pEan').value=p.ean;$('#pName').value=p.name;$('#pSku').value=p.sku||'';$('#pLoc').value=p.loc||'';$('#pMin').value=p.min||0;$('#pQty').value=p.qty||0;
$('#pDel').hidden=!editing;$('#pDel').textContent='Excluir';$('#pEan').readOnly=!!editing}
$('#pClear').onclick=()=>{fillForm({ean:'',name:'',sku:'',loc:'',min:0,qty:0},true);$('#pFb').hidden=true};
$('#pSave').onclick=()=>{const ean=$('#pEan').value.trim(),name=$('#pName').value.trim(),f=$('#pFb');
if(!ean||!name)return fb(f,'Informe EAN e nome.',0);
const isNew=!S.products[ean];if(isNew&&editing===null&&S.products[ean])return;
const sku=$('#pSku').value.trim();
if(sku&&Object.values(S.products).some(x=>x.ean!==ean&&x.sku&&x.sku.toLowerCase()===sku.toLowerCase()))return fb(f,'Esse SKU já pertence a outro produto.',0);
const qty=Math.max(0,parseInt($('#pQty').value)||0);
const p=S.products[ean]||(S.products[ean]={ean,qty:0});
Object.assign(p,{name,sku,loc:$('#pLoc').value.trim(),min:Math.max(0,parseInt($('#pMin').value)||0)});
if(qty!==p.qty){const d=qty-p.qty;p.qty=qty;mv(isNew?'in':'adj',ean,d,'',isNew?'Saldo inicial':'Ajuste manual')}
save();fb(f,'✔ Produto salvo: '+esc(name),1);fillForm({ean:'',name:'',sku:'',loc:'',min:0,qty:0},true);kitRows()};
$('#pDel').onclick=()=>{if(!delArm){delArm=true;$('#pDel').textContent='Confirmar exclusão';return}
const usedBy=Object.values(S.kits).filter(k=>k.items.some(i=>i.ean===editing));
if(usedBy.length){delArm=false;$('#pDel').textContent='Excluir';return fb($('#pFb'),'Produto usado nos kits: '+usedBy.map(k=>esc(k.code)).join(', ')+'. Remova-o dos kits antes.',0)}
delete S.products[editing];save();fb($('#pFb'),'Produto excluído.',1);fillForm({ean:'',name:'',sku:'',loc:'',min:0,qty:0},true)};

function kitRows(keep){const box=$('#kItems'),cur=keep||[...box.querySelectorAll('.kit')].map(r=>({ean:r.querySelector('select').value,q:r.querySelector('input').value}));
const rows=cur.length?cur:[{ean:'',q:1}];
const opts=Object.values(S.products).sort((a,b)=>a.name.localeCompare(b.name)).map(p=>`<option value="${esc(p.ean)}">${esc(p.name)} (${esc(p.ean)})</option>`).join('');
box.innerHTML=rows.map(r=>`<div class="kit"><select><option value="">Produto…</option>${opts}</select><input type="number" min="1" value="${r.q||1}"><button class="b g" style="margin:0;padding:6px" data-x>✕</button></div>`).join('');
box.querySelectorAll('select').forEach((s,i)=>s.value=rows[i].ean||'')}
$('#kAdd').onclick=()=>{const cur=[...$('#kItems').querySelectorAll('.kit')].map(r=>({ean:r.querySelector('select').value,q:r.querySelector('input').value}));cur.push({ean:'',q:1});kitRows(cur)};
$('#kItems').onclick=e=>{if(e.target.dataset.x!==undefined){e.target.closest('.kit').remove();if(!$('#kItems').children.length)kitRows([])}};
$('#kSave').onclick=()=>{const code=$('#kCode').value.trim().toUpperCase(),name=$('#kName').value.trim(),f=$('#kFb');
const items=[...$('#kItems').querySelectorAll('.kit')].map(r=>({ean:r.querySelector('select').value,q:Math.max(1,parseInt(r.querySelector('input').value)||1)})).filter(i=>i.ean);
if(!code||!name||!items.length)return fb(f,'Informe código, nome e pelo menos um componente.',0);
if(S.products[code]||find(code))return fb(f,'Esse código já é de um produto (EAN/SKU). Use outro código para o kit.',0);
S.kits[code]={code,name,items};save();fb(f,'✔ Kit salvo: '+esc(code),1);$('#kCode').value='';$('#kName').value='';kitRows([]);kitList()};
function kitList(){$('#kList').innerHTML='<tr><th>Código</th><th>Nome</th><th>Composição</th><th></th></tr>'+(Object.values(S.kits).map(k=>`<tr><td>${esc(k.code)}</td><td>${esc(k.name)}</td><td>${k.items.map(i=>i.q+'× '+esc(S.products[i.ean]?.name||'(excluído)')).join(' + ')}</td><td><button class="b g" style="margin:0;padding:4px 10px" data-k="${esc(k.code)}">Excluir</button></td></tr>`).join('')||'<tr><td colspan="4" class="note">Nenhum kit.</td></tr>')}
$('#kList').onclick=e=>{const c=e.target.dataset.k;if(!c)return;if(e.target.textContent==='Excluir'){e.target.textContent='Confirmar';return}delete S.kits[c];save();kitList()};

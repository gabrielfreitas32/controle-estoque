// Tela Bipar: entrada e saída por EAN (ou código de kit), com validação de saldo.

function setMode(m){mode=m;$('#mIn').classList.toggle('on',m==='in');$('#mOut').classList.toggle('on',m==='out');$('#scan').focus()}
$('#mIn').onclick=()=>setMode('in');$('#mOut').onclick=()=>setMode('out');
function recent(){$('#recent').innerHTML='<tr><th>Hora</th><th>Tipo</th><th>Produto</th><th>Qtd</th><th>Saldo</th><th>Ref.</th></tr>'+S.moves.slice(0,8).map(m=>`<tr><td>${fmt(m.t)}</td><td>${TN[m.type]}</td><td>${esc(m.name)}</td><td class="${m.q<0?'neg':'pos'}">${m.q>0?'+':''}${m.q}</td><td>${m.bal}</td><td>${esc(m.ref)}</td></tr>`).join('')}
$('#scan').addEventListener('keydown',e=>{if(e.key!=='Enter')return;const code=e.target.value.trim(),q=Math.max(1,parseInt($('#qty').value)||1),ref=$('#ref').value.trim(),f=$('#fb');if(!code)return;
const kit=S.kits[code.toUpperCase()];
const done=(msg)=>{beep(1);fb(f,msg,1,1);e.target.value='';$('#qty').value=1;save();recent();e.target.focus()};
const fail=(msg)=>{beep(0);fb(f,msg,0,1);e.target.select()};
if(kit){if(mode==='in')return fail('Kit só pode ser usado na saída. Dê entrada nos produtos individuais.');
for(const it of kit.items){const p=S.products[it.ean];if(!p)return fail('Componente do kit foi excluído: '+esc(it.ean));if(p.qty<it.q*q)return fail('Sem saldo para o kit: '+esc(p.name)+' (saldo '+p.qty+', precisa '+it.q*q+')')}
kit.items.forEach(it=>{const p=S.products[it.ean];p.qty-=it.q*q;mv('out',it.ean,-it.q*q,ref,'Kit '+kit.code)});
return done('✔ Saída do kit '+esc(kit.name)+' ×'+q+' — baixa em '+kit.items.length+' produto(s)')}
const p=find(code);
if(!p){beep(0);fb(f,'EAN não cadastrado: '+esc(code)+' <button class="b" style="margin:0 0 0 8px;padding:4px 10px" id="goReg">Cadastrar</button>',0,1);$('#goReg').onclick=()=>{go('cadastro');fillForm({ean:code,name:'',sku:'',loc:'',min:0,qty:0},true);$('#pName').focus()};e.target.select();return}
if(mode==='out'){if(p.qty<q)return fail('Sem saldo: '+esc(p.name)+' (saldo '+p.qty+')');p.qty-=q;mv('out',p.ean,-q,ref)}
else{p.qty+=q;mv('in',p.ean,q,ref)}
done('✔ '+(mode==='out'?'Saída':'Entrada')+': '+esc(p.name)+' ×'+q+' — saldo '+p.qty+(st(p)?' ⚠ estoque baixo':''))});

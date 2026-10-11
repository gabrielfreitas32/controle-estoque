// Funções utilitárias: seletor, escape de HTML, som, mensagens, formatação.

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function beep(ok){try{const c=new(window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator();o.frequency.value=ok?880:220;o.connect(c.destination);o.start();setTimeout(()=>{o.stop();c.close()},ok?90:250)}catch(e){}}
function fb(el,msg,ok,keep){el.hidden=false;el.className='fb '+(ok?'ok':'er');el.innerHTML=msg;if(!keep)clearTimeout(fb.t),fb.t=setTimeout(()=>{if(el.id!=='fb')el.hidden=true},6000)}
function fmt(t){return new Date(t).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
const TN={in:'Entrada',out:'Saída',adj:'Ajuste',inv:'Inventário'};

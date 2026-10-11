// Navegação entre abas e inicialização. Deve ser o último script carregado.

function go(t){tab=t;['bipar','estoque','cadastro','hist','inv'].forEach(x=>{$('#t-'+x).hidden=x!==t});
document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
if(t==='bipar'){recent();$('#scan').focus()}if(t==='estoque')stock();if(t==='cadastro'){kitRows();kitList()}if(t==='hist')hist();if(t==='inv'){ctab();$('#cscan').focus()}}
$('#nav').onclick=e=>{if(e.target.dataset.t)go(e.target.dataset.t)};

document.addEventListener('click',e=>{if(tab==='bipar'&&!['INPUT','BUTTON','SELECT','TEXTAREA'].includes(e.target.tagName))$('#scan').focus()});
setMode('out');go('bipar');

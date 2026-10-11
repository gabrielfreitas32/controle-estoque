// Backup: exportar/restaurar JSON e exportar estoque em CSV.

// Baixa um arquivo gerado no navegador (download comum, funciona em qualquer hospedagem)
function baixar(nome, conteudo) {
  const tipo = nome.endsWith('.csv') ? 'text/csv;charset=utf-8' : 'application/json';
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('#bExp').onclick=()=>{const j=JSON.stringify(S);$('#bTxt').value=j;baixar('backup-estoque-'+new Date().toISOString().slice(0,10)+'.json',j)};
$('#bCsv').onclick=()=>{const L=['EAN;SKU;Nome;Local;Saldo;Minimo'].concat(Object.values(S.products).map(p=>[p.ean,p.sku,p.name,p.loc,p.qty,p.min].map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')));baixar('estoque-'+new Date().toISOString().slice(0,10)+'.csv','\ufeff'+L.join('\n'))};
$('#bImp').onclick=()=>{try{const d=JSON.parse($('#bTxt').value);if(!d.products||!d.kits||!d.moves)throw 0;S=d;save();fb($('#bFb'),'✔ Backup restaurado.',1);kitRows([]);kitList()}catch(e){fb($('#bFb'),'Conteúdo inválido. Cole o backup completo (.json).',0)}};

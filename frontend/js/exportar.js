// Exportação do estoque em CSV (download comum do navegador).
function baixar(nome, conteudo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('#bCsv').onclick = () => {
  const aspas = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const adm = ehAdmin();
  const num = (c) => (c / 100).toFixed(2).replace('.', ','); // 12,50 (abre certo no Excel brasileiro)
  const linhas = ['EAN;SKU;Nome;Local;Saldo;Minimo' + (adm ? ';Custo unitario;Valor em estoque' : '')].concat(
    Object.values(S.products).map((p) => [p.ean, p.sku, p.name, p.loc, p.qty, p.min].concat(adm ? [num(p.cost), num(p.val)] : []).map(aspas).join(';')));
  baixar('estoque-' + new Date().toISOString().slice(0, 10) + '.csv', '\ufeff' + linhas.join('\n'));
};

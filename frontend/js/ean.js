// Leitor de EAN-13 / EAN-8 (e UPC-A) a partir de uma imagem, sem bibliotecas externas.
// Funciona em qualquer navegador (o Safari do iPhone não tem o leitor nativo, o BarcodeDetector).
// Entrada: pixels RGBA (como o canvas entrega). Saída: o código lido (com dígito verificador conferido) ou null.
(function (raiz) {
  const L = [[3, 2, 1, 1], [2, 2, 2, 1], [2, 1, 2, 2], [1, 4, 1, 1], [1, 1, 3, 2], [1, 2, 3, 1], [1, 1, 1, 4], [1, 3, 1, 2], [1, 2, 1, 3], [3, 1, 1, 2]];
  const G = L.map((p) => p.slice().reverse());
  const PARIDADE = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

  function verificador(d) { // d: string só com dígitos, o último é o verificador
    let s = 0;
    for (let i = d.length - 2, peso = 3; i >= 0; i--, peso = 4 - peso) s += Number(d[i]) * peso;
    return (10 - (s % 10)) % 10 === Number(d[d.length - 1]);
  }

  // Compara 4 larguras medidas com os padrões; devolve {d, erro} do melhor.
  function melhorDigito(runs, i, tabela) {
    const total = runs[i] + runs[i + 1] + runs[i + 2] + runs[i + 3];
    const u = total / 7;
    let melhor = -1, menor = 1e9;
    for (let d = 0; d < 10; d++) {
      let e = 0;
      for (let k = 0; k < 4; k++) {
        const dif = Math.abs(runs[i + k] / u - tabela[d][k]);
        if (dif > 0.75) { e = 1e9; break; }
        e += dif;
      }
      if (e < menor) { menor = e; melhor = d; }
    }
    return menor < 1.7 ? melhor : -1;
  }

  const similares = (a, b) => a > 0 && b > 0 && a / b < 2.2 && b / a < 2.2;

  // runs[0] é sempre uma barra preta. Procura um EAN começando em qualquer barra.
  function lerRuns(runs) {
    for (let i = 1; i + 3 < runs.length; i += 2) { // i = barra preta (índices ímpares se começou em branco)
      const u = (runs[i] + runs[i + 1] + runs[i + 2]) / 3;
      if (!similares(runs[i], runs[i + 1]) || !similares(runs[i + 1], runs[i + 2])) continue;
      if (runs[i - 1] < u * 4) continue; // precisa de zona de silêncio antes
      for (const n of [6, 4]) {
        const r = lerDepoisDaGuarda(runs, i, u, n);
        if (r) return r;
      }
    }
    return null;
  }

  function lerDepoisDaGuarda(runs, i, u, n) { // n = dígitos por lado: 6 (EAN-13) ou 4 (EAN-8)
    const fim = i + 3 + n * 4 + 5 + n * 4 + 3;
    if (fim > runs.length) return null;
    let p = i + 3, esquerda = '', pariedade = '';
    for (let k = 0; k < n; k++, p += 4) {
      const l = melhorDigito(runs, p, L), g = n === 6 ? melhorDigito(runs, p, G) : -1;
      if (l < 0 && g < 0) return null;
      // escolhe o padrão que casa melhor
      const el = l < 0 ? 1e9 : erro(runs, p, L[l]), eg = g < 0 ? 1e9 : erro(runs, p, G[g]);
      if (el <= eg) { esquerda += l; pariedade += 'L'; } else { esquerda += g; pariedade += 'G'; }
    }
    // guarda central: 5 faixas de largura ~1 módulo
    for (let k = 0; k < 5; k++) if (runs[p + k] > u * 2.6 || runs[p + k] < u * 0.35) return null;
    p += 5;
    let direita = '';
    for (let k = 0; k < n; k++, p += 4) {
      const d = melhorDigito(runs, p, L);
      if (d < 0) return null;
      direita += d;
    }
    let codigo;
    if (n === 6) {
      const primeiro = PARIDADE.indexOf(pariedade);
      if (primeiro < 0) return null;
      codigo = primeiro + esquerda + direita;
    } else {
      if (pariedade !== 'LLLL') return null;
      codigo = esquerda + direita;
    }
    return verificador(codigo) ? codigo : null;
  }

  function erro(runs, p, padrao) {
    const u = (runs[p] + runs[p + 1] + runs[p + 2] + runs[p + 3]) / 7;
    let e = 0;
    for (let k = 0; k < 4; k++) e += Math.abs(runs[p + k] / u - padrao[k]);
    return e;
  }

  // Uma linha de pixels (luminância 0-255) -> larguras alternadas (com fração de pixel), começando pela primeira faixa.
  function linhaParaRuns(lum) {
    const n = lum.length;
    // limiar local = ponto médio entre o mais claro e o mais escuro da vizinhança (aguenta sombra e brilho desigual)
    const janela = Math.max(20, Math.floor(n / 8));
    const t = new Float32Array(n); // negativo = escuro (barra)
    for (let i = 0; i < n; i++) {
      let mn = 255, mx = 0;
      const a = Math.max(0, i - janela), b = Math.min(n - 1, i + janela);
      for (let k = a; k <= b; k++) { const v = lum[k]; if (v < mn) mn = v; if (v > mx) mx = v; }
      t[i] = mx - mn < 40 ? 1 : lum[i] - (mn + mx) / 2; // sem contraste = fundo
    }
    // acha os cruzamentos do limiar com precisão de fração de pixel (barras borradas continuam medindo certo)
    const cortes = [];
    for (let i = 0; i < n - 1; i++) {
      if ((t[i] < 0) !== (t[i + 1] < 0)) cortes.push(i + t[i] / (t[i] - t[i + 1]));
    }
    const runs = [];
    for (let i = 1; i < cortes.length; i++) runs.push(cortes[i] - cortes[i - 1]);
    // runs[0] é a faixa logo depois do primeiro corte; a cor dela vem do sinal logo após esse corte
    const c0 = Math.floor(cortes[0] || 0) + 1;
    return { runs, comecouPreto: t[Math.min(n - 1, c0)] < 0 };
  }

  function lerLinha(lum) {
    const { runs, comecouPreto } = linhaParaRuns(lum);
    if (runs.length < 40) return null;
    const grande = lum.length; // as pontas da linha contam como zona de silêncio
    // r[0] = branco inicial; r[1] = primeira barra ...
    const r = comecouPreto ? [grande, ...runs, grande] : [grande, grande, ...runs, grande];
    // normaliza: índice par = branco, ímpar = preto
    let a = comecouPreto ? r : r.slice(1);
    if (!comecouPreto) a = [grande, ...runs, grande];
    const rev = a.slice().reverse();
    return lerRuns(a) || lerRuns(rev.length % 2 === 1 ? rev : [grande, ...rev]);
  }

  // dados: Uint8ClampedArray RGBA; devolve o código mais votado entre várias linhas horizontais.
  function lerImagem(dados, largura, altura, opcoes) {
    const linhas = (opcoes && opcoes.linhas) || 21;
    const de = (opcoes && opcoes.de) != null ? opcoes.de : 0.25, ate = (opcoes && opcoes.ate) != null ? opcoes.ate : 0.75;
    const votos = {};
    const lum = new Float32Array(largura);
    for (let k = 0; k < linhas; k++) {
      const y = Math.min(altura - 1, Math.floor(altura * (de + (ate - de) * (k / (linhas - 1 || 1)))));
      lum.fill(0);
      // média de 5 linhas vizinhas: tira o ruído da câmera sem borrar as barras (que são verticais)
      let n = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= altura) continue;
        n++;
        for (let x = 0; x < largura; x++) { const o = (yy * largura + x) * 4; lum[x] += dados[o] * 0.299 + dados[o + 1] * 0.587 + dados[o + 2] * 0.114; }
      }
      for (let x = 0; x < largura; x++) lum[x] /= n;
      const c = lerLinha(lum);
      if (c) votos[c] = (votos[c] || 0) + 1;
    }
    let melhor = null, mv = 0;
    for (const [c, v] of Object.entries(votos)) if (v > mv) { melhor = c; mv = v; }
    return mv >= ((opcoes && opcoes.minimo) || 2) ? melhor : null;
  }

  const api = { lerImagem, lerLinha, verificador };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.EAN = api;
})(typeof window !== 'undefined' ? window : globalThis);

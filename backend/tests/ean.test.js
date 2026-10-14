// Testa o leitor de EAN da câmera com códigos desenhados aqui mesmo (com desfoque, ruído, inclinação e de cabeça para baixo).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const EAN = require(path.join(__dirname, '..', '..', 'frontend', 'js', 'ean.js'));

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = L.map((s) => s.replace(/[01]/g, (c) => (c === '0' ? '1' : '0')));
const PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

function completar(base) { // base sem verificador
  let s = 0;
  for (let i = base.length - 1, p = 3; i >= 0; i--, p = 4 - p) s += Number(base[i]) * p;
  return base + ((10 - (s % 10)) % 10);
}
function modulos(codigo) {
  if (codigo.length === 8) {
    return '101' + [...codigo.slice(0, 4)].map((d) => L[d]).join('') + '01010' + [...codigo.slice(4)].map((d) => R[d]).join('') + '101';
  }
  const par = PAR[codigo[0]];
  return '101' + [...codigo.slice(1, 7)].map((d, i) => (par[i] === 'L' ? L : G)[d]).join('') + '01010' + [...codigo.slice(7)].map((d) => R[d]).join('') + '101';
}

// Desenha uma imagem RGBA: fundo claro, código no centro, com escala/desfoque/ruído/inclinação.
function imagem(codigo, { escala = 3, largura = 640, altura = 480, desfoque = 0, ruido = 0, inclina = 0, invertido = false, seed = 1 } = {}) {
  let rnd = seed; const al = () => (rnd = (rnd * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let m = modulos(codigo); if (invertido) m = [...m].reverse().join('');
  const quiet = 10, total = (m.length + quiet * 2) * escala;
  const x0 = Math.floor((largura - total) / 2);
  const dados = new Uint8ClampedArray(largura * altura * 4);
  for (let y = 0; y < altura; y++) {
    const linha = new Float32Array(largura).fill(225);
    const desloc = Math.round((y - altura / 2) * inclina);
    for (let i = 0; i < m.length; i++) {
      if (m[i] !== '1') continue;
      for (let e = 0; e < escala; e++) { const x = x0 + (quiet + i) * escala + e + desloc; if (x >= 0 && x < largura) linha[x] = 35; }
    }
    let saida = linha;
    if (desfoque) { // média móvel
      saida = new Float32Array(largura);
      for (let x = 0; x < largura; x++) { let s = 0, c = 0; for (let k = -desfoque; k <= desfoque; k++) { const xx = x + k; if (xx >= 0 && xx < largura) { s += linha[xx]; c++; } } saida[x] = s / c; }
    }
    for (let x = 0; x < largura; x++) {
      const v = Math.max(0, Math.min(255, saida[x] + (al() - 0.5) * 2 * ruido));
      const o = (y * largura + x) * 4; dados[o] = dados[o + 1] = dados[o + 2] = v; dados[o + 3] = 255;
    }
  }
  return { dados, largura, altura };
}
const ler = (img) => EAN.lerImagem(img.dados, img.largura, img.altura);

test('lê EAN-13 limpo, de vários tamanhos', () => {
  for (const base of ['789100000001', '789123456789', '590123412345', '400638133393', '978020137962', '012345678905'.slice(0, 12)]) {
    const c = completar(base);
    for (const escala of [2, 3, 4]) assert.equal(ler(imagem(c, { escala })), c, `${c} escala ${escala}`);
  }
});

test('lê EAN-13 com desfoque e ruído', () => {
  for (const base of ['789100000001', '789123456789', '590123412345']) {
    const c = completar(base);
    assert.equal(ler(imagem(c, { escala: 3, desfoque: 1, ruido: 40 })), c);
    assert.equal(ler(imagem(c, { escala: 4, desfoque: 2, ruido: 50, seed: 7 })), c);
  }
});

test('lê EAN-13 inclinado e de cabeça para baixo', () => {
  const c = completar('789100000001');
  assert.equal(ler(imagem(c, { escala: 3, inclina: 0.03 })), c);
  assert.equal(ler(imagem(c, { escala: 3, invertido: true })), c);
});

test('lê EAN-8', () => {
  const c = completar('9638507');
  assert.equal(ler(imagem(c, { escala: 3 })), c);
});

test('não inventa código em imagem sem código ou com dígito errado', () => {
  const vazio = { dados: new Uint8ClampedArray(640 * 480 * 4).fill(200), largura: 640, altura: 480 };
  assert.equal(ler(vazio), null);
  const c = completar('789100000001');
  const errado = c.slice(0, 12) + ((Number(c[12]) + 1) % 10);
  assert.equal(ler(imagem(errado, { escala: 3 })), null);
  // ruído puro
  const r = imagem(c, { escala: 3, ruido: 0 }); for (let i = 0; i < r.dados.length; i += 4) r.dados[i] = r.dados[i + 1] = r.dados[i + 2] = Math.random() * 255;
  assert.equal(ler(r), null);
});

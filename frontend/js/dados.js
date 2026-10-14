// Estado da tela (cópia dos dados do servidor) e regras de exibição.
let S = { products: {}, kits: {} };
let mode = 'saida';      // 'entrada' ou 'saida'
let tab = 'bipar';
let count = {};          // contagem do inventário: ean -> quantidade
let delArm = false;      // exclusão em duas etapas
let editing = null;      // EAN do produto em edição

const ehAdmin = () => !!usuario && usuario.perfil === 'admin';

// Busca produtos e kits no servidor.
async function carregar() {
  const [ps, ks] = await Promise.all([api('GET', '/produtos'), api('GET', '/kits')]);
  S.products = {};
  ps.forEach((p) => { S.products[p.ean] = dProduto(p); });
  S.kits = {};
  ks.forEach((k) => { S.kits[k.codigo] = dKit(k); });
}

// Procura por EAN ou, se não achar, por SKU (sem diferenciar maiúsculas).
function find(code) {
  code = String(code).trim();
  if (S.products[code]) return S.products[code];
  const c = code.toLowerCase();
  return Object.values(S.products).find((p) => p.sku && p.sku.toLowerCase() === c);
}

const st = (p) => (p.qty <= 0 ? 'zero' : p.min > 0 && p.qty <= p.min ? 'low' : '');

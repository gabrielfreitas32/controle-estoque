// Estado da aplicação, persistência (localStorage) e regras básicas de movimentação de estoque.

const KEY='estoque_v1';
let S={products:{},kits:{},moves:[]},mode='out',tab='bipar',count={},delArm=false;
let okStore=true;
try{const r=localStorage.getItem(KEY);if(r)S=JSON.parse(r)}catch(e){okStore=false}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){okStore=false;$('#warn').hidden=false}}
if(!okStore)$('#warn').hidden=false;
function find(code){code=String(code).trim();if(S.products[code])return S.products[code];const c=code.toLowerCase();return Object.values(S.products).find(p=>p.sku&&p.sku.toLowerCase()===c)}
function mv(type,ean,q,ref,note){const p=S.products[ean];S.moves.unshift({t:Date.now(),type,ean,name:p.name,q,ref:ref||'',note:note||'',bal:p.qty});if(S.moves.length>5000)S.moves.length=5000}
function st(p){return p.qty<=0?'zero':(p.min>0&&p.qty<=p.min?'low':'')}

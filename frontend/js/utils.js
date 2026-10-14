// Funções utilitárias: seletor, escape de HTML, som, mensagens e formatação.
const $ = (s) => document.querySelector(s);

// Escapa texto vindo do usuário/servidor antes de colocar em innerHTML.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function beep(ok) {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    const o = c.createOscillator();
    o.frequency.value = ok ? 880 : 220;
    o.connect(c.destination);
    o.start();
    setTimeout(() => { o.stop(); c.close(); }, ok ? 90 : 600);
    if (!ok) { o.type = 'sawtooth'; o.frequency.setValueAtTime(220, c.currentTime); o.frequency.setValueAtTime(160, c.currentTime + 0.2); o.frequency.setValueAtTime(220, c.currentTime + 0.4); }
  } catch (e) { /* sem áudio */ }
}

// Mostra uma mensagem de sucesso/erro. keep=true mantém na tela.
function fb(el, msg, ok, keep) {
  el.hidden = false;
  el.className = 'fb ' + (ok ? 'ok' : 'er');
  el.innerHTML = msg;
  clearTimeout(el._t);
  if (!keep) el._t = setTimeout(() => { el.hidden = true; }, 6000);
}

// Centavos (inteiro vindo do servidor) -> "R$ 1.234,56".
const reais = (c) => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmt = (t) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const TN = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste', inventario: 'Inventário' };

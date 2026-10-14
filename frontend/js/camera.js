// Bipar com a câmera do celular/notebook. Exige HTTPS (ou localhost): é uma regra do navegador.
// Usa o leitor nativo (BarcodeDetector) quando existe; senão, o leitor próprio de EAN (ean.js), que funciona no Safari do iPhone.
let camSemCodigoDesde = 0;
let camStream = null, camTimer = null, camUltimo = null, camUltimoEm = 0, camEmAnalise = false;

function camMsg(texto, ruim) {
  const m = $('#cMsg');
  m.textContent = texto;
  m.style.color = ruim ? 'var(--out)' : '';
}

function camParar() {
  clearInterval(camTimer); camTimer = null;
  if (camStream) camStream.getTracks().forEach((t) => t.stop());
  camStream = null;
  $('#cVideo').srcObject = null;
}

async function camAbrir() {
  $('#dCamera').showModal();
  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const porta = 3443;
    const https = `https://${location.hostname}:${porta}`;
    $('#cMsg').innerHTML = `A câmera só funciona em endereço seguro (HTTPS). Abra o sistema por <b>${https}</b>. Se não abrir, o administrador precisa gerar o certificado (docs/https-celular.md).`;
    return;
  }
  camMsg('Abrindo a câmera…');
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
  } catch (e) {
    camMsg(e && e.name === 'NotAllowedError' ? 'Permissão da câmera negada. Libere a câmera para este site nas configurações do navegador.' : 'Não consegui abrir a câmera: ' + (e && e.message || e), true);
    return;
  }
  const v = $('#cVideo');
  v.srcObject = camStream;
  try { await v.play(); } catch { /* o navegador pode já estar reproduzindo */ }
  camMsg('Aponte para o código de barras, com a linha vermelha cruzando todas as barras.');
  const detector = ('BarcodeDetector' in window) ? new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a'] }) : null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let anterior = null;
  camTimer = setInterval(async () => {
    if (camEmAnalise || !v.videoWidth) return;
    camEmAnalise = true;
    try {
      let codigo = null;
      if (detector) {
        const r = await detector.detect(v);
        codigo = r[0] ? r[0].rawValue : null;
      } else {
        const w = Math.min(1280, v.videoWidth), h = Math.round(v.videoHeight * (w / v.videoWidth));
        canvas.width = w; canvas.height = h;
        ctx.drawImage(v, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        codigo = EAN.lerImagem(img.data, w, h, { de: 0.3, ate: 0.7, linhas: 25 });
      }
      // só aceita depois de ler o mesmo código duas vezes seguidas (evita leitura errada)
      if (!codigo) { if (!camSemCodigoDesde) camSemCodigoDesde = Date.now(); } else camSemCodigoDesde = 0;
      if (codigo && codigo === anterior) camAceitar(codigo);
      anterior = codigo;
    } catch { /* quadro ruim: tenta o próximo */ }
    camEmAnalise = false;
  }, 140);
}

function camAceitar(codigo) {
  const agora = Date.now();
  // O mesmo produto parado na frente da câmera conta UMA vez. Para contar de novo, tire o código da frente
  // da câmera por um instante (ou deixe passar 8 s). Para várias unidades, use o campo Quantidade.
  if (codigo === camUltimo && !(camSemCodigoDesde && agora - camSemCodigoDesde > 700) && agora - camUltimoEm < 8000) return;
  camUltimo = codigo; camUltimoEm = agora; camSemCodigoDesde = 0;
  if (navigator.vibrate) navigator.vibrate(60);
  camMsg('Lido: ' + codigo);
  registrarCodigo(codigo);
}

$('#bCamera').onclick = camAbrir;
$('#cFechar').onclick = () => $('#dCamera').close();
$('#dCamera').addEventListener('close', () => { camParar(); camUltimo = null; $('#scan').focus(); });

// Backup do banco: cópia consistente (VACUUM INTO) mesmo com o servidor em uso, mantendo as mais recentes.
const fs = require('node:fs');
const path = require('node:path');

const p2 = (n) => String(n).padStart(2, '0');
const PADRAO = /^estoque-.*\.db$/;

function criarBackup(db, pasta, manter = 30, agora = new Date()) {
  fs.mkdirSync(pasta, { recursive: true });
  const nome = `estoque-${agora.getFullYear()}-${p2(agora.getMonth() + 1)}-${p2(agora.getDate())}-${p2(agora.getHours())}${p2(agora.getMinutes())}.db`;
  const arquivo = path.join(pasta, nome);
  if (fs.existsSync(arquivo)) fs.unlinkSync(arquivo); // dois backups no mesmo minuto: fica o mais novo
  db.exec(`VACUUM INTO '${arquivo.replace(/'/g, "''")}'`);
  const antigos = fs.readdirSync(pasta).filter((f) => PADRAO.test(f)).sort().reverse().slice(manter);
  for (const f of antigos) fs.unlinkSync(path.join(pasta, f));
  return arquivo;
}

// Idade (em horas) do backup mais recente da pasta, ou Infinity se não houver nenhum.
function horasDesdeUltimo(pasta) {
  try {
    const datas = fs.readdirSync(pasta).filter((f) => PADRAO.test(f)).map((f) => fs.statSync(path.join(pasta, f)).mtimeMs);
    return datas.length ? (Date.now() - Math.max(...datas)) / 3_600_000 : Infinity;
  } catch { return Infinity; }
}

// Faz um backup ao ligar (se o último for mais velho que o intervalo) e repete a cada "horas".
function iniciarBackupAutomatico(db, { pasta, horas = 24, manter = 30, aoFalhar = console.error }) {
  const executar = () => {
    try { criarBackup(db, pasta, manter); } catch (e) { aoFalhar('Falha no backup automático:', e.message); }
  };
  if (horasDesdeUltimo(pasta) >= horas) executar();
  const timer = setInterval(executar, horas * 3_600_000);
  timer.unref();
  return () => clearInterval(timer);
}

module.exports = { criarBackup, iniciarBackupAutomatico, horasDesdeUltimo };

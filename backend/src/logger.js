import fs from 'node:fs';
import path from 'node:path';

// Log de auditoria em ARQUIVO (JSON por linha). Registra mutações (CRUD) e erros.
// Rotação simples de arquivo único: ao passar do limite, apaga o antigo e recomeça
// um app.log limpo (sempre o mesmo nome, sem numeração) — mantém o disco limitado.
const LOG_DIR = process.env.LOG_DIR || '/data/logs';
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const MAX_BYTES = Number(process.env.LOG_MAX_BYTES) || 5 * 1024 * 1024; // 5 MB

try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch { /* ignore */ }

function rotateIfNeeded() {
  try {
    const st = fs.statSync(LOG_FILE);
    if (st.size >= MAX_BYTES) fs.rmSync(LOG_FILE, { force: true }); // apaga; o append recria limpo
  } catch { /* arquivo ainda não existe */ }
}

// Nunca deixa o log quebrar um request (try/catch total; append assíncrono).
export function logEvent(evt) {
  try {
    rotateIfNeeded();
    const line = JSON.stringify({ ts: new Date().toISOString(), ...evt }) + '\n';
    fs.appendFile(LOG_FILE, line, () => {});
  } catch { /* ignore */ }
}

export const LOG_PATH = LOG_FILE;

import fs from 'node:fs';
import path from 'node:path';

// Log de auditoria em ARQUIVO (JSON por linha). Registra mutações (CRUD) e erros.
// Rotação simples de arquivo único: ao passar do limite, apaga o antigo e recomeça
// um app.log limpo (sempre o mesmo nome, sem numeração) — mantém o disco limitado.
const LOG_DIR = process.env.LOG_DIR || '/data/logs';
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const MAX_BYTES = Number(process.env.LOG_MAX_BYTES) || 5 * 1024 * 1024; // 5 MB

// Log das instalações dos clientes (heartbeat). Arquivo próprio porque o volume é
// outro: são ~120 linhas por hora POR CLIENTE, e misturar isso no app.log faria a
// auditoria de CRUD ser apagada pelo barulho do heartbeat.
const CLIENTES_FILE = path.join(LOG_DIR, 'clientes-logs.log');
const CLIENTES_MAX_BYTES = Number(process.env.LOG_CLIENTES_MAX_BYTES) || 10 * 1024 * 1024; // 10 MB

try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch { /* ignore */ }

// SEMPRE UM ÚNICO ARQUIVO por tipo de log. Ao bater o limite, o arquivo é apagado
// e o próximo append o recria vazio — nunca app.log.1, clientes-logs-2 e afins.
// Numeração acumularia disco sem ninguém perceber, que é justamente o que se
// quer evitar aqui.
function truncarSePassou(arquivo, max) {
  try {
    const st = fs.statSync(arquivo);
    if (st.size >= max) fs.rmSync(arquivo, { force: true });
  } catch { /* arquivo ainda não existe */ }
}

function escrever(arquivo, max, evt) {
  try {
    truncarSePassou(arquivo, max);
    const line = JSON.stringify({ ts: new Date().toISOString(), ...evt }) + '\n';
    fs.appendFile(arquivo, line, () => {});
  } catch { /* ignore */ }
}

// Nunca deixa o log quebrar um request (try/catch total; append assíncrono).
export function logEvent(evt) {
  escrever(LOG_FILE, MAX_BYTES, evt);
}

/** Heartbeat das instalações. Vai para clientes-logs.log, cortado em 10 MB. */
export function logCliente(evt) {
  escrever(CLIENTES_FILE, CLIENTES_MAX_BYTES, evt);
}

export const LOG_PATH = LOG_FILE;
export const LOG_CLIENTES_PATH = CLIENTES_FILE;

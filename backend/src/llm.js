import fs from 'node:fs';
import path from 'node:path';

// Integrações de IA do base44 (InvokeLLM / ExtractData), com seletor de provedor:
//   - OpenAI    (api.openai.com/v1/chat/completions)  ← usado se OPENAI_API_KEY setada
//   - Anthropic (api.anthropic.com/v1/messages)       ← fallback se ANTHROPIC_API_KEY setada
// Sem SDK extra — usa fetch nativo do Node 20.

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.LLM_MODEL || 'claude-sonnet-4-6';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';

// OpenAI tem precedência se ambas estiverem setadas.
const PROVIDER = OPENAI_API_KEY ? 'openai' : (ANTHROPIC_API_KEY ? 'anthropic' : null);

export const llmAvailable = () => Boolean(OPENAI_API_KEY || ANTHROPIC_API_KEY);

const IMG = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

// Lê os bytes de um arquivo (de /api/files/... no disco, ou de uma URL http).
async function readBytes(url) {
  if (!url) return null;
  try {
    const m = String(url).match(/\/files\/([^/?#]+)/);
    if (m) {
      const file = path.basename(decodeURIComponent(m[1]));
      const full = path.join(UPLOAD_DIR, file);
      if (!fs.existsSync(full)) return null;
      return { buf: fs.readFileSync(full), ext: path.extname(file).toLowerCase() };
    }
    if (/^https?:\/\//.test(url)) {
      const r = await fetch(url);
      if (!r.ok) return null;
      return { buf: Buffer.from(await r.arrayBuffer()), ext: path.extname(new URL(url).pathname).toLowerCase() };
    }
  } catch { /* noop */ }
  return null;
}

function extractJson(text) {
  try { return JSON.parse(text); } catch { /* tenta extrair */ }
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* noop */ } }
  return { _raw: text };
}

// ───────────── OpenAI ─────────────
async function fileToOpenAI(url) {
  const f = await readBytes(url);
  if (!f) return null;
  if (IMG[f.ext]) {
    return { type: 'image_url', image_url: { url: `data:${IMG[f.ext]};base64,${f.buf.toString('base64')}` } };
  }
  return null; // chat/completions não aceita PDF direto (tratado nas functions)
}

async function callOpenAI({ prompt = '', response_json_schema, file_urls = [], system, model, max_tokens = 4096 }) {
  const content = [];
  const urls = (Array.isArray(file_urls) ? file_urls : [file_urls]).filter(Boolean);
  for (const u of urls) { const b = await fileToOpenAI(u); if (b) content.push(b); }

  let userText = prompt;
  if (response_json_schema) {
    userText += `\n\nResponda ESTRITAMENTE com um único JSON (json) válido que satisfaça este JSON Schema, sem nenhum texto fora do JSON:\n${JSON.stringify(response_json_schema)}`;
  }
  content.push({ type: 'text', text: userText });

  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content });

  const body = { model: model || OPENAI_MODEL, max_tokens, messages };
  if (response_json_schema) body.response_format = { type: 'json_object' };

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw Object.assign(new Error(`llm_request_failed_${res.status}`), { status: 502, detail });
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  return response_json_schema ? extractJson(text) : text;
}

// ───────────── Anthropic ─────────────
async function fileToAnthropic(url) {
  const f = await readBytes(url);
  if (!f) return null;
  const b64 = f.buf.toString('base64');
  if (IMG[f.ext]) return { type: 'image', source: { type: 'base64', media_type: IMG[f.ext], data: b64 } };
  if (f.ext === '.pdf') return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } };
  return null;
}

async function callAnthropic({ prompt = '', response_json_schema, file_urls = [], system, model, max_tokens = 4096 }) {
  const content = [];
  const urls = (Array.isArray(file_urls) ? file_urls : [file_urls]).filter(Boolean);
  for (const u of urls) { const b = await fileToAnthropic(u); if (b) content.push(b); }

  let userText = prompt;
  if (response_json_schema) {
    userText += `\n\nResponda ESTRITAMENTE com um único JSON válido que satisfaça este JSON Schema, sem nenhum texto fora do JSON:\n${JSON.stringify(response_json_schema)}`;
  }
  content.push({ type: 'text', text: userText });

  const body = { model: model || ANTHROPIC_MODEL, max_tokens, messages: [{ role: 'user', content }] };
  if (system) body.system = system;

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw Object.assign(new Error(`llm_request_failed_${res.status}`), { status: 502, detail });
  }
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return response_json_schema ? extractJson(text) : text;
}

export async function invokeLLM(args = {}) {
  if (!PROVIDER) {
    throw Object.assign(new Error('LLM não configurado: defina OPENAI_API_KEY (ou ANTHROPIC_API_KEY) no .env'), { status: 501 });
  }
  return PROVIDER === 'openai' ? callOpenAI(args) : callAnthropic(args);
}

// base44.integrations.Core.ExtractDataFromUploadedFile({ file_url, json_schema })
export async function extractData(args = {}) {
  const { file_url, json_schema, prompt } = args;
  const out = await invokeLLM({
    prompt: prompt || 'Extraia os dados estruturados presentes no arquivo anexado.',
    response_json_schema: json_schema,
    file_urls: [file_url],
  });
  return { status: 'success', output: out };
}

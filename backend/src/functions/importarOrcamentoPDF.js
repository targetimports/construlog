import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Importa orçamento sintético a partir de PDF (OrçaFácio, SICONV, etc.).
// Renderiza as páginas em imagem (poppler/pdftoppm) e usa visão (OpenAI gpt-4o) para
// extrair os itens, devolvendo NO MESMO FORMATO de importarOrcamentoSintetico — assim
// o wizard (etapas de revisão/finalização) segue igual. É ADITIVO: não toca no xlsx.

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';
const MODEL = process.env.ORCA_PDF_MODEL || 'gpt-4o'; // gpt-4o lê tabela densa melhor que o mini
const MAX_PAGES = Number(process.env.ORCA_PDF_MAX_PAGES || 30);

function resolvePath(fileUrl) {
  const m = String(fileUrl || '').match(/\/files\/([^/?#]+)/);
  if (!m) throw Object.assign(new Error('file_url inválido.'), { status: 400 });
  const full = path.join(UPLOAD_DIR, path.basename(decodeURIComponent(m[1])));
  if (!fs.existsSync(full)) throw Object.assign(new Error('Arquivo não encontrado no servidor.'), { status: 400 });
  return full;
}

function renderPaginas(pdfPath) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orcapdf-'));
  try {
    execFileSync('pdftoppm', ['-r', '170', '-png', '-l', String(MAX_PAGES), pdfPath, path.join(dir, 'pg')], { stdio: 'ignore' });
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw Object.assign(new Error('Renderizador de PDF (poppler) indisponível no servidor.'), { status: 501 });
  }
  const pngs = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort()
    .map((f) => path.join(dir, f));
  return { dir, pngs };
}

const PROMPT = `Você é um extrator de PLANILHAS ORÇAMENTÁRIAS de obra (orçamento sintético).
As imagens são páginas de UM orçamento. Extraia TODOS os itens, na ordem em que aparecem.
Distinga:
- ETAPAS/grupos (numeração tipo "1", "1.2" — descrição, geralmente sem código/quantidade). tipo="etapa".
- SERVIÇOS (têm código do banco, unidade, quantidade e valores). tipo="servico".
Junte descrições quebradas em várias linhas num texto só. Ignore assinaturas, CNPJ/CPF/CREA e rodapés.
Para valor unitário, use o valor COM BDI quando houver as duas colunas (sem BDI e com BDI).
Números em pt-BR (1.234,56) devem virar número JS (1234.56). NÃO invente itens nem valores.
Responda em JSON válido:
{"obra":string,"bdi_percent":number|null,"total_geral":number|null,
 "itens":[{"item":string,"codigo":string|null,"banco":string|null,"descricao":string,
   "unidade":string|null,"quantidade":number|null,"valor_unitario":number|null,"total":number|null,
   "tipo":"etapa"|"servico"}]}`;

async function extrairComIA(pngs) {
  const KEY = process.env.OPENAI_API_KEY;
  if (!KEY) throw Object.assign(new Error('IA não configurada (defina OPENAI_API_KEY).'), { status: 501 });
  const content = [
    { type: 'text', text: PROMPT },
    ...pngs.map((p) => ({ type: 'image_url', image_url: { url: `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`, detail: 'high' } })),
  ];
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: 16000, response_format: { type: 'json_object' }, messages: [{ role: 'user', content }] }),
  });
  const j = await res.json();
  if (!res.ok) throw Object.assign(new Error('Falha na IA: ' + (j?.error?.message || res.status)), { status: 502 });
  const choice = j.choices?.[0] || {};
  // Resposta cortada por limite de tokens → JSON incompleto ("Unterminated string").
  if (choice.finish_reason === 'length') {
    throw Object.assign(new Error('Orçamento muito extenso para leitura por IA em uma única passada. Use a planilha (.xlsx) ou divida o PDF em partes.'), { status: 413 });
  }
  try {
    return JSON.parse(choice.message?.content || '{}');
  } catch {
    throw Object.assign(new Error('A IA devolveu uma resposta incompleta (orçamento muito grande). Use a planilha (.xlsx) ou um PDF menor.'), { status: 422 });
  }
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const r2 = (n) => Math.round(num(n) * 100) / 100;
const nivelDe = (item) => (String(item || '').match(/\./g) || []).length + 1;

export default async function importarOrcamentoPDF({ body }) {
  const { file_url, arquivo_nome } = body || {};
  if (!file_url) return { error: 'file_url obrigatório' };

  let pdfPath;
  try { pdfPath = resolvePath(file_url); } catch (e) { return { error: e.message }; }

  const { dir, pngs } = renderPaginas(pdfPath);
  try {
    if (!pngs.length) return { error: 'Não foi possível renderizar o PDF (0 páginas).' };

    const ai = await extrairComIA(pngs);
    const brutos = Array.isArray(ai.itens) ? ai.itens : [];
    if (!brutos.length) return { error: 'A IA não encontrou itens de orçamento neste PDF.' };

    const itens = brutos.map((it, idx) => {
      const quantidade = num(it.quantidade);
      const valor_unit = num(it.valor_unitario);
      const total = it.total != null ? num(it.total) : r2(quantidade * valor_unit);
      return {
        item: String(it.item || ''),
        descricao: String(it.descricao || '').trim(),
        und: it.unidade || null,
        quantidade,
        valor_unit,
        total,
        is_grupo: String(it.tipo || '').toLowerCase() === 'etapa',
        grupo_pai: null,
        nivel: nivelDe(it.item),
        ordem: idx,
        codigo: it.codigo || null,
        banco: it.banco || null,
      };
    });

    const grupos = itens.filter((i) => i.is_grupo);
    const subItens = itens.filter((i) => !i.is_grupo);
    let totalGeral = num(ai.total_geral) || subItens.reduce((s, i) => s + i.total, 0);
    totalGeral = r2(totalGeral);
    let bdiPercent = num(ai.bdi_percent);
    const totalSemBdi = bdiPercent > 0 ? r2(totalGeral / (1 + bdiPercent / 100)) : 0;
    const totalBdi = totalSemBdi > 0 ? r2(totalGeral - totalSemBdi) : 0;

    const nomeObra = (ai.obra && String(ai.obra).trim())
      || String(arquivo_nome || 'orcamento.pdf').replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();

    return {
      sucesso: true,
      import_id: null,
      origem: 'pdf',
      meta: {
        nome_obra: nomeObra,
        bdi_percent: bdiPercent,
        total_sem_bdi: totalSemBdi,
        total_bdi: totalBdi,
        total_geral: totalGeral,
        paginas: pngs.length,
        modelo_ia: MODEL,
      },
      itens,
      resumo: { total_linhas: itens.length, total_grupos: grupos.length, total_itens: subItens.length },
    };
  } catch (e) {
    return { error: e.message || 'Falha ao processar o PDF.' };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

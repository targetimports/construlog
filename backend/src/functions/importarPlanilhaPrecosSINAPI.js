import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { store } from '../entityStore.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';

function parseValorBR(valor) {
  if (valor == null || valor === '') return 0;
  if (typeof valor === 'number') return valor;
  const str = String(valor).replace(/[^\d,.-]/g, '');
  if (!str) return 0;
  const hasCommaDecimal = str.includes(',') && str.lastIndexOf(',') > str.lastIndexOf('.');
  const normalized = hasCommaDecimal ? str.replace(/\./g, '').replace(',', '.') : str.replace(',', '');
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

// Lê o arquivo enviado (UploadFile grava em UPLOAD_DIR; file_url = /api/files/<nome>).
function lerBuffer(fileUrl) {
  const m = String(fileUrl || '').match(/\/files\/([^/?#]+)/);
  if (m) {
    const file = path.basename(decodeURIComponent(m[1]));
    const full = path.join(UPLOAD_DIR, file);
    if (!fs.existsSync(full)) throw Object.assign(new Error('Arquivo não encontrado no servidor.'), { status: 400 });
    return fs.readFileSync(full);
  }
  throw Object.assign(new Error('file_url inválido.'), { status: 400 });
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

// Normaliza o grupo lido para os valores do cadastro de Insumo.
function normalizarGrupo(valor) {
  const g = norm(valor);
  if (!g) return 'material';
  if (g.includes('mao') || g.includes('obra')) return 'mao_obra';
  if (g.includes('equip')) return 'equipamento';
  if (g.includes('serv')) return 'servico';
  if (g.includes('mat')) return 'material';
  return 'material';
}

// Importa uma planilha de preços (SINAPI/genérica) direto para a base mestre de
// custos (entidade Insumo). Detecta Código / Descrição / Unidade / Preço e
// cria ou atualiza insumos. Mudança de preço registra em `historico_precos`.
// modo_importacao: 'novo' (só insere) | 'atualizar' (atualiza existentes + insere novos).
export default async function importarPlanilhaPrecosSINAPI({ body, user }) {
  const { file_url, modo_importacao } = body || {};
  if (!file_url) return { status: 'erro', mensagem: 'file_url obrigatório.' };
  const modo = modo_importacao === 'atualizar' ? 'atualizar' : 'novo';

  let buffer;
  try { buffer = lerBuffer(file_url); }
  catch (e) { return { status: 'erro', mensagem: e.message || 'Falha ao acessar o arquivo.' }; }
  if (buffer.byteLength > 15 * 1024 * 1024) {
    return { status: 'erro', mensagem: `Arquivo muito grande (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB). Limite: 15 MB.` };
  }

  let workbook;
  try { workbook = XLSX.read(buffer, { type: 'buffer' }); }
  catch { return { status: 'erro', mensagem: 'Arquivo inválido ou corrompido. Use .xlsx, .xls ou .csv.' }; }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { status: 'erro', mensagem: 'Nenhuma planilha encontrada no arquivo.' };

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rows.length) return { status: 'erro', mensagem: 'Planilha vazia.' };

  // Cabeçalho: primeira linha (até 20) com "Descrição" + "Preço/Custo/Valor".
  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const h = rows[i].map(norm);
    const hasDesc = h.some((c) => c.includes('descri'));
    const hasPreco = h.some((c) => c.includes('preco') || c.includes('custo') || c.includes('valor'));
    if (hasDesc && hasPreco) { headerIdx = i; break; }
  }
  if (headerIdx === -1) {
    return { status: 'erro', mensagem: 'Cabeçalho não encontrado. A planilha precisa ter colunas "Descrição" e "Preço/Custo".' };
  }

  const header = rows[headerIdx].map(norm);
  const findCol = (...ms) => {
    for (const m of ms) {
      const idx = header.findIndex((h) => (typeof m === 'function' ? m(h) : h.includes(m)));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const idxCodigo = findCol('codigo', 'cod.', (h) => h === 'cod' || h === 'cód');
  const idxDesc = findCol('descri');
  const idxUnid = findCol((h) => h === 'und' || h === 'und.' || h === 'un' || h === 'un.' || h === 'unidade' || h.startsWith('unid'));
  const idxPreco = findCol(
    (h) => h.includes('preco unit') || h.includes('custo unit') || h.includes('valor unit'),
    (h) => (h.includes('preco') || h.includes('custo')) && !h.includes('total'),
    (h) => h.includes('valor') && !h.includes('total')
  );
  const idxGrupo = findCol('grupo', 'categoria', 'classe', 'tipo');

  if (idxDesc < 0 || idxPreco < 0) {
    return { status: 'erro', mensagem: 'Não encontrei as colunas obrigatórias "Descrição" e "Preço".' };
  }

  // Carrega os insumos existentes uma vez (mapa por código).
  const existentes = await store.filter('Insumo', {}, null, 100000).catch(() => []);
  const mapaPorCodigo = new Map();
  for (const it of existentes) {
    if (it.codigo) mapaPorCodigo.set(String(it.codigo).trim().toLowerCase(), it);
  }

  const hoje = new Date().toISOString().split('T')[0];
  let inseridos = 0, atualizados = 0, erros = 0, ignorados = 0;
  const vistos = new Set();

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const descricao = String(row[idxDesc] ?? '').trim();
    if (!descricao) continue;

    let codigo = idxCodigo >= 0 ? String(row[idxCodigo] ?? '').trim() : '';
    if (!codigo) codigo = descricao.slice(0, 80);
    const chave = codigo.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    const preco = parseValorBR(row[idxPreco]);
    if (preco <= 0) { ignorados++; continue; } // grupos/subtotais/linhas sem preço

    const unidade = idxUnid >= 0 ? (String(row[idxUnid] ?? '').trim() || 'un') : 'un';
    const grupo = idxGrupo >= 0 ? normalizarGrupo(row[idxGrupo]) : 'material';

    try {
      const existente = mapaPorCodigo.get(chave);
      if (existente) {
        if (modo === 'novo') { ignorados++; continue; }
        const precoAnterior = Number(existente.preco_unitario) || 0;
        const historico = Array.isArray(existente.historico_precos) ? existente.historico_precos : [];
        if (precoAnterior !== preco) {
          historico.push({ preco: precoAnterior, data: existente.data_preco || hoje, usuario: user?.email || 'importação' });
        }
        await store.update('Insumo', existente.id, {
          descricao,
          unidade,
          preco_unitario: preco,
          data_preco: hoje,
          base: existente.base || 'sinapi',
          historico_precos: historico,
        });
        atualizados++;
      } else {
        const novo = await store.create('Insumo', {
          codigo,
          descricao,
          unidade,
          grupo,
          tipo: grupo,
          base: 'sinapi',
          preco_unitario: preco,
          data_preco: hoje,
          ativo: true,
          observacoes: '',
          historico_precos: [],
        }, user?.email || null);
        mapaPorCodigo.set(chave, novo);
        inseridos++;
      }
    } catch {
      erros++;
    }
  }

  return {
    status: 'sucesso',
    resumo: { inseridos, atualizados, erros, ignorados },
    mensagem:
      `${inseridos} inserido(s), ${atualizados} atualizado(s)` +
      (ignorados ? `, ${ignorados} ignorado(s) (sem preço/duplicado)` : '') +
      (erros ? `, ${erros} com erro` : '') + '.',
  };
}

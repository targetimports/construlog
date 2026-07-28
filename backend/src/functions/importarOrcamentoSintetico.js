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

function findMaiorNumerico(rowArr) {
  let maior = 0;
  for (const v of rowArr) {
    const n = parseValorBR(v);
    if (n > maior) maior = n;
  }
  return maior;
}

// Detecta linhas que NÃO são itens do orçamento: assinaturas (só "____"),
// identificação da empresa/responsável (CNPJ, CPF, CREA, sócio, engenheiro...),
// que aparecem no rodapé da planilha e eram lidas erroneamente como itens.
function ehLinhaNaoItem(desc) {
  const d = String(desc || '');
  // Linha de assinatura: praticamente só underscores/traços/pontos/espaços.
  if (d.replace(/[_\-.\s]/g, '').length < 3) return true;
  if (/\bCNPJ\b|\bC\.?P\.?F\b|\bCREA\b|\bSSP\b|\bRG\s*\d|S[ÓO]CIO|ADMINISTRADOR|ENGENHEIRO\s+CIVIL|RESPONS[ÁA]VEL\s+T[ÉE]CNICO|ASSINATURA/i.test(d)) return true;
  return false;
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

export default async function importarOrcamentoSintetico({ body, user }) {
  const { file_url, arquivo_nome, obra_id, salvar_banco } = body || {};
  if (!file_url) return { error: 'file_url obrigatório' };

  let buffer;
  try {
    buffer = lerBuffer(file_url);
  } catch (e) {
    return { error: e.message || 'Falha ao acessar o arquivo.' };
  }
  if (buffer.byteLength > 10 * 1024 * 1024) {
    return { error: `Arquivo muito grande (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB). Limite: 10 MB.` };
  }

  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch (e) {
    return { error: 'Arquivo Excel inválido ou corrompido. Confirme que é .xlsx/.xls.' };
  }

  // Aba
  const candidatos = ['Orçamento Sintético', 'Orcamento Sintetico', 'Sintético', 'Sintetico', 'SINTÉTICO', 'Orçamento'];
  let sheetName = workbook.SheetNames[0];
  for (const nome of candidatos) {
    if (workbook.SheetNames.includes(nome)) { sheetName = nome; break; }
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { error: 'Nenhuma planilha encontrada no arquivo.' };

  // Array de arrays resolvendo merges
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const merged = {};
  for (const mm of (sheet['!merges'] || [])) {
    const masterCell = sheet[XLSX.utils.encode_cell({ r: mm.s.r, c: mm.s.c })];
    const val = masterCell ? (masterCell.w ?? masterCell.v ?? '') : '';
    for (let r = mm.s.r; r <= mm.e.r; r++) {
      for (let c = mm.s.c; c <= mm.e.c; c++) {
        if (r === mm.s.r && c === mm.s.c) continue;
        merged[`${r}_${c}`] = val;
      }
    }
  }
  const rows = [];
  for (let R = range.s.r; R <= range.e.r; ++R) {
    const row = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const key = `${R}_${C}`;
      if (merged[key] !== undefined) row.push(merged[key]);
      else { const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })]; row.push(cell ? (cell.v ?? '') : ''); }
    }
    rows.push(row);
  }

  // Linha de cabeçalho
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const norm = rows[i].map((c) => String(c || '').toLowerCase().replace(/\s+/g, ' ').trim());
    const hasItem = norm.some((c) => c === 'item' || c === 'item.');
    const hasDesc = norm.some((c) => c.includes('descri'));
    const hasUnd = norm.some((c) => c === 'und' || c === 'und.' || c === 'unidade' || c === 'un' || c === 'un.' || c.startsWith('unid'));
    const hasQuant = norm.some((c) => c.startsWith('quant'));
    if (hasItem && hasDesc && (hasUnd || hasQuant)) { headerRowIdx = i; break; }
  }
  if (headerRowIdx === -1) {
    for (let i = 0; i < Math.min(30, rows.length); i++) {
      const norm = rows[i].map((c) => String(c || '').toLowerCase().replace(/\s+/g, ' ').trim());
      if (norm.some((c) => c === 'item' || c === 'item.') && norm.some((c) => c.includes('descri'))) { headerRowIdx = i; break; }
    }
  }
  if (headerRowIdx === -1) {
    return { error: 'Cabeçalho não encontrado (procurei "Item" + "Descrição" + "Und"/"Quant." nas primeiras 30 linhas). Verifique se a planilha está no formato do Orçafáscio.' };
  }

  const hRow = rows[headerRowIdx].map((c) => String(c || '').toLowerCase().replace(/\s+/g, ' ').trim());
  const findCol = (...matchers) => {
    for (const m of matchers) {
      const idx = hRow.findIndex((h) => (typeof m === 'function' ? m(h) : h === m || h.includes(m)));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const idxItem = findCol((h) => h === 'item' || h === 'item.');
  const idxDesc = findCol('descrição', 'descricao', 'descriçao', 'descr');
  const idxCodigo = findCol((h) => h === 'código' || h === 'codigo' || h === 'cód.' || h === 'cod.' || h === 'cod');
  const idxBanco = findCol('banco', 'base de preço', 'tabela');
  const idxUnd = findCol((h) => h === 'und' || h === 'und.' || h === 'unidade' || h === 'un' || h === 'un.' || h.startsWith('unid'));
  const idxQuant = findCol('quant');
  const idxValorUnit = findCol((h) => (h.includes('unit') || h.includes('preço unit') || h.includes('preco unit') || h === 'p.unit.' || h === 'p. unit.') && !h.includes('bdi') && !h.includes('c/') && !h.includes('total'));
  const idxValorUnitBdi = findCol((h) => (h.includes('unit') || h.includes('preço') || h.includes('preco')) && (h.includes('bdi') || h.includes('c/bdi')));
  const idxTotal = findCol((h) => (h === 'total' || h.includes('valor total') || h.includes('total r$') || h.includes('preço total')) && !h.includes('sem bdi') && !h.includes('c/bdi'));

  const faltando = [];
  if (idxItem < 0) faltando.push('"Item"');
  if (idxDesc < 0) faltando.push('"Descrição"');
  if (faltando.length > 0) {
    return { error: `Não encontrei a(s) coluna(s) obrigatória(s): ${faltando.join(', ')}.`, debug: { headerRowIdx, hRow } };
  }

  const colunasDetectadas = { item: idxItem, descricao: idxDesc, codigo: idxCodigo, banco: idxBanco, und: idxUnd, quant: idxQuant, valor_unit: idxValorUnit, valor_unit_bdi: idxValorUnitBdi, total: idxTotal };

  // CONTRATANTE / OBJETO — planilha de licitação traz isso como TEXTO CORRIDO numa
  // célula mesclada do topo (com quebras de linha), não como rótulo+valor. Ex.:
  //   "Á COMISSÃO DE LICITAÇÃO DA PREFEITURA MUNICIPAL DE MONTE SANTO-BA
  //    MODALIDADE: CONCORRÊNCIA ELETRÔNICA Nº 012/2026
  //    OBJETO: Contratação de empresa especializada..."
  // Por isso varremos LINHA A LINHA do texto, e não célula a célula.
  const cabecalho = extrairCabecalhoLicitacao(rows, headerRowIdx);

  // Metadados (linhas antes do cabeçalho). No layout OrçaFáscio, "Obra" e "B.D.I."
  // costumam ser RÓTULOS numa linha, com o VALOR na linha logo abaixo (mesma coluna).
  const ROTULO_META = /^(bancos?|b\.?d\.?i\.?|encargos( sociais)?|base( de pre[çc]os?)?|tabela|obra|refer[êe]ncia)$/i;
  let nomeObra = '';
  let bdiPercent = 0;
  for (let i = 0; i < headerRowIdx; i++) {
    const rowStr = rows[i].map((c) => String(c || '').trim());
    if (!nomeObra) {
      for (let c = 0; c < rowStr.length; c++) {
        const cell = rowStr[c].toLowerCase().replace(/:$/, '').trim();
        if (cell === 'obra') {
          // 1º: valor na célula ABAIXO (linha de rótulos horizontais Obra|Bancos|BDI);
          //     2º: próxima célula à direita que NÃO seja outro rótulo (evita pegar "Bancos").
          const abaixo = String(rows[i + 1]?.[c] ?? '').trim();
          if (abaixo.length > 3 && !ROTULO_META.test(abaixo)) { nomeObra = abaixo; break; }
          const next = rowStr.slice(c + 1).find((v) => v.length > 3 && !ROTULO_META.test(v));
          if (next) { nomeObra = next; break; }
        }
        const mObra = rowStr[c].match(/^obra[:\s]+(.+)/i);
        if (mObra && mObra[1].trim().length > 2) { nomeObra = mObra[1].trim(); break; }
      }
    }
    if (!bdiPercent) {
      const joined = rowStr.join(' ').toLowerCase();
      if (/b\.?d\.?i/i.test(joined)) {
        for (let c = 0; c < rowStr.length; c++) {
          if (/b\.?d\.?i/i.test(rowStr[c])) {
            // valor na célula ABAIXO do rótulo, senão nas próximas células à direita.
            const abaixo = parseValorBR(rows[i + 1]?.[c]);
            if (abaixo > 0 && abaixo < 200) { bdiPercent = abaixo; break; }
            for (let off = 1; off <= 5; off++) { const v = parseValorBR(rowStr[c + off]); if (v > 0 && v < 200) { bdiPercent = v; break; } }
            if (bdiPercent) break;
          }
        }
        if (!bdiPercent) { const mBdi = rowStr.join(' ').match(/b\.?d\.?i[^0-9]*(\d+[\d.,]*)\s*%/i); if (mBdi) bdiPercent = parseValorBR(mBdi[1]); }
      }
    }
  }
  // Limpa prefixo "Cópia de:" que às vezes vem no nome interno da planilha.
  if (nomeObra) nomeObra = nomeObra.replace(/^c[óo]pia de[:\s_-]*/i, '').trim();

  // Totais do rodapé
  let totalSemBdi = 0, totalBdi = 0, totalGeral = 0;
  for (let i = Math.max(headerRowIdx + 1, rows.length - 50); i < rows.length; i++) {
    const rowStr = rows[i].map((c) => String(c || '').trim());
    const joined = rowStr.join(' ').toLowerCase();
    if (/total.*sem.*bdi|sem.*bdi.*total/i.test(joined) && !totalSemBdi) { const v = findMaiorNumerico(rowStr); if (v > 0) totalSemBdi = v; }
    if (/total.*do.*bdi|valor.*do.*bdi|bdi.*total/i.test(joined) && !joined.includes('sem') && !totalBdi) { const v = findMaiorNumerico(rowStr); if (v > 0) totalBdi = v; }
    if (/(total geral|total da obra|total do or[cç]amento|total c[/\s]*bdi)/i.test(joined) && !totalGeral) { const v = findMaiorNumerico(rowStr); if (v > 0) totalGeral = v; }
  }

  // Itens
  const itens = [];
  let ordem = 0;
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const itemRaw = String(row[idxItem] ?? '').trim();
    const descRaw = String(row[idxDesc] ?? '').trim();
    if (!itemRaw) continue;
    const primeiraCol = String(row[0] ?? '').trim().toLowerCase();
    if (/^(total|b\.?d\.?i|data:|revisão|elaborado|aprovado)/i.test(primeiraCol)) continue;
    if (/^(total|b\.?d\.?i)/i.test(descRaw)) continue;
    if (!descRaw && !String(row[idxUnd] ?? '').trim()) continue;
    // Código de item válido começa com dígito (1, 1.1, 2.3...); rodapés/assinaturas não.
    if (!/^\d/.test(itemRaw)) continue;
    // Assinatura / identificação da empresa lida como item (ex.: linha com CNPJ/CREA).
    if (ehLinhaNaoItem(descRaw)) continue;

    const quant = idxQuant >= 0 ? parseValorBR(row[idxQuant]) : 0;
    const valorUnit = idxValorUnit >= 0 ? parseValorBR(row[idxValorUnit]) : 0;
    const valUnitBdi = idxValorUnitBdi >= 0 ? parseValorBR(row[idxValorUnitBdi]) : 0;
    const total = idxTotal >= 0 ? parseValorBR(row[idxTotal]) : (quant > 0 && valorUnit > 0 ? quant * valorUnit : 0);
    const isGrupo = /^\d+$/.test(itemRaw);
    const grupoPai = isGrupo ? null : (itemRaw.includes('.') ? itemRaw.split('.').slice(0, -1).join('.') : null);
    const nivel = isGrupo ? 0 : itemRaw.split('.').length;

    itens.push({
      item: itemRaw,
      codigo: idxCodigo >= 0 ? String(row[idxCodigo] ?? '').trim() : '',
      banco: idxBanco >= 0 ? String(row[idxBanco] ?? '').trim() : '',
      descricao: descRaw,
      und: idxUnd >= 0 ? String(row[idxUnd] ?? '').trim() : '',
      quantidade: quant,
      valor_unit: valorUnit,
      valor_unit_bdi: valUnitBdi,
      total,
      is_grupo: isGrupo,
      grupo_pai: grupoPai,
      nivel,
      ordem: ordem++,
    });
  }

  if (itens.length === 0) return { error: 'Nenhum item encontrado após o cabeçalho.' };

  // Detecção ESTRUTURAL de grupo: um item é grupo (subtotal) se existe outro
  // item cujo código começa com "<item>." — ou seja, possui filhos. Cobre todos
  // os níveis (1, 1.1, 1.1.1 …), não apenas o código inteiro de topo. O Total das
  // linhas de grupo é subtotal e NÃO pode ser somado como item, senão o valor da
  // obra infla (ex.: 3 níveis de grupo => ~3x o valor real).
  const codigosItens = itens.map((i) => i.item);
  for (const it of itens) {
    const prefixo = it.item + '.';
    it.is_grupo = codigosItens.some((c) => c !== it.item && c.startsWith(prefixo));
    it.nivel = it.item.split('.').length;
    it.grupo_pai = it.item.includes('.') ? it.item.split('.').slice(0, -1).join('.') : null;
  }

  const grupos = itens.filter((i) => i.is_grupo);
  const subItens = itens.filter((i) => !i.is_grupo);
  // O total geral é a soma apenas das FOLHAS (itens sem filhos); somar grupos
  // duplicaria os subtotais.
  if (!totalGeral) totalGeral = subItens.reduce((s, i) => s + i.total, 0);
  if (!totalSemBdi && bdiPercent > 0 && totalGeral > 0) totalSemBdi = totalGeral / (1 + bdiPercent / 100);
  if (!totalBdi && totalGeral > 0 && totalSemBdi > 0) totalBdi = totalGeral - totalSemBdi;

  // BDI% pelo rodapé quando não veio do topo (ex.: planilha sem "B.D.I." no cabeçalho,
  // mas com "Total sem BDI" + "Total do BDI"): % = total do BDI ÷ total sem BDI.
  if (!bdiPercent && totalBdi > 0 && totalSemBdi > 0) {
    bdiPercent = Math.round((totalBdi / totalSemBdi) * 10000) / 100;
  }
  // Nome da obra: fallback para o nome do arquivo (limpo) quando não há rótulo "Obra".
  if (!nomeObra && arquivo_nome) {
    nomeObra = String(arquivo_nome)
      .replace(/\.(xlsx?|xlsm)$/i, '')
      .replace(/c[óo]pia de[_:\s-]*/gi, '')
      .replace(/\s*-?\s*(planilha unificada|planilhas?|or[çc]amento sint[ée]tico|sint[ée]tico)\s*/gi, ' ')
      .replace(/\s*\(\d+\)\s*/g, ' ')
      .replace(/_+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Persistência opcional
  let importId = null;
  if (salvar_banco) {
    try {
      const rec = await store.create('OrcamentoSinteticoImport', {
        obra_id: obra_id || null, arquivo_nome: arquivo_nome || 'orcamento.xlsx', nome_obra: nomeObra,
        bdi_percent: bdiPercent, total_sem_bdi: Math.round(totalSemBdi * 100) / 100,
        total_bdi: Math.round(totalBdi * 100) / 100, total_geral: Math.round(totalGeral * 100) / 100,
        status: 'pendente', criado_por: user?.email,
      }, user?.email || null);
      importId = rec.id;
      const BATCH = 200;
      for (let b = 0; b < itens.length; b += BATCH) {
        const slice = itens.slice(b, b + BATCH).map((item) => ({
          import_id: importId, obra_id: obra_id || null, item: item.item, descricao: item.descricao,
          und: item.und, quantidade: item.quantidade, valor_unit: item.valor_unit, total: item.total,
          is_grupo: item.is_grupo, grupo_pai: item.grupo_pai || null, nivel: item.nivel, ordem: item.ordem,
        }));
        for (const it of slice) await store.create('OrcamentoSinteticoItens', it, user?.email || null);
      }
    } catch (dbErr) {
      // não bloqueia o retorno do parse
    }
  }

  return {
    sucesso: true,
    import_id: importId,
    meta: {
      nome_obra: nomeObra, bdi_percent: bdiPercent,
      // Sugestões do cabeçalho — a tela pré-preenche, o usuário confirma.
      cliente_nome: cabecalho.cliente || '',
      cliente_documento: cabecalho.documento || '',
      objeto: cabecalho.objeto || '',
      processo_licitacao: cabecalho.processo || '',
      total_sem_bdi: Math.round(totalSemBdi * 100) / 100,
      total_bdi: Math.round(totalBdi * 100) / 100,
      total_geral: Math.round(totalGeral * 100) / 100,
      sheet_name: sheetName, colunas_detectadas: colunasDetectadas,
    },
    itens,
    resumo: { total_linhas: itens.length, total_grupos: grupos.length, total_itens: subItens.length },
  };
}

// Lê o bloco de texto do topo da planilha (antes da tabela) procurando quem CONTRATA
// e o objeto. Planilha de licitação pública descreve isso em prosa, então casamos
// padrões em vez de rótulo+valor:
//   "CONTRATANTE: X" / "CLIENTE: X" / "ÓRGÃO: X"        → forma explícita
//   "...COMISSÃO DE LICITAÇÃO DA PREFEITURA DE X"       → forma do edital
//   "PREFEITURA MUNICIPAL DE X"                          → linha solta
// Não achar nada é normal (planilha particular) — a tela segue pedindo o cliente.
export function extrairCabecalhoLicitacao(rows, ate) {
  const limpa = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const linhas = [];
  for (let i = 0; i < Math.max(0, ate); i++) {
    for (const c of rows[i] || []) {
      // Célula mesclada guarda várias linhas num campo só.
      String(c || '').split('\n').forEach((l) => { const t = limpa(l); if (t) linhas.push(t); });
    }
  }

  let cliente = '', documento = '', objeto = '', processo = '';
  for (const l of linhas) {
    if (!cliente) {
      const m = l.match(/(?:contratante|cliente|[oó]rg[aã]o(?:\s+licitante)?|munic[ií]pio)\s*[:\-]\s*(.+)/i)
        || l.match(/comiss[aã]o\s+de\s+licita[cç][aã]o\s+d[ao]s?\s+(.+)/i)
        || l.match(/^(prefeitura\s+municipal\s+de\s+.+)/i);
      if (m) cliente = limpa(m[1]).replace(/[.,;]+$/, '');
    }
    // CNPJ com ou sem pontuação — guardado como veio; a comparação usa só dígitos.
    if (!documento) {
      const m = l.match(/\b(\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2})\b/);
      if (m) documento = m[1];
    }
    if (!objeto) { const m = l.match(/objeto\s*[:\-]\s*(.+)/i); if (m) objeto = limpa(m[1]); }
    if (!processo) {
      const m = l.match(/(?:modalidade|preg[aã]o|concorr[êe]ncia|tomada de pre[cç]os|dispensa)\s*[:\-]?\s*(.+)/i);
      if (m) processo = limpa(m[1]);
    }
  }
  return { cliente, documento, objeto, processo };
}

import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Processa linhas de uma planilha financeira importada -> cria ContaFinanceira por linha.
// Parser TOLERANTE: reconhece colunas por CABEÇALHO (fuzzy, sem acento) e, como
// fallback, por TIPO do dado (acha a célula que é data / que é número). Assim lê
// planilhas de layouts variados: ordem de coluna diferente, nomes de coluna/aba
// diferentes, datas dd/mm/aaaa · dd/mm/aa · aaaa-mm-dd · serial do Excel, valores
// "R$ 1.234,56" · "1.234,56" · "1234.56" · "(1.234,56)" (negativo), etc.

// Categoria/natureza sugeridas por nome de aba conhecida (opcional; fallback = nome da aba).
const ABA_REGRAS = {
  MATERIAL: { categoria: 'Material' }, MATERIAIS: { categoria: 'Material' },
  'ALIMENTAÇÃO': { categoria: 'Alimentação' }, ALIMENTACAO: { categoria: 'Alimentação' },
  FRETES: { categoria: 'Fretes' }, FRETE: { categoria: 'Fretes' },
  ESTADIAS: { categoria: 'Estadias' }, ESTADIA: { categoria: 'Estadias' },
  IMPOSTOS: { categoria: 'Impostos' }, IMPOSTO: { categoria: 'Impostos' },
  INVESTIMENTOS: { categoria: 'Investimentos', tipo: 'receita' }, INVESTIMENTO: { categoria: 'Investimentos', tipo: 'receita' },
  APORTE: { categoria: 'Aporte', tipo: 'receita' }, APORTES: { categoria: 'Aporte', tipo: 'receita' },
  RECEITA: { categoria: 'Receita', tipo: 'receita' }, RECEITAS: { categoria: 'Receita', tipo: 'receita' },
  'MEDIÇÃO': { categoria: 'Medição', tipo: 'receita' }, MEDICAO: { categoria: 'Medição', tipo: 'receita' }, 'MEDIÇÕES': { categoria: 'Medição', tipo: 'receita' },
  RETIRADA: { categoria: 'Retiradas' }, RETIRADAS: { categoria: 'Retiradas' },
  'ALUGUEL MAQ E COMBUSTIVEL': { categoria: 'Aluguel/Combustível' }, EQUIPAMENTOS: { categoria: 'Equipamento' },
  'MÃO DE OBRA': { categoria: 'Mão de Obra' }, 'MAO DE OBRA': { categoria: 'Mão de Obra' },
};

// Nomes de aba genéricos (sem significado) -> caem em 'Outros'.
const ABA_GENERICA = /^(SHEET|PLAN|PLANILHA|ABA|TAB|FOLHA)\s?\d*$/;

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

// Padrões de cabeçalho por campo (aplicados sobre o header normalizado sem acento).
const H = {
  data: /(data|dt|venc|competenc|\bdia\b|emiss|pagamento|receb)/,
  valor: /(valor|vlr|total|montante|preco|quantia|r\$|debito|credito|importancia|liquido)/,
  fornecedor: /(fornecedor|cliente|razao social|beneficiario|favorecido)/,
  descricao: /(descri|histor|nome|item|servico|produto|especific|referenc|\bobs\b|detalhe|memo|lancamento)/,
  forma: /(forma|pagamento|meio|pgto|\bmodo\b)/,
  categoria: /(categoria|classific|\bgrupo\b|conta cont|centro de custo)/,
  tipo: /(tipo|natureza|entrada.*saida|receita.*despesa|\bd\/c\b|debito.*credito)/,
};

// ---- Data flexível -> 'AAAA-MM-DD' ou null ----
function parseDataFlex(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s)) return s.slice(0, 10); // ISO datetime
  // Serial do Excel (dias desde 1899-12-30). Faixa ~2015..2100 p/ evitar confundir com valores.
  if (/^\d{4,6}([.,]\d+)?$/.test(s)) {
    const n = Number(s.replace(',', '.'));
    if (n > 42000 && n < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
      if (!isNaN(d)) return d.toISOString().slice(0, 10);
    }
  }
  let m;
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))) { // dd/mm/aaaa | dd/mm/aa
    let [, d, mo, y] = m;
    if (y.length === 2) y = (Number(y) > 60 ? '19' : '20') + y;
    if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
    const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    return isNaN(new Date(iso)) ? null : iso;
  }
  if ((m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/))) { // aaaa-mm-dd
    const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    return isNaN(new Date(iso)) ? null : iso;
  }
  return null;
}

// ---- Valor flexível -> Number (NaN se não parseia). Aceita BR, US, R$, negativos. ----
function parseValorFlex(v) {
  if (v == null || v === '') return NaN;
  if (typeof v === 'number') return v;
  const raw = String(v).trim();
  if (parseDataFlex(raw)) return NaN; // não confundir data com valor
  const neg = /^\(.*\)$/.test(raw) || raw.startsWith('-') || /-\s*$/.test(raw);
  let s = raw.replace(/[^\d.,]/g, '');
  if (!s) return NaN;
  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.'); // BR: 1.234,56
  else if (lastDot > lastComma) s = s.replace(/,/g, '');               // US: 1,234.56
  else if (lastComma !== -1) s = s.replace(',', '.');                  // só vírgula: 1234,56
  const n = parseFloat(s);
  if (isNaN(n)) return NaN;
  return neg ? -Math.abs(n) : n;
}

// Acha, por cabeçalho, o 1º valor não-vazio cuja chave casa com o regex.
function acharHeader(obj, regex) {
  for (const [k, val] of Object.entries(obj)) {
    if (regex.test(norm(k))) {
      const t = String(val ?? '').trim();
      if (t !== '') return t;
    }
  }
  return null;
}

export default async function processarImportacaoPlanilha({ body, user }) {
  requirePermission(user, 'FINANCEIRO_EDIT');
  const importacao_id = body?.importacao_id;
  if (!importacao_id) return { error: 'importacao_id é obrigatório' };

  const importacao = (await store.filter('ImportacaoPlanilha', { id: importacao_id }))[0];
  if (!importacao) return { error: 'Importação não encontrada' };
  const obra = importacao.obra_id ? (await store.filter('Obra', { id: importacao.obra_id }))[0] : null;

  const linhas = await store.filter('ImportacaoLinha', { importacao_id }, undefined, 5000);
  const erros = [];

  for (const linha of linhas) {
    if (linha.parse_status && linha.parse_status !== 'pendente') continue;
    try {
      const raw = JSON.parse(linha.raw_json);
      const obj = Array.isArray(raw)
        ? Object.fromEntries(raw.map((v, i) => [`col${i}`, v]))
        : (raw && typeof raw === 'object' ? raw : {});
      const valores = Object.values(obj);

      const abaKey = String(linha.aba || '').toUpperCase().trim();
      const regra = ABA_REGRAS[abaKey] || {};

      // DATA — por cabeçalho, senão a 1ª célula que é uma data.
      let dataISO = parseDataFlex(acharHeader(obj, H.data));
      if (!dataISO) { for (const v of valores) { const d = parseDataFlex(v); if (d) { dataISO = d; break; } } }
      if (!dataISO) throw new Error('Data não encontrada ou inválida na linha');

      // VALOR — por cabeçalho, senão o maior número plausível da linha.
      let valor = parseValorFlex(acharHeader(obj, H.valor));
      if (isNaN(valor) || valor === 0) {
        let cand = NaN;
        for (const v of valores) {
          const n = parseValorFlex(v);
          if (isNaN(n) || n === 0) continue;
          if (isNaN(cand) || Math.abs(n) >= Math.abs(cand)) cand = n;
        }
        valor = cand;
      }
      if (isNaN(valor) || valor === 0) throw new Error('Valor não encontrado ou inválido na linha');

      // FORNECEDOR / DESCRIÇÃO
      const fornecedor = acharHeader(obj, H.fornecedor);
      let descricao = acharHeader(obj, H.descricao) || fornecedor;
      if (!descricao) { // maior texto que não é data nem valor
        descricao = valores
          .map((v) => String(v ?? '').trim())
          .filter((t) => t && !parseDataFlex(t) && isNaN(parseValorFlex(t)))
          .sort((a, b) => b.length - a.length)[0] || '';
      }

      const forma = acharHeader(obj, H.forma);

      // CATEGORIA — regra da aba, senão coluna categoria, senão nome da aba, senão 'Outros'.
      const categoria = regra.categoria
        || acharHeader(obj, H.categoria)
        || (abaKey && !ABA_GENERICA.test(abaKey) ? cap(abaKey) : 'Outros');

      // TIPO — regra da aba, senão coluna 'tipo/natureza', senão despesa. Valor negativo => despesa.
      const tipoTxt = norm(acharHeader(obj, H.tipo) || '');
      const isReceita = valor >= 0 && (regra.tipo === 'receita' || /receita|entrada|receb|credito|aporte/.test(tipoTxt));
      const valorAbs = Math.abs(valor);

      if (!descricao) descricao = categoria;

      const conta = {
        tipo: isReceita ? 'receber' : 'pagar',
        obra_id: importacao.obra_id,
        obra_nome: obra?.nome || '',
        descricao,
        categoria,
        fornecedor_cliente: fornecedor || null,
        forma_pagamento: forma ? String(forma).trim() : null,
        valor: valorAbs,
        data_vencimento: dataISO,
        status: isReceita ? 'recebido' : 'pago',
        // Import histórico: fatos já liquidados no passado. Marca 'pago/recebido'
        // SEM tocar o caixa atual. Rotula a proveniência p/ o conciliador/KPIs.
        origem: 'importacao_historica',
        conciliado: false,
        origem_importacao_id: importacao_id,
        origem_linha_id: linha.id,
      };
      if (isReceita) { conta.data_recebimento = dataISO; conta.valor_recebido = valorAbs; }
      else { conta.data_pagamento = dataISO; conta.valor_pago = valorAbs; }

      const criada = await store.create('ContaFinanceira', conta, user?.email || null);
      await store.update('ImportacaoLinha', linha.id, {
        parse_status: 'ok', conta_financeira_id: criada.id, mapeado_para: 'conta_financeira', erros: null,
      });
    } catch (error) {
      erros.push(`Linha ${linha.linha_numero} (${linha.aba}): ${error.message}`);
      await store.update('ImportacaoLinha', linha.id, { parse_status: 'erro', erros: error.message });
    }
  }

  // Recalcula totais a partir do estado atual de TODAS as linhas.
  const todas = await store.filter('ImportacaoLinha', { importacao_id }, undefined, 5000);
  const linhas_ok = todas.filter((l) => l.parse_status === 'ok').length;
  const linhas_erro = todas.filter((l) => l.parse_status === 'erro').length;
  const status = linhas_erro > 0 ? 'com_erros' : 'processada';

  await store.update('ImportacaoPlanilha', importacao_id, {
    status, linhas_ok, linhas_erro, total_linhas: todas.length, resumo_erros: erros.join('\n'),
  });

  return { success: true, importacao_id, linhas_ok, linhas_erro, total: todas.length, erros: erros.length ? erros : null };
}

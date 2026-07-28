import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ─── Labels legíveis para campos ────────────────────────────────────────────
const FIELD_LABELS = {
  // obras
  nome: 'Nome', status: 'Status', valor_orcado: 'Valor Orçado', valor_realizado: 'Valor Realizado',
  data_inicio: 'Data Início', data_fim: 'Data Fim', cliente: 'Cliente', municipio: 'Município',
  // financeiro
  descricao: 'Descrição', valor: 'Valor', data_vencimento: 'Vencimento', categoria: 'Categoria',
  tipo: 'Tipo', conta_bancaria: 'Conta',
  // compras
  titulo: 'Título', prioridade: 'Prioridade', valor_total_estimado: 'Valor Total', data_necessidade: 'Necessidade',
  solicitante_nome: 'Solicitante', obra_id: 'Obra',
  // estoque
  descricao_insumo: 'Insumo', estoque_atual: 'Estoque Atual', estoque_minimo: 'Estoque Mín.',
  preco_medio: 'Preço Médio', unidade: 'Unidade',
  // medicoes
  numero: 'Número', percentual_executado: 'Exec. (%)', valor_medicao: 'Valor Medição',
  data_medicao: 'Data Medição',
};

// ─── Busca de dados por fonte ────────────────────────────────────────────────
async function fetchData(base44, fonte, limit = 2000) {
  switch (fonte) {
    case 'obras':          return base44.asServiceRole.entities.Obra.list('-created_date', limit);
    case 'financeiro':     return base44.asServiceRole.entities.ContaFinanceira.list('-created_date', limit);
    case 'compras':        return base44.asServiceRole.entities.RequisicaoCompra.list('-created_date', limit);
    case 'estoque':        return base44.asServiceRole.entities.SaldoEstoque.list('-created_date', limit);
    case 'medicoes':       return base44.asServiceRole.entities.MedicaoObra.list('-created_date', limit);
    case 'ordens_compra':  return base44.asServiceRole.entities.OrdemCompra.list('-created_date', limit);
    default:               return [];
  }
}

// ─── Aplicar filtros ────────────────────────────────────────────────────────
function applyFilters(data, filtros) {
  if (!filtros || filtros.length === 0) return data;
  return data.filter(item =>
    filtros.every(({ campo, operador, valor }) => {
      const v = item[campo];
      switch (operador) {
        case 'igual':      return String(v ?? '') === String(valor);
        case 'diferente':  return String(v ?? '') !== String(valor);
        case 'contem':     return String(v ?? '').toLowerCase().includes(String(valor).toLowerCase());
        case 'maior_que':  return Number(v) > Number(valor);
        case 'menor_que':  return Number(v) < Number(valor);
        case 'entre': {
          const [min, max] = String(valor).split(',').map(x => Number(x.trim()));
          return Number(v) >= min && Number(v) <= max;
        }
        default: return true;
      }
    })
  );
}

// ─── Aplicar ordenação ───────────────────────────────────────────────────────
function applySort(data, campo, direcao) {
  if (!campo) return data;
  return [...data].sort((a, b) => {
    const av = a[campo]; const bv = b[campo];
    if (av === bv) return 0;
    const cmp = av > bv ? 1 : -1;
    return direcao === 'desc' ? -cmp : cmp;
  });
}

// ─── Aplicar agrupamento ─────────────────────────────────────────────────────
function applyGrouping(data, campo) {
  if (!campo) return null;
  const groups = {};
  for (const item of data) {
    const key = String(item[campo] ?? '(vazio)');
    if (!groups[key]) groups[key] = { _grupo: key, _count: 0, _soma: 0, _items: [] };
    groups[key]._count++;
    groups[key]._items.push(item);
    // soma campo valor se existir
    const numCampos = ['valor', 'valor_orcado', 'valor_realizado', 'valor_total_estimado', 'valor_medicao', 'preco_medio'];
    for (const nc of numCampos) {
      if (item[nc] != null) groups[key][`_soma_${nc}`] = (groups[key][`_soma_${nc}`] || 0) + Number(item[nc]);
    }
  }
  return Object.values(groups);
}

// ─── Calcular KPIs ──────────────────────────────────────────────────────────
function calcKpis(data, fonte) {
  const total = data.length;
  const kpis = [{ label: 'Total de Registros', valor: total, formato: 'numero' }];

  const numFields = {
    obras: [
      { campo: 'valor_orcado', label: 'Total Orçado', formato: 'moeda' },
      { campo: 'valor_realizado', label: 'Total Realizado', formato: 'moeda' },
    ],
    financeiro: [
      { campo: 'valor', label: 'Soma Total', formato: 'moeda' },
    ],
    compras: [
      { campo: 'valor_total_estimado', label: 'Valor Total Estimado', formato: 'moeda' },
    ],
    medicoes: [
      { campo: 'valor_medicao', label: 'Valor Total Medido', formato: 'moeda' },
      { campo: 'percentual_executado', label: 'Média % Executado', formato: 'percentual', media: true },
    ],
    estoque: [
      { campo: 'preco_medio', label: 'Preço Médio Geral', formato: 'moeda', media: true },
    ],
    ordens_compra: [
      { campo: 'valor_total', label: 'Valor Total OC', formato: 'moeda' },
    ],
  };

  for (const f of (numFields[fonte] || [])) {
    const vals = data.map(d => Number(d[f.campo] || 0)).filter(x => !isNaN(x));
    if (vals.length === 0) continue;
    const soma = vals.reduce((a, b) => a + b, 0);
    kpis.push({ label: f.label, valor: f.media ? soma / vals.length : soma, formato: f.formato });
  }

  // distribuição por status
  const statusMap = {};
  for (const item of data) {
    const s = item.status || 'N/A';
    statusMap[s] = (statusMap[s] || 0) + 1;
  }
  if (Object.keys(statusMap).length > 0 && Object.keys(statusMap).length < 10) {
    kpis.push({ label: 'Por Status', valor: statusMap, formato: 'distribuicao' });
  }

  return kpis;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { relatorioId, preview = false } = body;

    if (!relatorioId) return Response.json({ error: 'relatorioId obrigatório' }, { status: 400 });

    const relatorios = await base44.entities.RelatorioCustomizado.filter({ id: relatorioId });
    const relatorio = relatorios?.[0];
    if (!relatorio) return Response.json({ ok: false, error: 'Relatório não encontrado' }, { status: 404 });

    // 1. Buscar dados
    const rawData = await fetchData(base44, relatorio.fonte_dados);

    // 2. Filtros
    const filtered = applyFilters(rawData, relatorio.filtros || []);

    // 3. Ordenação
    const sorted = applySort(filtered, relatorio.ordenacao, relatorio.ordem_direcao || 'asc');

    // 4. Agrupamento
    const grouped = relatorio.agrupamento ? applyGrouping(sorted, relatorio.agrupamento) : null;
    const finalData = grouped || sorted;

    // 5. Campos selecionados
    const campos = (relatorio.campos_visibles && relatorio.campos_visibles.length > 0)
      ? relatorio.campos_visibles
      : Object.keys(rawData[0] || {}).filter(k => !k.startsWith('_')).slice(0, 8);

    // 6. Montar resposta
    const rows = preview ? finalData.slice(0, 100) : finalData;

    const linhas = rows.map(item => {
      const row = {};
      const colsList = grouped ? ['_grupo', '_count', ...campos.filter(c => c !== relatorio.agrupamento)] : campos;
      for (const c of colsList) row[c] = item[c] ?? '';
      return row;
    });

    const kpis = calcKpis(sorted, relatorio.fonte_dados);
    const colHeaders = linhas[0] ? Object.keys(linhas[0]).map(k => ({ key: k, label: FIELD_LABELS[k] || k })) : [];

    return Response.json({
      ok: true,
      data: {
        linhas,
        kpis,
        colHeaders,
        totalRegistros: finalData.length,
        totalFiltrado: sorted.length,
        totalRaw: rawData.length,
        agrupado: !!grouped,
      }
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});
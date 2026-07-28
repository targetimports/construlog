import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const normalizarValor = (val) => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^\d.,\-]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }
  return 0;
};

const obterMesPeriodo = (data) => {
  if (!data) return null;
  const d = new Date(data);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const obterDataInicioMes = (periodo) => {
  const [ano, mes] = periodo.split('-');
  return `${ano}-${mes}-01`;
};

const obterDataFimMes = (periodo) => {
  const [ano, mes] = periodo.split('-');
  const numMes = parseInt(mes);
  const numAno = parseInt(ano);
  const proximoMes = numMes === 12 ? 1 : numMes + 1;
  const proximoAno = numMes === 12 ? numAno + 1 : numAno;
  const dataProxima = new Date(proximoAno, proximoMes - 1, 1);
  const ultimoDia = new Date(dataProxima.getTime() - 86400000);
  return ultimoDia.toISOString().split('T')[0];
};

const aplicarFiltroDataIntervalo = (data_obj, dataInicio, dataFim) => {
  if (!data_obj) return false;
  const data = new Date(data_obj).getTime();
  const inicio = dataInicio ? new Date(dataInicio).getTime() : 0;
  const fim = dataFim ? new Date(dataFim).getTime() + 86400000 : Infinity;
  return data >= inicio && data <= fim;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { obra_id, de, ate, granularidade = 'mes' } = await req.json();
    if (!obra_id) {
      return Response.json({ error: 'Field obra_id is required' }, { status: 400 });
    }

    const obra = await base44.entities.Obra.get(obra_id);
    if (!obra) {
      return Response.json({ error: 'Obra not found' }, { status: 404 });
    }

    const warnings = [];
    const periodos = new Map();
    const serie = [];

    // Ler categorias
    const categorias = await base44.entities.CategoriaFinanceira.list();
    const mapCat = {};
    categorias.forEach(c => {
      mapCat[c.id] = { nome: c.nome, grupo: c.grupo };
    });

    // Gerar lista de períodos (meses) entre de e ate
    const dataInicio = de ? new Date(de) : new Date(2026, 0, 1);
    const dataFim = ate ? new Date(ate) : new Date(2026, 11, 31);
    
    let mesAtual = new Date(dataInicio);
    while (mesAtual <= dataFim) {
      const periodo = `${mesAtual.getFullYear()}-${String(mesAtual.getMonth() + 1).padStart(2, '0')}`;
      periodos.set(periodo, {
        periodo,
        de: obterDataInicioMes(periodo),
        ate: obterDataFimMes(periodo),
        planejado_receita: 0,
        planejado_custo: 0,
        real_receita: 0,
        real_custo_total: 0,
        real_materiais: 0,
        real_servicos: 0,
        real_mao_obra: 0,
        real_impostos: 0,
        real_adm: 0,
        saldo_mes: 0,
        saldo_acumulado: 0
      });
      mesAtual.setMonth(mesAtual.getMonth() + 1);
    }

    // 1. Planejado (Orçamento)
    try {
      const orcamentos = await base44.entities.Orcamento.filter({
        obra_id: obra_id
      });
      if (orcamentos.length > 0) {
        const orcamento = orcamentos[0];
        const valorTotal = normalizarValor(orcamento.valor_proposta || 0);
        
        // Distribuir linearmente entre períodos
        const meses = periodos.size;
        if (meses > 0) {
          const valorPorMes = valorTotal / meses;
          periodos.forEach(p => {
            p.planejado_receita = valorPorMes;
            p.planejado_custo = 0; // Receita, não custo
          });
        }
      }
    } catch (e) {
      warnings.push('Orçamento não disponível para distribuição planejada');
    }

    // 2. Real - MovimentacaoEstoque (materiais)
    const movimentacoes = await base44.entities.MovimentacaoEstoque.filter({
      obra_destino_id: obra_id
    });
    movimentacoes
      .filter(m => ['saida_consumo', 'saida'].includes(m.tipo))
      .forEach(m => {
        const periodo = obterMesPeriodo(m.data_movimentacao);
        if (periodo && periodos.has(periodo)) {
          const valor = normalizarValor(m.valor_total);
          periodos.get(periodo).real_materiais += valor;
          periodos.get(periodo).real_custo_total += valor;
        }
      });

    // 3. Real - ContaFinanceira (receitas e custos)
    const contas = await base44.entities.ContaFinanceira.filter({
      obra_id: obra_id
    });
    
    contas.forEach(c => {
      // Receita
      if (c.tipo === 'receber' && c.valor_recebido > 0) {
        const periodo = obterMesPeriodo(c.updated_date);
        if (periodo && periodos.has(periodo)) {
          const valor = normalizarValor(c.valor_recebido);
          periodos.get(periodo).real_receita += valor;
        }
      }

      // Custo (pagar, exceto material)
      if (c.tipo === 'pagar' && ['pago', 'parcial'].includes(c.status)) {
        const periodo = obterMesPeriodo(c.data_pagamento);
        if (periodo && periodos.has(periodo)) {
          const catInfo = mapCat[c.categoria] || {};
          const grupo = catInfo.grupo || 'outros';
          
          // Skip material
          if (grupo === 'material') return;

          const valor = normalizarValor(c.valor);
          const p = periodos.get(periodo);
          p.real_custo_total += valor;
          
          if (grupo === 'servico') p.real_servicos += valor;
          else if (grupo === 'mao_obra') p.real_mao_obra += valor;
          else if (grupo === 'imposto') p.real_impostos += valor;
          else if (grupo === 'adm') p.real_adm += valor;
        }
      }
    });

    // 4. Calcular saldos mensais e acumulados
    let saldoAcumulado = 0;
    periodos.forEach(p => {
      p.saldo_mes = p.real_receita - p.real_custo_total;
      saldoAcumulado += p.saldo_mes;
      p.saldo_acumulado = saldoAcumulado;
    });

    // Converter map para array ordenado
    Array.from(periodos.values())
      .sort((a, b) => a.periodo.localeCompare(b.periodo))
      .forEach(p => serie.push(p));

    // Totais
    const totals = {
      planejado_receita: serie.reduce((s, p) => s + p.planejado_receita, 0),
      planejado_custo: serie.reduce((s, p) => s + p.planejado_custo, 0),
      real_receita: serie.reduce((s, p) => s + p.real_receita, 0),
      real_custo_total: serie.reduce((s, p) => s + p.real_custo_total, 0),
      real_materiais: serie.reduce((s, p) => s + p.real_materiais, 0),
      real_servicos: serie.reduce((s, p) => s + p.real_servicos, 0),
      real_mao_obra: serie.reduce((s, p) => s + p.real_mao_obra, 0),
      real_impostos: serie.reduce((s, p) => s + p.real_impostos, 0),
      real_adm: serie.reduce((s, p) => s + p.real_adm, 0)
    };

    return Response.json({
      ok: true,
      build_id: `curvaS_${obra_id}_${Date.now()}`,
      obra_id,
      granularidade,
      serie,
      totals,
      warnings
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
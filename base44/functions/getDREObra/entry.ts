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

const aplicarFiltroData = (data_obj, dataFiltro) => {
  if (!dataFiltro || !data_obj) return true;
  const data = new Date(data_obj);
  const filtro = new Date(dataFiltro);
  return data.getTime() === filtro.getTime();
};

const aplicarFiltroDataIntervalo = (data_obj, dataInicio, dataFim) => {
  if (!data_obj) return true;
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

    const { obra_id, de, ate } = await req.json();
    if (!obra_id) {
      return Response.json({ error: 'Field obra_id is required' }, { status: 400 });
    }

    // Validar obra (sem tocar em Obra.js)
    const obra = await base44.entities.Obra.get(obra_id);
    if (!obra) {
      return Response.json({ error: 'Obra not found' }, { status: 404 });
    }

    const warnings = [];
    const custos = {
      materiais: 0,
      servicos: 0,
      mao_obra: 0,
      impostos: 0,
      administrativos: 0,
      outros: 0,
      total_custos: 0
    };
    let receita_prevista = 0;
    let receita_realizada = 0;
    const breakdown_por_categoria = [];
    const mapaCategorias = {};

    // 1. Ler CategoriaFinanceira
    const categorias = await base44.entities.CategoriaFinanceira.list();
    const mapCat = {};
    categorias.forEach(c => {
      mapCat[c.id] = { nome: c.nome, grupo: c.grupo, tipo: c.tipo };
    });

    // 2. MovimentacaoEstoque (materiais saída)
    const movimentacoes = await base44.entities.MovimentacaoEstoque.filter({
      obra_destino_id: obra_id
    });
    let totalMateriais = 0;
    movimentacoes
      .filter(m => ['saida_consumo', 'saida'].includes(m.tipo))
      .forEach(m => {
        totalMateriais += normalizarValor(m.valor_total);
      });
    custos.materiais = totalMateriais;

    // 3. ContaFinanceira (receita realizada + prevista)
    const contas = await base44.entities.ContaFinanceira.filter({
      obra_id: obra_id
    });
    
    contas.forEach(c => {
      // Receita realizada: priorizar medições aprovadas (valor_total) ou valor_recebido
      if (c.tipo === 'receber') {
        if (aplicarFiltroDataIntervalo(c.updated_date || c.data_vencimento, de, ate)) {
          // Se é medição, usar valor total (já faturado)
          if (c.referencia_tipo === 'medicao') {
            receita_realizada += normalizarValor(c.valor || 0);
          } else if (c.valor_recebido > 0) {
            receita_realizada += normalizarValor(c.valor_recebido);
          }
        }
      }

      // Custos (pagar, exceto categoria.grupo=material)
      if (c.tipo === 'pagar' && ['pago', 'parcial'].includes(c.status)) {
        if (aplicarFiltroDataIntervalo(c.data_pagamento, de, ate)) {
          const catInfo = mapCat[c.categoria] || {};
          const grupo = catInfo.grupo || 'outros';
          
          // Skip material (double count)
          if (grupo === 'material') return;

          const valor = normalizarValor(c.valor);
          custos[grupo === 'mao_obra' ? 'mao_obra' : 
                 grupo === 'servico' ? 'servicos' : 
                 grupo === 'imposto' ? 'impostos' : 
                 grupo === 'adm' ? 'administrativos' : 'outros'] += valor;

          // Breakdown
          const catId = c.categoria || 'sem_categoria';
          if (!mapaCategorias[catId]) {
            mapaCategorias[catId] = {
              categoria_id: catId,
              categoria_nome: catInfo.nome || 'Sem categoria',
              grupo: grupo,
              total: 0
            };
          }
          mapaCategorias[catId].total += valor;
        }
      }
    });

    // 4. MÃO DE OBRA: PRIORIDADE ApontamentoHora (se aprovado) + FALLBACK Diário
    let labor_source = 'diario_fallback';
    let labor_value = 0;

    try {
      // 4A) TENTAR APONTAMENTO HORA (NOVO)
      const apontamentos = await base44.entities.ApontamentoHora.filter({
        obra_id: obra_id,
        status: 'aprovado'
      });

      let totalApontamento = 0;
      apontamentos.forEach(ap => {
        if (aplicarFiltroDataIntervalo(ap.data, de, ate)) {
          totalApontamento += normalizarValor(ap.custo_total || 0);
        }
      });

      if (totalApontamento > 0) {
        custos.mao_obra = totalApontamento;
        labor_source = 'apontamento_hora';
        labor_value = totalApontamento;
      }
    } catch (e) {
      // ApontamentoHora pode não existir, continuar com fallback
    }

    // 4B) FALLBACK: Se nenhum apontamento, usar Diário
    if (labor_source === 'diario_fallback') {
      try {
        const diarios = await base44.entities.DiarioObra.filter({
          obra_id: obra_id
        });
        let totalDiario = 0;
        diarios.forEach(d => {
          if (aplicarFiltroDataIntervalo(d.data, de, ate)) {
            if (d.mao_obra && Array.isArray(d.mao_obra)) {
              d.mao_obra.forEach(mo => {
                totalDiario += normalizarValor(mo.valor_total || 0);
              });
            }
          }
        });
        if (totalDiario > 0) {
          custos.mao_obra += totalDiario;
          labor_value = totalDiario;
        }
      } catch (e) {
        // DiarioObra pode não existir
        warnings.push('DiarioObra não disponível');
      }
    }

    // 5. Rateio administrativo (já entra em pagar como referencia_tipo="rateio")
    // Já contabilizado acima em contas pagar

    // 6. Orçamento (receita prevista)
    try {
      const orcamentos = await base44.entities.Orcamento.filter({
        obra_id: obra_id
      });
      if (orcamentos.length > 0) {
        receita_prevista = normalizarValor(orcamentos[0].valor_proposta || 0);
      }
    } catch (e) {
      warnings.push('Orçamento não disponível');
    }

    // Calcular totais
    custos.total_custos = Object.keys(custos)
      .filter(k => k !== 'total_custos')
      .reduce((sum, k) => sum + custos[k], 0);

    const margem_bruta = receita_realizada - custos.total_custos;
    const margem_percentual = receita_realizada > 0 
      ? (margem_bruta / receita_realizada) * 100 
      : 0;

    // Montar breakdown
    Object.values(mapaCategorias).forEach(cat => {
      breakdown_por_categoria.push(cat);
    });

    return Response.json({
      ok: true,
      build_id: `dreObra_${obra_id}_${Date.now()}`,
      obra_id,
      periodo: { de, ate },
      receita_prevista,
      receita_realizada,
      custos,
      margem_bruta,
      margem_percentual: parseFloat(margem_percentual.toFixed(2)),
      breakdown_por_categoria,
      labor_source,
      labor_value,
      warnings
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
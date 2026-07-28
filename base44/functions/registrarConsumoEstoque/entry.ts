import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      obra_id, 
      orcamento_id, 
      insumo_id, 
      quantidade_consumida, 
      etapa,
      tipo_movimento = 'consumo_normal'
    } = body;

    if (!obra_id || !orcamento_id || !insumo_id || !quantidade_consumida) {
      return Response.json({ 
        error: 'obra_id, orcamento_id, insumo_id e quantidade_consumida são obrigatórios' 
      }, { status: 400 });
    }

    // Verificar se insumo existe no orçamento
    const orcamentoItems = await base44.entities.OrcamentoItem.filter({ orcamento_id });
    const composicaoInsumos = await base44.entities.ComposicaoInsumo.list('', 1000);
    
    let quantidade_orçada = 0;
    for (const item of orcamentoItems) {
      const insumosItem = composicaoInsumos.filter(ci => ci.composicao_id === item.composicao_id);
      const insumoEncontrado = insumosItem.find(ci => ci.insumo_id === insumo_id);
      if (insumoEncontrado) {
        quantidade_orçada += insumoEncontrado.coeficiente * item.quantidade;
      }
    }

    if (quantidade_orçada === 0) {
      return Response.json({
        error: 'Insumo não consta no orçamento aprovado',
        insumo_id
      }, { status: 403 });
    }

    // Registrar a movimentação de consumo
    const movimentacao = await base44.entities.MovimentacaoEstoque.create({
      insumo_id,
      tipo: 'consumo',
      quantidade: quantidade_consumida,
      obra_destino_id: obra_id,
      orcamento_id,
      etapa_obra: etapa,
      data_movimentacao: new Date().toISOString().split('T')[0],
      responsavel: user.email,
      tipo_consumo: tipo_movimento
    });

    // Registrar consumo para rastreamento
    const consumo = await base44.entities.ConsumoEstoqueObra.create({
      obra_id,
      orcamento_id,
      insumo_id,
      etapa,
      quantidade_prevista: quantidade_orçada,
      quantidade_consumida,
      variacao: quantidade_consumida - quantidade_orçada,
      percentual_variacao: ((quantidade_consumida - quantidade_orçada) / quantidade_orçada * 100).toFixed(2),
      data_consumo: new Date().toISOString(),
      responsavel: user.email,
      tipo_movimento
    });

    // Gerar alerta se houver desperdício
    if (quantidade_consumida > quantidade_orçada * 1.1) {
      const alerta = await base44.entities.AlertaInsumoOrcamento.create({
        tipo_alerta: 'desperdicio_detectado',
        obra_id,
        orcamento_id,
        insumo_id,
        severidade: 'aviso',
        mensagem: `Desperdício detectado: ${((quantidade_consumida / quantidade_orçada - 1) * 100).toFixed(1)}% acima do orçado`,
        dados_alerta: {
          quantidade_orçada,
          quantidade_consumida,
          variacao: quantidade_consumida - quantidade_orçada
        }
      });
    }

    return Response.json({
      movimentacao_id: movimentacao.id,
      consumo_id: consumo.id,
      status: 'registrado',
      quantidade_consumida,
      variacao_percentual: consumo.percentual_variacao
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
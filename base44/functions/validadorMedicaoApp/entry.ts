import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { medicaoData, orcamentoId } = await req.json();

    const erros = [];
    const avisos = [];
    const sugestoes = {};

    // 1. Validar campos obrigatórios
    if (!medicaoData.periodo_inicio) erros.push('Data de início obrigatória');
    if (!medicaoData.periodo_fim) erros.push('Data de fim obrigatória');
    if (!medicaoData.itens || medicaoData.itens.length === 0) erros.push('Nenhum item medido');

    // 2. Validar datas
    if (medicaoData.periodo_inicio && medicaoData.periodo_fim) {
      const inicio = new Date(medicaoData.periodo_inicio);
      const fim = new Date(medicaoData.periodo_fim);
      if (inicio > fim) erros.push('Data de início não pode ser posterior à data de fim');
    }

    // 3. Buscar orçamento para validações
    let orc = null;
    if (orcamentoId) {
      const orcArray = await base44.entities.Orcamento.filter({ id: orcamentoId }, null, 1);
      if (orcArray.length > 0) orc = orcArray[0];
    }

    // 4. Validar itens
    const totalMedido = medicaoData.itens?.reduce((acc, item) => acc + (item.valor_medido || 0), 0) || 0;
    
    if (orc) {
      const totalOrcado = orc.itens?.reduce((acc, item) => acc + (item.valor_total || 0), 0) || 0;
      
      medicaoData.itens?.forEach((item, idx) => {
        const itemOrc = orc.itens?.find(i => i.id === item.item_orcamento_id);
        
        if (!itemOrc) {
          erros.push(`Item ${idx + 1}: não encontrado no orçamento`);
          return;
        }

        // Validar quantidade
        if (item.quantidade_medida > itemOrc.quantidade * 1.2) {
          avisos.push(`Item ${itemOrc.descricao}: quantidade medida (${item.quantidade_medida}) ultrapassa 20% do orçado (${itemOrc.quantidade})`);
        }

        // Sugerir percentual baseado em padrões
        if (!item.percentual_medido && item.valor_medido) {
          const percEstimado = (item.valor_medido / itemOrc.valor_total) * 100;
          sugestoes[item.item_orcamento_id] = {
            percentual_sugerido: Math.min(100, parseFloat(percEstimado.toFixed(2))),
            motivo: 'Baseado no valor medido'
          };
        }
      });

      // Validar total
      if (totalMedido > totalOrcado * 1.1) {
        avisos.push(`Total medido (R$ ${totalMedido.toFixed(2)}) ultrapassa 10% do orçado (R$ ${totalOrcado.toFixed(2)})`);
      }
    }

    // 5. Validar descontos e retenções
    const totalDescontos = medicaoData.descontos?.reduce((acc, d) => acc + (d.valor || 0), 0) || 0;
    const totalRetencoes = medicaoData.retencoes?.reduce((acc, r) => acc + (r.valor || 0), 0) || 0;

    if (totalDescontos > totalMedido * 0.3) {
      avisos.push(`Total de descontos (R$ ${totalDescontos.toFixed(2)}) muito alto (>30% do medido)`);
    }

    if (totalRetencoes > totalMedido * 0.2) {
      avisos.push(`Total de retenções (R$ ${totalRetencoes.toFixed(2)}) muito alto (>20% do medido)`);
    }

    // 6. Validar conclusão
    const podeEnviar = erros.length === 0;

    return Response.json({
      valido: podeEnviar,
      erros,
      avisos,
      sugestoes,
      totais: {
        medido: totalMedido,
        descontos: totalDescontos,
        retencoes: totalRetencoes,
        liquido: totalMedido - totalDescontos - totalRetencoes
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
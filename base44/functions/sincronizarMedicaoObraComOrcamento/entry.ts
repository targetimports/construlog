import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Sincroniza dados do orçamento para a medição de obra
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { medicao_id } = await req.json();

    // Buscar medição
    const medicao = await base44.entities.MedicaoObra.get(medicao_id);
    if (!medicao) {
      return Response.json({ error: 'Medição não encontrada' }, { status: 404 });
    }

    // Buscar orçamento aprovado da obra
    const orcamentos = await base44.asServiceRole.entities.OrcamentoObra.filter({
      obra_id: medicao.obra_id,
      status: 'aprovado'
    });

    if (orcamentos.length === 0) {
      return Response.json({ 
        error: 'Nenhum orçamento aprovado encontrado para esta obra' 
      }, { status: 400 });
    }

    const orcamento = orcamentos[0];

    // Buscar itens do orçamento
    const itensOrcamento = await base44.asServiceRole.entities.OrcamentoItem.filter({
      orcamento_id: orcamento.id
    });

    // Atualizar medição com dados do orçamento
    await base44.asServiceRole.entities.MedicaoObra.update(medicao_id, {
      orcamento_id: orcamento.id,
      valor_orcamento_total: orcamento.valor_total || 0
    });

    // Buscar itens de medição existentes
    const itensMedicao = await base44.asServiceRole.entities.ItemMedicaoObra.filter({
      medicao_id: medicao_id
    });

    // Atualizar/criar itens de medição com dados do orçamento
    const promises = [];
    
    for (const itemOrc of itensOrcamento) {
      const itemMedicaoExistente = itensMedicao.find(im => im.item_orcamento_id === itemOrc.id);
      
      // Buscar composição se disponível
      let composicao = null;
      if (itemOrc.composicao_id) {
        const comps = await base44.asServiceRole.entities.Composicao.filter({
          id: itemOrc.composicao_id
        });
        composicao = comps[0];
      }

      const dadosOrcamento = {
        item_orcamento_id: itemOrc.id,
        composicao_id: itemOrc.composicao_id,
        codigo: composicao?.codigo || itemOrc.codigo,
        descricao: itemOrc.descricao || composicao?.descricao,
        unidade: itemOrc.unidade || composicao?.unidade,
        etapa: itemOrc.etapa,
        categoria: composicao?.categoria,
        quantidade_orcada: itemOrc.quantidade,
        valor_unitario_orcamento: itemOrc.preco_unitario_final || itemOrc.custo_unitario_calculado,
        bdi_aplicado: itemOrc.bdi_aplicado
      };

      if (itemMedicaoExistente) {
        // Atualizar item existente
        promises.push(
          base44.asServiceRole.entities.ItemMedicaoObra.update(itemMedicaoExistente.id, dadosOrcamento)
        );
      } else {
        // Criar novo item de medição baseado no orçamento
        promises.push(
          base44.asServiceRole.entities.ItemMedicaoObra.create({
            medicao_id: medicao_id,
            obra_id: medicao.obra_id,
            centro_custo_id: itemOrc.centro_custo_id || medicao.obra_id,
            ...dadosOrcamento,
            quantidade_medida: 0,
            quantidade_acumulada: 0,
            valor_medido: 0,
            valor_acumulado: 0,
            percentual_executado: 0,
            saldo_quantidade: itemOrc.quantidade,
            saldo_valor: (itemOrc.preco_unitario_final || itemOrc.custo_unitario_calculado) * itemOrc.quantidade
          })
        );
      }
    }

    await Promise.all(promises);

    return Response.json({ 
      success: true,
      message: 'Medição de obra sincronizada com orçamento',
      itens_processados: promises.length,
      orcamento_id: orcamento.id
    });
  } catch (error) {
    console.error('Erro ao sincronizar medição de obra:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
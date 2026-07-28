import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recebimento_id, obra_id, almoxarifado_id } = await req.json();

    if (!recebimento_id) {
      return Response.json({ error: 'recebimento_id é obrigatório' }, { status: 400 });
    }

    // Buscar recebimento
    const recebimento = await base44.entities.RecebimentoMaterial.read(recebimento_id);
    if (!recebimento) {
      return Response.json({ error: 'Recebimento não encontrado' }, { status: 404 });
    }

    const obraId = obra_id || recebimento.obra_id;
    const almoxId = almoxarifado_id || recebimento.almoxarifado_id;

    // Processar cada item recebido
    for (const item of recebimento.itens || []) {
      const qtdRecebida = item.quantidade_recebida || 0;
      if (qtdRecebida <= 0) continue;

      // Buscar ou criar saldo de estoque
      const existentes = await base44.asServiceRole.entities.SaldoEstoque.filter({
        insumo_id: item.insumo_id,
        almoxarifado_id: almoxId
      });

      let saldoEstoque = existentes?.[0];

      if (!saldoEstoque) {
        // Criar novo saldo
        saldoEstoque = await base44.asServiceRole.entities.SaldoEstoque.create({
          insumo_id: item.insumo_id,
          almoxarifado_id: almoxId,
          codigo_insumo: item.codigo,
          descricao_insumo: item.descricao,
          unidade: item.unidade || 'un',
          quantidade_total: qtdRecebida,
          quantidade_reservada: 0,
          quantidade_disponivel: qtdRecebida,
          custo_unitario_medio: item.valor_unitario || 0,
          valor_total_estoque: qtdRecebida * (item.valor_unitario || 0),
          data_ultima_movimentacao: new Date().toISOString()
        });
      } else {
        // Atualizar saldo existente
        const novaQtdTotal = (saldoEstoque.quantidade_total || 0) + qtdRecebida;
        const custoMedio = saldoEstoque.custo_unitario_medio || 0;
        
        // Calcular novo custo médio ponderado
        const novoCustomedio = (
          (saldoEstoque.quantidade_total * custoMedio + qtdRecebida * (item.valor_unitario || 0)) /
          novaQtdTotal
        );

        await base44.asServiceRole.entities.SaldoEstoque.update(saldoEstoque.id, {
          quantidade_total: novaQtdTotal,
          quantidade_disponivel: novaQtdTotal - (saldoEstoque.quantidade_reservada || 0),
          custo_unitario_medio: novoCustomedio,
          valor_total_estoque: novaQtdTotal * novoCustomedio,
          data_ultima_movimentacao: new Date().toISOString()
        });
      }

      // Também atualizar EstoqueObra se existir
      if (obraId) {
        const estoqueObraExistentes = await base44.asServiceRole.entities.EstoqueObra.filter({
          obra_id: obraId,
          insumo_id: item.insumo_id
        });

        if (estoqueObraExistentes?.[0]) {
          const estoqueObra = estoqueObraExistentes[0];
          const novaQtd = (estoqueObra.quantidade_total || 0) + qtdRecebida;
          
          await base44.asServiceRole.entities.EstoqueObra.update(estoqueObra.id, {
            quantidade_total: novaQtd,
            quantidade_disponivel: novaQtd - (estoqueObra.quantidade_reservada || 0),
            valor_total_estoque: novaQtd * (estoqueObra.custo_unitario || 0),
            data_ultima_movimentacao: new Date().toISOString()
          });
        } else {
          // Criar novo EstoqueObra
          await base44.asServiceRole.entities.EstoqueObra.create({
            obra_id: obraId,
            insumo_id: item.insumo_id,
            insumo_descricao: item.descricao,
            unidade: item.unidade || 'un',
            quantidade_total: qtdRecebida,
            quantidade_disponivel: qtdRecebida,
            custo_unitario: item.valor_unitario || 0,
            valor_total_estoque: qtdRecebida * (item.valor_unitario || 0),
            data_ultima_movimentacao: new Date().toISOString()
          });
        }
      }
    }

    // Gerar alertas de estoque baixo
    await gerarAlertasEstoqueBaixo(base44, almoxId, obraId);

    return Response.json({
      sucesso: true,
      mensagem: 'Recebimento processado e estoque atualizado',
      recebimento_id
    });
  } catch (error) {
    console.error('Erro ao processar recebimento:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function gerarAlertasEstoqueBaixo(base44, almoxId, obraId) {
  try {
    // Buscar todos os saldos com estoque baixo
    const saldos = await base44.asServiceRole.entities.SaldoEstoque.filter({
      almoxarifado_id: almoxId
    });

    for (const saldo of saldos || []) {
      const qtdDisponivel = saldo.quantidade_disponivel || 0;
      const qtdMinima = saldo.quantidade_minima || 0;

      let status = 'ok';
      if (qtdDisponivel <= qtdMinima && qtdMinima > 0) {
        status = qtdDisponivel === 0 ? 'critico' : 'alerta';

        // Criar alerta
        await base44.asServiceRole.entities.AlertaDesvio.create({
          tipo: 'estoque_baixo',
          entidade: 'Insumo',
          entidade_id: saldo.insumo_id,
          titulo: `Estoque baixo: ${saldo.descricao_insumo}`,
          descricao: `${saldo.descricao_insumo} está ${status === 'critico' ? 'CRÍTICO' : 'baixo'}. Disponível: ${qtdDisponivel} ${saldo.unidade}, Mínimo: ${qtdMinima} ${saldo.unidade}`,
          severidade: status === 'critico' ? 'alta' : 'media',
          almoxarifado_id: almoxId,
          obra_id: obraId,
          ativa: true,
          data_criacao: new Date().toISOString()
        }).catch(() => {
          // Ignorar erro se AlertaDesvio não existir
        });
      }
    }
  } catch (error) {
    console.warn('Erro ao gerar alertas:', error.message);
  }
}
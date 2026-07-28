import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Segurança: apenas admin
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    const { deleteOperational, deleteCatalogs, deleteDemo } = await req.json();

    const counts = {};

    // Dados operacionais (sempre contam se deleteOperational=true)
    if (deleteOperational) {
      // Vínculos e movimentações
      counts.DemandaEstoqueObra = (await base44.asServiceRole.entities.DemandaEstoqueObra.list()).length;
      counts.MovimentacaoEstoqueObra = (await base44.asServiceRole.entities.MovimentacaoEstoqueObra.list()).length;
      counts.ConsumoEstoqueObra = (await base44.asServiceRole.entities.ConsumoEstoqueObra.list()).length;
      counts.UsoEquipamento = (await base44.asServiceRole.entities.UsoEquipamento.list()).length;
      counts.ConsumoInsumo = (await base44.asServiceRole.entities.ConsumoInsumo.list()).length;
      
      // Documentos transacionais
      counts.RequisicaoCompra = (await base44.asServiceRole.entities.RequisicaoCompra.list()).length;
      counts.OrdemCompra = (await base44.asServiceRole.entities.OrdemCompra.list()).length;
      counts.RecebimentoMaterial = (await base44.asServiceRole.entities.RecebimentoMaterial.list()).length;
      counts.TransferenciaEstoque = (await base44.asServiceRole.entities.TransferenciaEstoque.list()).length;
      counts.ContaFinanceiraObra = (await base44.asServiceRole.entities.ContaFinanceiraObra.list()).length;
      counts.ReceitaObra = (await base44.asServiceRole.entities.ReceitaObra.list()).length;
      counts.DREObra = (await base44.asServiceRole.entities.DREObra.list()).length;
      
      // Medições
      counts.Medicao = (await base44.asServiceRole.entities.Medicao.list()).length;
      counts.MedicaoItem = (await base44.asServiceRole.entities.MedicaoItem.list()).length;
      
      // Logística
      counts.Viagem = (await base44.asServiceRole.entities.Viagem.list()).length;
      counts.SolicitacaoVeiculo = (await base44.asServiceRole.entities.SolicitacaoVeiculo.list()).length;
      counts.SolicitacaoEquipamento = (await base44.asServiceRole.entities.SolicitacaoEquipamento.list()).length;
      
      // Diário de obra
      counts.DiarioObra = (await base44.asServiceRole.entities.DiarioObra.list()).length;
      
      // Documentos
      counts.DocumentoObra = (await base44.asServiceRole.entities.DocumentoObra.list()).length;
      counts.AnexoObra = (await base44.asServiceRole.entities.AnexoObra.list()).length;
    }

    // Cadastros operacionais (apenas se deleteCatalogs=true)
    if (deleteCatalogs) {
      counts.Obra = (await base44.asServiceRole.entities.Obra.list()).length;
      counts.Orcamento = (await base44.asServiceRole.entities.Orcamento.list()).length;
      counts.OrcamentoItem = (await base44.asServiceRole.entities.OrcamentoItem.list()).length;
      counts.Cliente = (await base44.asServiceRole.entities.Cliente.list()).length;
      counts.Fornecedor = (await base44.asServiceRole.entities.Fornecedor.list()).length;
      counts.Colaborador = (await base44.asServiceRole.entities.Colaborador.list()).length;
      counts.Equipamento = (await base44.asServiceRole.entities.Equipamento.list()).length;
      counts.Veiculo = (await base44.asServiceRole.entities.Veiculo.list()).length;
    }

    // Dados demo (apenas se deleteDemo=true)
    if (deleteDemo) {
      const demoQuery = { is_demo: true };
      counts.DemoObra = (await base44.asServiceRole.entities.Obra.filter(demoQuery)).length;
      counts.DemoInsumo = (await base44.asServiceRole.entities.Insumo.filter(demoQuery)).length;
    }

    const duration = Date.now() - startTime;

    // Registrar log de preview
    await base44.asServiceRole.entities.DataAdminLog.create({
      action: 'PREVIEW',
      executed_by_user_id: user.id,
      executed_by_email: user.email,
      scope_json: { deleteOperational, deleteCatalogs, deleteDemo },
      result_json: counts,
      status: 'SUCCESS',
      duration_ms: duration
    });

    return Response.json({ 
      success: true, 
      counts,
      duration_ms: duration 
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    try {
      const base44 = createClientFromRequest(req);
      const user = await base44.auth.me();
      
      await base44.asServiceRole.entities.DataAdminLog.create({
        action: 'PREVIEW',
        executed_by_user_id: user?.id,
        executed_by_email: user?.email,
        scope_json: {},
        result_json: {},
        status: 'ERROR',
        error_message: error.message,
        duration_ms: duration
      });
    } catch (logError) {
      console.error('Erro ao registrar log:', logError);
    }

    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const env = Deno.env.get('APP_ENVIRONMENT');
  if (env === 'production') {
    return Response.json({ erro: 'Operação não permitida em produção' }, { status: 403 });
  }

  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    const payload = await req.json();
    const { demoRunId, deleteAll } = payload;

    if (!demoRunId && !deleteAll) {
      return Response.json({ 
        error: 'Informe demoRunId ou deleteAll=true' 
      }, { status: 400 });
    }

    const deleted = {};
    const errors = [];

    const filter = demoRunId 
      ? { demo_run_id: demoRunId }
      : { is_demo: true };

    // ORDEM DE DELEÇÃO (filhos → pais)
    
    // 1. Vínculos e movimentações
    try {
      const demandas = await base44.asServiceRole.entities.DemandaEstoqueObra.filter(filter);
      for (const item of demandas) {
        await base44.asServiceRole.entities.DemandaEstoqueObra.delete(item.id);
      }
      deleted.DemandaEstoqueObra = demandas.length;
    } catch (e) { errors.push(`DemandaEstoqueObra: ${e.message}`); }

    // 2. Medições
    try {
      const medicoes = await base44.asServiceRole.entities.Medicao.filter(filter);
      for (const item of medicoes) {
        await base44.asServiceRole.entities.Medicao.delete(item.id);
      }
      deleted.Medicao = medicoes.length;
    } catch (e) { errors.push(`Medicao: ${e.message}`); }

    // 3. Logística
    try {
      const viagens = await base44.asServiceRole.entities.Viagem.filter(filter);
      for (const item of viagens) {
        await base44.asServiceRole.entities.Viagem.delete(item.id);
      }
      deleted.Viagem = viagens.length;
    } catch (e) { errors.push(`Viagem: ${e.message}`); }

    // 4. Requisições
    try {
      const requisicoes = await base44.asServiceRole.entities.RequisicaoCompra.filter(filter);
      for (const item of requisicoes) {
        await base44.asServiceRole.entities.RequisicaoCompra.delete(item.id);
      }
      deleted.RequisicaoCompra = requisicoes.length;
    } catch (e) { errors.push(`RequisicaoCompra: ${e.message}`); }

    // 5. Insumos
    try {
      const insumos = await base44.asServiceRole.entities.Insumo.filter(filter);
      for (const item of insumos) {
        await base44.asServiceRole.entities.Insumo.delete(item.id);
      }
      deleted.Insumo = insumos.length;
    } catch (e) { errors.push(`Insumo: ${e.message}`); }

    // 6. Obras
    try {
      const obras = await base44.asServiceRole.entities.Obra.filter(filter);
      for (const item of obras) {
        await base44.asServiceRole.entities.Obra.delete(item.id);
      }
      deleted.Obra = obras.length;
    } catch (e) { errors.push(`Obra: ${e.message}`); }

    // 7. Clientes
    try {
      const clientes = await base44.asServiceRole.entities.Cliente.filter(filter);
      for (const item of clientes) {
        await base44.asServiceRole.entities.Cliente.delete(item.id);
      }
      deleted.Cliente = clientes.length;
    } catch (e) { errors.push(`Cliente: ${e.message}`); }

    // 8. Fornecedores
    try {
      const fornecedores = await base44.asServiceRole.entities.Fornecedor.filter(filter);
      for (const item of fornecedores) {
        await base44.asServiceRole.entities.Fornecedor.delete(item.id);
      }
      deleted.Fornecedor = fornecedores.length;
    } catch (e) { errors.push(`Fornecedor: ${e.message}`); }

    const duration = Date.now() - startTime;
    const status = errors.length > 0 ? 'ERROR' : 'SUCCESS';

    // Registrar log
    await base44.asServiceRole.entities.DataAdminLog.create({
      action: 'DELETE_DEMO',
      executed_by_user_id: user.id,
      executed_by_email: user.email,
      scope_json: { demoRunId, deleteAll },
      result_json: { deleted, errors },
      status,
      error_message: errors.length > 0 ? errors.join('; ') : null,
      duration_ms: duration
    });

    return Response.json({ 
      success: errors.length === 0,
      deleted,
      errors,
      duration_ms: duration 
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    try {
      const base44 = createClientFromRequest(req);
      const user = await base44.auth.me();
      
      await base44.asServiceRole.entities.DataAdminLog.create({
        action: 'DELETE_DEMO',
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
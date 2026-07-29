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

    // Segurança: apenas admin
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    const payload = await req.json();
    const { 
      deleteOperational, 
      deleteCatalogs, 
      deleteUploads,
      deleteDemo,
      confirmation,
      fullReset = false  // Flag para reset total (ignora checkboxes)
    } = payload;

    // Validar confirmação
    if (!confirmation || 
        confirmation.text1 !== 'APAGAR TUDO' || 
        confirmation.text2 !== 'CONSTRULOG' ||
        !confirmation.otp) {
      return Response.json({ 
        error: 'Confirmação inválida. Verifique os campos.' 
      }, { status: 400 });
    }

    const deleted = {};
    const errors = [];

    // MODO FULL RESET: apaga tudo independente de checkboxes
    const shouldDeleteAll = fullReset || deleteOperational;
    const shouldDeleteCatalogs = fullReset || deleteCatalogs;

    // Helper para deletar entidade por lotes
    const deleteAllInLots = async (entityName, batchSize = 200) => {
      let totalDeleted = 0;
      let hasMore = true;
      
      while (hasMore) {
        try {
          const items = await base44.asServiceRole.entities[entityName].list('', batchSize);
          
          if (!items || items.length === 0) {
            hasMore = false;
            break;
          }

          for (const item of items) {
            try {
              await base44.asServiceRole.entities[entityName].delete(item.id);
              totalDeleted++;
            } catch (e) {
              console.error(`Erro ao deletar ${entityName} ${item.id}:`, e.message);
            }
          }

          if (items.length < batchSize) {
            hasMore = false;
          }
        } catch (e) {
          console.error(`Erro ao listar ${entityName}:`, e.message);
          hasMore = false;
        }
      }

      if (totalDeleted > 0) {
        deleted[entityName] = totalDeleted;
      }
      return totalDeleted;
    };

    // ORDEM DE DELEÇÃO (filhos → pais)
    
    // 1. Vínculos e movimentações (operacionais)
    if (shouldDeleteAll) {
      try {
        const consumos = await base44.asServiceRole.entities.ConsumoInsumo.list();
        for (const item of consumos) {
          await base44.asServiceRole.entities.ConsumoInsumo.delete(item.id);
        }
        deleted.ConsumoInsumo = consumos.length;
      } catch (e) { errors.push(`ConsumoInsumo: ${e.message}`); }

      try {
        const usos = await base44.asServiceRole.entities.UsoEquipamento.list();
        for (const item of usos) {
          await base44.asServiceRole.entities.UsoEquipamento.delete(item.id);
        }
        deleted.UsoEquipamento = usos.length;
      } catch (e) { errors.push(`UsoEquipamento: ${e.message}`); }

      try {
        const consumosObra = await base44.asServiceRole.entities.ConsumoEstoqueObra.list();
        for (const item of consumosObra) {
          await base44.asServiceRole.entities.ConsumoEstoqueObra.delete(item.id);
        }
        deleted.ConsumoEstoqueObra = consumosObra.length;
      } catch (e) { errors.push(`ConsumoEstoqueObra: ${e.message}`); }

      try {
        const movimentos = await base44.asServiceRole.entities.MovimentacaoEstoqueObra.list();
        for (const item of movimentos) {
          await base44.asServiceRole.entities.MovimentacaoEstoqueObra.delete(item.id);
        }
        deleted.MovimentacaoEstoqueObra = movimentos.length;
      } catch (e) { errors.push(`MovimentacaoEstoqueObra: ${e.message}`); }

      try {
        const demandas = await base44.asServiceRole.entities.DemandaEstoqueObra.list();
        for (const item of demandas) {
          await base44.asServiceRole.entities.DemandaEstoqueObra.delete(item.id);
        }
        deleted.DemandaEstoqueObra = demandas.length;
      } catch (e) { errors.push(`DemandaEstoqueObra: ${e.message}`); }

      // 2. Medições
      try {
        const medicaoItens = await base44.asServiceRole.entities.MedicaoItem.list();
        for (const item of medicaoItens) {
          await base44.asServiceRole.entities.MedicaoItem.delete(item.id);
        }
        deleted.MedicaoItem = medicaoItens.length;
      } catch (e) { errors.push(`MedicaoItem: ${e.message}`); }

      try {
        const medicoes = await base44.asServiceRole.entities.Medicao.list();
        for (const item of medicoes) {
          await base44.asServiceRole.entities.Medicao.delete(item.id);
        }
        deleted.Medicao = medicoes.length;
      } catch (e) { errors.push(`Medicao: ${e.message}`); }

      // 3. Documentos transacionais
      try {
        const recebimentos = await base44.asServiceRole.entities.RecebimentoMaterial.list();
        for (const item of recebimentos) {
          await base44.asServiceRole.entities.RecebimentoMaterial.delete(item.id);
        }
        deleted.RecebimentoMaterial = recebimentos.length;
      } catch (e) { errors.push(`RecebimentoMaterial: ${e.message}`); }

      try {
        const ocs = await base44.asServiceRole.entities.OrdemCompra.list();
        for (const item of ocs) {
          await base44.asServiceRole.entities.OrdemCompra.delete(item.id);
        }
        deleted.OrdemCompra = ocs.length;
      } catch (e) { errors.push(`OrdemCompra: ${e.message}`); }

      try {
        const reqs = await base44.asServiceRole.entities.RequisicaoCompra.list();
        for (const item of reqs) {
          await base44.asServiceRole.entities.RequisicaoCompra.delete(item.id);
        }
        deleted.RequisicaoCompra = reqs.length;
      } catch (e) { errors.push(`RequisicaoCompra: ${e.message}`); }

      try {
        const transferencias = await base44.asServiceRole.entities.TransferenciaEstoque.list();
        for (const item of transferencias) {
          await base44.asServiceRole.entities.TransferenciaEstoque.delete(item.id);
        }
        deleted.TransferenciaEstoque = transferencias.length;
      } catch (e) { errors.push(`TransferenciaEstoque: ${e.message}`); }

      // 4. Financeiro
      try {
        const contas = await base44.asServiceRole.entities.ContaFinanceiraObra.list();
        for (const item of contas) {
          await base44.asServiceRole.entities.ContaFinanceiraObra.delete(item.id);
        }
        deleted.ContaFinanceiraObra = contas.length;
      } catch (e) { errors.push(`ContaFinanceiraObra: ${e.message}`); }

      try {
        const receitas = await base44.asServiceRole.entities.ReceitaObra.list();
        for (const item of receitas) {
          await base44.asServiceRole.entities.ReceitaObra.delete(item.id);
        }
        deleted.ReceitaObra = receitas.length;
      } catch (e) { errors.push(`ReceitaObra: ${e.message}`); }

      try {
        const dres = await base44.asServiceRole.entities.DREObra.list();
        for (const item of dres) {
          await base44.asServiceRole.entities.DREObra.delete(item.id);
        }
        deleted.DREObra = dres.length;
      } catch (e) { errors.push(`DREObra: ${e.message}`); }

      // 5. Logística
      try {
        const viagens = await base44.asServiceRole.entities.Viagem.list();
        for (const item of viagens) {
          await base44.asServiceRole.entities.Viagem.delete(item.id);
        }
        deleted.Viagem = viagens.length;
      } catch (e) { errors.push(`Viagem: ${e.message}`); }

      try {
        const solVeiculos = await base44.asServiceRole.entities.SolicitacaoVeiculo.list();
        for (const item of solVeiculos) {
          await base44.asServiceRole.entities.SolicitacaoVeiculo.delete(item.id);
        }
        deleted.SolicitacaoVeiculo = solVeiculos.length;
      } catch (e) { errors.push(`SolicitacaoVeiculo: ${e.message}`); }

      try {
        const solEquips = await base44.asServiceRole.entities.SolicitacaoEquipamento.list();
        for (const item of solEquips) {
          await base44.asServiceRole.entities.SolicitacaoEquipamento.delete(item.id);
        }
        deleted.SolicitacaoEquipamento = solEquips.length;
      } catch (e) { errors.push(`SolicitacaoEquipamento: ${e.message}`); }

      // 6. Diário
      try {
        const diarios = await base44.asServiceRole.entities.DiarioObra.list();
        for (const item of diarios) {
          await base44.asServiceRole.entities.DiarioObra.delete(item.id);
        }
        deleted.DiarioObra = diarios.length;
      } catch (e) { errors.push(`DiarioObra: ${e.message}`); }

      // 7. Documentos
      try {
        const docs = await base44.asServiceRole.entities.DocumentoObra.list();
        for (const item of docs) {
          await base44.asServiceRole.entities.DocumentoObra.delete(item.id);
        }
        deleted.DocumentoObra = docs.length;
      } catch (e) { errors.push(`DocumentoObra: ${e.message}`); }

      try {
        const anexos = await base44.asServiceRole.entities.AnexoObra.list();
        for (const item of anexos) {
          await base44.asServiceRole.entities.AnexoObra.delete(item.id);
        }
        deleted.AnexoObra = anexos.length;
      } catch (e) { errors.push(`AnexoObra: ${e.message}`); }

      // 8. Contas Financeiras (impacta Dashboard)
      try {
        const contas = await base44.asServiceRole.entities.ContaFinanceira.list();
        for (const item of contas) {
          await base44.asServiceRole.entities.ContaFinanceira.delete(item.id);
        }
        deleted.ContaFinanceira = contas.length;
      } catch (e) { errors.push(`ContaFinanceira: ${e.message}`); }

      // 9. Marcos (timeline - impacta Dashboard)
      try {
        const marcos = await base44.asServiceRole.entities.MarcoObra.list();
        for (const item of marcos) {
          await base44.asServiceRole.entities.MarcoObra.delete(item.id);
        }
        deleted.MarcoObra = marcos.length;
      } catch (e) { errors.push(`MarcoObra: ${e.message}`); }

      // 10. Histórico da Obra (impacta Dashboard)
      try {
        const historicos = await base44.asServiceRole.entities.HistoricoObra.list();
        for (const item of historicos) {
          await base44.asServiceRole.entities.HistoricoObra.delete(item.id);
        }
        deleted.HistoricoObra = historicos.length;
      } catch (e) { errors.push(`HistoricoObra: ${e.message}`); }
    }

    // 11. Dados operacionais de custos (Material, MaoDeObra, Frete, etc)
      await deleteAllInLots('Material');
      await deleteAllInLots('MaoDeObra');
      await deleteAllInLots('Frete');
      await deleteAllInLots('Alimentacao');
      await deleteAllInLots('AluguelEquipamento');
      await deleteAllInLots('Estadia');
      await deleteAllInLots('Retirada');
      await deleteAllInLots('Investimento');
      await deleteAllInLots('Empreita');
      await deleteAllInLots('LancamentoGenerico');
      await deleteAllInLots('LancamentoFinanceiro');
      await deleteAllInLots('Imposto');

    // 12. Cadastros operacionais (se deleteAll ou deleteCatalogs=true)
      if (shouldDeleteCatalogs) {
        await deleteAllInLots('Insumo');
        await deleteAllInLots('OrcamentoItem');
        await deleteAllInLots('Orcamento');
        await deleteAllInLots('Obra');
        await deleteAllInLots('Cliente');
        await deleteAllInLots('Fornecedor');
        await deleteAllInLots('Colaborador');
        await deleteAllInLots('Equipe');
        await deleteAllInLots('Equipamento');
        await deleteAllInLots('Veiculo');
        await deleteAllInLots('Motorista');
        await deleteAllInLots('CentroCusto');
        await deleteAllInLots('BaseCustos');
        await deleteAllInLots('HistoricoBaseCustos');
        await deleteAllInLots('BasePrecosInsumo');
        await deleteAllInLots('GrupoInsumo');
      }

    // 13. Logs operacionais (NÃO apagar LogAuditoria/LogAcesso — trilha imutável)
    if (shouldDeleteAll) {
      // LogAuditoria e LogAcesso são trilha de auditoria e NUNCA devem ser apagados em produção
      await deleteAllInLots('LogAcaoIA');
      await deleteAllInLots('NotificationLog');
      await deleteAllInLots('Notificacao');
    }

    // 14. Dados demo (se deleteDemo=true)
    if (deleteDemo || fullReset) {
      await deleteAllInLots('DemoObra');
    }

    const duration = Date.now() - startTime;
    const status = errors.length > 0 ? 'ERROR' : 'SUCCESS';

    // Registrar log
    await base44.asServiceRole.entities.DataAdminLog.create({
      action: 'RESET',
      executed_by_user_id: user.id,
      executed_by_email: user.email,
      scope_json: { deleteOperational, deleteCatalogs, deleteUploads, deleteDemo },
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
        action: 'RESET',
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
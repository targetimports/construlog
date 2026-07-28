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
    const { confirmation } = payload;

    // Validar confirmação extremamente forte
    if (!confirmation || 
        confirmation.text1 !== 'APAGAR TUDO' || 
        confirmation.checkbox !== true) {
      return Response.json({ 
        error: 'Confirmação inválida. Confirmação extremamente forte necessária.' 
      }, { status: 400 });
    }

    const deleted = {};
    const errors = [];

    // Lista de entidades em ORDEM DE DEPENDÊNCIA (filhos antes de pais)
    // Função helper para deletar entidade por lotes (paginação)
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
              errors.push(`${entityName}[${item.id}]: ${e.message}`);
            }
          }

          if (items.length < batchSize) {
            hasMore = false;
          }
        } catch (e) {
          console.error(`Erro ao listar ${entityName}:`, e.message);
          errors.push(`${entityName} (list): ${e.message}`);
          hasMore = false;
        }
      }

      if (totalDeleted > 0) {
        deleted[entityName] = totalDeleted;
      }
      return totalDeleted;
    };

    // ========================================
    // DELETAR TUDO EM ORDEM DE DEPENDÊNCIA
    // ========================================

    // 1. TRANSAÇÕES / MOVIMENTOS (filhos)
    await deleteAllInLots('MedicaoItem');
    await deleteAllInLots('Medicao');
    await deleteAllInLots('ConsumoInsumo');
    await deleteAllInLots('UsoEquipamento');
    await deleteAllInLots('ConsumoEstoqueObra');
    await deleteAllInLots('MovimentacaoEstoqueObra');
    await deleteAllInLots('DemandaEstoqueObra');
    await deleteAllInLots('NecessidadeMaterialObra');
    await deleteAllInLots('EstoqueObra');
    
    // 2. RECEBIMENTOS E MOVIMENTOS DE ESTOQUE
    await deleteAllInLots('RecebimentoMaterial');
    await deleteAllInLots('TransferenciaEstoque');
    
    // 3. COMPRAS E REQUISIÇÕES
    await deleteAllInLots('CotacaoFornecedor');
    await deleteAllInLots('OrdemCompra');
    await deleteAllInLots('RequisicaoCompra');
    
    // 4. LOGÍSTICA
    await deleteAllInLots('Abastecimento');
    await deleteAllInLots('CustoViagem');
    await deleteAllInLots('RegistroTelemetria');
    await deleteAllInLots('AlertaTelemetria');
    await deleteAllInLots('RegistroViagemFoto');
    await deleteAllInLots('AlertaViagemIA');
    await deleteAllInLots('Viagem');
    await deleteAllInLots('SolicitacaoVeiculo');
    await deleteAllInLots('SolicitacaoTransporte');
    
    // 5. EQUIPAMENTOS
    await deleteAllInLots('ManutencaoEquipamento');
    await deleteAllInLots('SolicitacaoEquipamento');
    
    // 6. DIÁRIOS E DOCUMENTOS
    await deleteAllInLots('DiarioObra');
    await deleteAllInLots('AnexoObra');
    await deleteAllInLots('DocumentoObra');
    await deleteAllInLots('AnexoFase');
    await deleteAllInLots('RevisaoPlanta');
    
    // 7. FINANCEIRO (IMPACTO CRÍTICO NO DASHBOARD)
    await deleteAllInLots('ItemMedicaoObraObra');
    await deleteAllInLots('ItemMedicaoObra');
    await deleteAllInLots('ContaFinanceiraObra');
    await deleteAllInLots('ReceitaObra');
    await deleteAllInLots('DREObra');
    await deleteAllInLots('MovimentacaoFinanceira');
    await deleteAllInLots('ContaFinanceira');
    
    // 8. CUSTOS OPERACIONAIS (Material, MaoDeObra, Frete, etc)
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
    
    // 9. MARCOS E CRONOGRAMA (Timeline do Dashboard)
    await deleteAllInLots('MarcoObra');
    await deleteAllInLots('CronogramaItemPeriodo');
    await deleteAllInLots('HistoricoObra');
    
    // 10. OUTROS RELACIONADOS A OBRA
    await deleteAllInLots('AlocacaoObra');
    await deleteAllInLots('AlocacaoRecursosGantt');
    await deleteAllInLots('ChecklistQualidade');
    await deleteAllInLots('NaoConformidade');
    await deleteAllInLots('AcaoCorretiva');
    await deleteAllInLots('AlertaDesvio');
    await deleteAllInLots('AlertaCFF');
    await deleteAllInLots('DesvioConsumo');
    
    // 11. CONTRATOS
    await deleteAllInLots('AditivoContrato');
    await deleteAllInLots('AnexoContrato');
    await deleteAllInLots('Contrato');
    await deleteAllInLots('MedicaoContrato');
    await deleteAllInLots('MedicaoContratoItem');
    
    // 12. LICITAÇÕES
    await deleteAllInLots('DocumentoLicitacao');
    await deleteAllInLots('Licitacao');
    
    // 13. PROJETO TÉCNICO
    await deleteAllInLots('ProjetoTecnico');
    
    // 14. ÓRCAMENTO FINAL
    await deleteAllInLots('OrcamentoItem');
    await deleteAllInLots('OrcamentoGrupo');
    await deleteAllInLots('Orcamento');
    
    // 15. INSUMOS E COMPOSIÇÕES
    await deleteAllInLots('ComposicaoItem');
    await deleteAllInLots('ComposicaoLinha');
    await deleteAllInLots('ComposicaoInsumo');
    await deleteAllInLots('Composicao');
    await deleteAllInLots('GrupoInsumo');
    await deleteAllInLots('BaseCustos');
    await deleteAllInLots('HistoricoBaseCustos');
    await deleteAllInLots('BasePrecosInsumo');
    await deleteAllInLots('HistoricoPrecos');
    await deleteAllInLots('TabelaSINAPI');
    await deleteAllInLots('TabelaSILI');
    await deleteAllInLots('Insumo');
    
    // 16. CADASTROS OPERACIONAIS (OBRAS, CLIENTES, FORNECEDORES, COLABORADORES)
    await deleteAllInLots('Fase');
    await deleteAllInLots('FrenteServico');
    await deleteAllInLots('PacoteTrabalho');
    await deleteAllInLots('Almoxarifado');
    await deleteAllInLots('SaldoEstoque');
    await deleteAllInLots('MovimentacaoEstoque');
    await deleteAllInLots('VinculoInsumoEstoque');
    await deleteAllInLots('EstoqueObra');
    await deleteAllInLots('Obra');
    await deleteAllInLots('Colaborador');
    await deleteAllInLots('Fornecedor');
    await deleteAllInLots('Cliente');
    await deleteAllInLots('Pessoa');
    
    // 17. VEÍCULOS E MANUTENÇÃO
    await deleteAllInLots('ControlePneu');
    await deleteAllInLots('Manutencao');
    await deleteAllInLots('Veiculo');
    
    // 18. EQUIPAMENTOS
    await deleteAllInLots('RegistroUsoEquipamento');
    await deleteAllInLots('HorasAtivo');
    await deleteAllInLots('Equipamento');
    
    // 19. RH E SEGURANÇA
    await deleteAllInLots('ControleEPI');
    await deleteAllInLots('Treinamento');
    await deleteAllInLots('AcidenteTrabalho');
    await deleteAllInLots('ASO');
    
    // 20. RELATÓRIOS E CONFIGURAÇÕES OPERACIONAIS
    await deleteAllInLots('RelatorioAgendado');
    await deleteAllInLots('ProjecaoFinanceira');
    await deleteAllInLots('AlertaSupervisor');
    await deleteAllInLots('UploadArquivo');
    
    // 21. ALERTAS E NOTIFICAÇÕES OPERACIONAIS
    await deleteAllInLots('AlertaInteligencia');
    await deleteAllInLots('NotificationLog');
    await deleteAllInLots('Notificacao');
    
    // 22. LOGS OPERACIONAIS
    await deleteAllInLots('LogAcesso');
    await deleteAllInLots('LogAuditoria');
    await deleteAllInLots('LogAcaoIA');

    const duration = Date.now() - startTime;
    const status = errors.length === 0 ? 'SUCCESS' : 'PARTIAL';

    // Registrar log de reset
    try {
      await base44.asServiceRole.entities.DataAdminLog.create({
        action: 'RESET_TOTAL',
        executed_by_user_id: user.id,
        executed_by_email: user.email,
        scope_json: { type: 'TOTAL' },
        result_json: { deleted, errors },
        status,
        error_message: errors.length > 0 ? errors.slice(0, 10).join('; ') : null,
        duration_ms: duration
      });
    } catch (logErr) {
      console.error('Erro ao registrar log:', logErr);
    }

    return Response.json({ 
      success: errors.length === 0,
      deleted,
      errors: errors.slice(0, 50), // Limitar array de erros
      totalErrorCount: errors.length,
      duration_ms: duration,
      entitiesDeleted: Object.keys(deleted).length
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    try {
      const base44 = createClientFromRequest(req);
      const user = await base44.auth.me();
      
      await base44.asServiceRole.entities.DataAdminLog.create({
        action: 'RESET_TOTAL',
        executed_by_user_id: user?.id,
        executed_by_email: user?.email,
        scope_json: { type: 'TOTAL' },
        result_json: {},
        status: 'ERROR',
        error_message: error.message,
        duration_ms: duration
      });
    } catch (logErr) {
      console.error('Erro ao registrar log:', logErr);
    }

    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});
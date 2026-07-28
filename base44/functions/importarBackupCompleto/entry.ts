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

    const { backup } = await req.json();

    if (!backup || !backup.data) {
      return Response.json({ error: 'Backup inválido.' }, { status: 400 });
    }

    const result = {
      imported: {},
      errors: []
    };

    // Ordem de importação (pais antes de filhos) - INVERSO da deleção
    const orderOfImport = [
      'Cliente', 'Fornecedor', 'Pessoa', 'Colaborador', 'Equipamento', 'Veiculo', 'Motorista',
      'Obra', 'Fase', 'FrenteServico', 'PacoteTrabalho',
      'Insumo', 'GrupoInsumo', 'Composicao', 'ComposicaoInsumo', 'ComposicaoItem', 'ComposicaoLinha',
      'BaseCustos', 'HistoricoBaseCustos', 'BasePrecosInsumo', 'HistoricoPrecos',
      'Orcamento', 'OrcamentoGrupo', 'OrcamentoItem',
      'Contrato', 'AditivoContrato', 'AnexoContrato',
      'Licitacao', 'DocumentoLicitacao', 'ProjetoTecnico', 'RevisaoPlanta',
      'Almoxarifado', 'EstoqueObra', 'SaldoEstoque', 'MovimentacaoEstoque', 'DemandaEstoqueObra', 'NecessidadeMaterialObra',
      'Medicao', 'MedicaoItem', 'ItemMedicaoObra', 'MedicaoContrato', 'MedicaoContratoItem',
      'Material', 'MaoDeObra', 'Frete', 'Alimentacao', 'AluguelEquipamento', 'Estadia', 'Retirada', 'Investimento', 'Empreita', 'LancamentoGenerico', 'LancamentoFinanceiro',
      'ContaFinanceira', 'ContaFinanceiraObra', 'ReceitaObra', 'DREObra', 'MovimentacaoFinanceira',
      'RequisicaoCompra', 'OrdemCompra', 'RecebimentoMaterial', 'CotacaoFornecedor',
      'Viagem', 'Abastecimento', 'CustoViagem', 'SolicitacaoVeiculo', 'SolicitacaoTransporte',
      'DiarioObra', 'AnexoObra', 'DocumentoObra', 'MarcoObra', 'HistoricoObra',
      'AlocacaoObra', 'AlocacaoRecursosGantt', 'CronogramaItemPeriodo',
      'ChecklistQualidade', 'NaoConformidade', 'AcaoCorretiva', 'AlertaDesvio', 'AlertaCFF', 'DesvioConsumo',
      'ConsumoInsumo', 'UsoEquipamento', 'ConsumoEstoqueObra', 'MovimentacaoEstoqueObra',
      'ControleEPI', 'Treinamento', 'AcidenteTrabalho', 'ASO', 'ControlePneu', 'Manutencao',
      'RegistroTelemetria', 'AlertaTelemetria', 'RegistroViagemFoto', 'AlertaViagemIA',
      'RelatorioAgendado', 'ProjecaoFinanceira', 'AlertaSupervisor', 'UploadArquivo',
      'AlertaInteligencia', 'NotificationLog', 'Notificacao',
      'LogAcesso', 'LogAuditoria', 'LogAcaoIA', 'TabelaSINAPI', 'TabelaSILI',
      'SolicitacaoEquipamento', 'ManutencaoEquipamento', 'RegistroUsoEquipamento', 'HorasAtivo'
    ];

    // Importar dados na ordem correta
    for (const entityName of orderOfImport) {
      const items = backup.data[entityName];
      
      if (!items || items.length === 0) continue;

      try {
        let importedCount = 0;
        
        // Importar em lotes
        for (let i = 0; i < items.length; i += 100) {
          const batch = items.slice(i, i + 100);
          const cleanedBatch = batch.map(item => {
            const cleaned = { ...item };
            // Remover campos de sistema
            delete cleaned.id;
            delete cleaned.created_date;
            delete cleaned.updated_date;
            delete cleaned.created_by;
            return cleaned;
          });

          try {
            await base44.asServiceRole.entities[entityName].bulkCreate(cleanedBatch);
            importedCount += cleanedBatch.length;
          } catch (e) {
            console.error(`Erro ao importar lote de ${entityName}:`, e.message);
            result.errors.push(`${entityName} lote ${Math.floor(i / 100)}: ${e.message}`);
          }
        }

        if (importedCount > 0) {
          result.imported[entityName] = importedCount;
        }
      } catch (e) {
        console.error(`Erro ao processar ${entityName}:`, e.message);
        result.errors.push(`${entityName}: ${e.message}`);
      }
    }

    const duration = Date.now() - startTime;

    return Response.json({
      success: result.errors.length === 0,
      imported: result.imported,
      errors: result.errors.slice(0, 50),
      totalErrorCount: result.errors.length,
      totalImported: Object.values(result.imported).reduce((a, b) => a + b, 0),
      duration_ms: duration
    });

  } catch (error) {
    console.error('Erro ao importar backup:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});
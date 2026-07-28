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

    const backup = {
      exportedAt: new Date().toISOString(),
      exportedBy: user.email,
      data: {}
    };

    // Lista de TODAS as entidades de negócio (sem User/Auth)
    const entidades = [
      'Obra', 'Orcamento', 'OrcamentoItem', 'OrcamentoGrupo',
      'Medicao', 'MedicaoItem', 'ItemMedicaoObra', 'MedicaoContrato', 'MedicaoContratoItem',
      'DiarioObra', 'AnexoObra', 'DocumentoObra', 'MarcoObra', 'HistoricoObra',
      'RequisicaoCompra', 'OrdemCompra', 'RecebimentoMaterial', 'CotacaoFornecedor',
      'ContaFinanceira', 'ContaFinanceiraObra', 'ReceitaObra', 'DREObra', 'MovimentacaoFinanceira',
      'Material', 'MaoDeObra', 'Frete', 'Alimentacao', 'AluguelEquipamento', 'Estadia', 'Retirada', 'Investimento', 'Empreita', 'LancamentoGenerico', 'LancamentoFinanceiro',
      'Viagem', 'Abastecimento', 'CustoViagem', 'SolicitacaoVeiculo', 'SolicitacaoTransporte',
      'Insumo', 'GrupoInsumo', 'Composicao', 'ComposicaoItem', 'ComposicaoLinha', 'ComposicaoInsumo',
      'BaseCustos', 'HistoricoBaseCustos', 'BasePrecosInsumo', 'HistoricoPrecos',
      'Contrato', 'AditivoContrato', 'AnexoContrato',
      'Cliente', 'Fornecedor', 'Pessoa', 'Colaborador', 'Equipamento', 'Veiculo', 'Motorista',
      'Licitacao', 'DocumentoLicitacao', 'ProjetoTecnico', 'RevisaoPlanta',
      'Almoxarifado', 'EstoqueObra', 'SaldoEstoque', 'MovimentacaoEstoque', 'MovimentacaoEstoqueObra', 'DemandaEstoqueObra', 'NecessidadeMaterialObra',
      'ChecklistQualidade', 'NaoConformidade', 'AcaoCorretiva', 'AlertaDesvio', 'AlertaCFF', 'DesvioConsumo',
      'ConsumoInsumo', 'UsoEquipamento', 'ConsumoEstoqueObra',
      'Fase', 'FrenteServico', 'PacoteTrabalho', 'AlocacaoObra', 'AlocacaoRecursosGantt', 'CronogramaItemPeriodo',
      'ControleEPI', 'Treinamento', 'AcidenteTrabalho', 'ASO', 'ControlePneu', 'Manutencao',
      'RegistroTelemetria', 'AlertaTelemetria', 'RegistroViagemFoto', 'AlertaViagemIA',
      'RelatorioAgendado', 'ProjecaoFinanceira', 'AlertaSupervisor', 'UploadArquivo',
      'AlertaInteligencia', 'NotificationLog', 'Notificacao',
      'LogAcesso', 'LogAuditoria', 'LogAcaoIA', 'TabelaSINAPI', 'TabelaSILI',
      'SolicitacaoEquipamento', 'ManutencaoEquipamento', 'RegistroUsoEquipamento', 'HorasAtivo'
    ];

    // Exportar cada entidade
    let totalRecords = 0;
    for (const entityName of entidades) {
      try {
        const items = await base44.asServiceRole.entities[entityName].list('', 1000);
        if (items && items.length > 0) {
          backup.data[entityName] = items;
          totalRecords += items.length;
        }
      } catch (e) {
        console.warn(`Aviso ao exportar ${entityName}:`, e.message);
      }
    }

    const duration = Date.now() - startTime;

    return Response.json({
      success: true,
      backup: backup,
      summary: {
        entidadesExportadas: Object.keys(backup.data).length,
        totalRegistros: totalRecords,
        duration_ms: duration
      }
    });

  } catch (error) {
    console.error('Erro ao exportar backup:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});
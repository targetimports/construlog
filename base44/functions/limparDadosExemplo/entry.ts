import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const env = Deno.env.get('APP_ENVIRONMENT');
  if (env === 'production') {
    return Response.json({ erro: 'Operação não permitida em produção' }, { status: 403 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Acesso negado - apenas admin' }, { status: 403 });
    }

    const resultados = {
      workflow_instancias: 0,
      workflows: 0,
      asos: 0,
      treinamentos: 0,
      acidentes: 0,
      acoes_corretivas: 0,
      desvios_consumo: 0,
      alertas_telemetria: 0,
      registros_telemetria: 0,
      apontamentos: 0,
      viagens: 0,
      abastecimentos: 0,
      manutencoes: 0,
      controle_epis: 0,
      equipes: 0,
      itens_medicao: 0,
      medicoes: 0,
      itens_orcamento: 0,
      orcamentos: 0,
      diarios: 0,
      tarefas: 0,
      templates: 0,
      contas: 0,
      cotacoes: 0,
      recebimentos: 0,
      ordens_compra: 0,
      requisicoes: 0,
      movimentacoes: 0,
      contratos: 0,
      fornecedores: 0,
      motoristas: 0,
      veiculos: 0,
      materiais: 0,
      colaboradores: 0,
      riscos: 0,
      obras: 0,
      licitacoes: 0,
      empresas: 0
    };

    // Ordem inversa de criação para respeitar dependências
    const entidades = [
      'WorkflowInstancia',
      'Workflow',
      'ASO',
      'Treinamento',
      'AcidenteTrabalho',
      'AcaoCorretiva',
      'DesvioConsumo',
      'AlertaTelemetria',
      'RegistroTelemetria',
      'ApontamentoHoras',
      'Viagem',
      'Abastecimento',
      'Manutencao',
      'ControleEPI',
      'Equipe',
      'ItemMedicao',
      'Medicao',
      'ItemOrcamento',
      'Orcamento',
      'DiarioObra',
      'TarefaCampo',
      'TemplateChecklist',
      'ContaFinanceira',
      'CotacaoFornecedor',
      'RecebimentoMaterial',
      'OrdemCompra',
      'RequisicaoCompra',
      'MovimentacaoEstoque',
      'Contrato',
      'Fornecedor',
      'Motorista',
      'Veiculo',
      'Material',
      'MovimentacaoEstoque',
      'Material',
      'Almoxarifado',
      'OrdemCompra',
      'Colaborador',
      'Risco',
      'Obra',
      'Licitacao',
      'Empresa'
    ];

    for (const entidade of entidades) {
      try {
        const todos = await base44.asServiceRole.entities[entidade].list();
        
        for (const item of todos) {
          await base44.asServiceRole.entities[entidade].delete(item.id);
        }
        
        const key = entidade.toLowerCase()
          .replace('workflowinstancia', 'workflow_instancias')
          .replace('acidentetrabalho', 'acidentes')
          .replace('acaocorretiva', 'acoes_corretivas')
          .replace('desvioconsumo', 'desvios_consumo')
          .replace('alertatelemetria', 'alertas_telemetria')
          .replace('registrotelemetria', 'registros_telemetria')
          .replace('apontamentohoras', 'apontamentos')
          .replace('controleepi', 'controle_epis')
          .replace('itemmedicao', 'itens_medicao')
          .replace('itemorcamento', 'itens_orcamento')
          .replace('diarioobra', 'diarios')
          .replace('tarefacampo', 'tarefas')
          .replace('templatechecklist', 'templates')
          .replace('contafinanceira', 'contas')
          .replace('cotacaofornecedor', 'cotacoes')
          .replace('recebimentomaterial', 'recebimentos')
          .replace('ordemcompra', 'ordens_compra')
          .replace('requisicaocompra', 'requisicoes')
          .replace('movimentacaoestoque', 'movimentacoes');
        
        if (resultados[key] !== undefined) {
          resultados[key] = todos.length;
        }
      } catch (error) {
        console.error(`Erro ao limpar ${entidade}:`, error.message);
      }
    }

    return Response.json({
      success: true,
      message: 'Todos os dados foram removidos com sucesso!',
      detalhes: resultados,
      total: Object.values(resultados).reduce((a, b) => a + b, 0)
    });

  } catch (error) {
    console.error('Erro ao limpar dados:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});
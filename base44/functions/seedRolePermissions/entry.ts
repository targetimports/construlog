import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * SEED: Inicializa role_permissions com permissões PADRÃO por perfil
 * Executar uma única vez. Se rodar novamente, verifica se já existe e respeita customizações.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Permissões por perfil (role)
    const rolePermissionsMap = {
      almoxarifado: [
        'EstoquesVisaoGeral',
        'EstoquesSaldo',
        'EstoquesDepositos',
        'EstoquesRecebimento',
        'EstoquesImportar',
        'EstoquesTransferencias',
        'EstoquesConfiguracao',
        'LogisticaView', // Acesso a logística como complemento
        'Dashboard'
      ],
      logistica: [
        'LogisticaMinhasRotas',
        'LogisticaViagens',
        'LogisticaRelatorios',
        'LogisticaFrota',
        'LogisticaMotoristas',
        'LogisticaRastreamento',
        'LogisticaCustos',
        'LogisticaSolicitarTransporte',
        'EstoquesView', // Acesso a estoques
        'Dashboard'
      ],
      compras: [
        'SuprimentosSolicitarCompra',
        'SuprimentosRequisicoes',
        'SuprimentosAprovarSolicitacoes',
        'SuprimentosCotacoes',
        'SuprimentosOrdensCompra',
        'SuprimentosContratos',
        'SuprimentosLicitacoes',
        'SuprimentosAvancado',
        'ObraView',
        'Dashboard'
      ],
      engenharia: [
        'ObraDetalhes',
        'ObraDiario',
        'ObraEngenharia',
        'ObraMedicoes',
        'ObraMapaMedicoes',
        'ObraGestao',
        'ObraTodas',
        'SuprimentosSolicitarCompra',
        'EstoquesView',
        'EquipamentosAgendamento',
        'Dashboard',
        'Calendario'
      ],
      rh: [
        'RHColaboradores',
        'RHApontamentoHoras',
        'RHEscala',
        'RHDocumentacao',
        'ObraView',
        'Dashboard'
      ],
      financeiro: [
        'FinanceiroLancamentos',
        'FinanceiroContasPagar',
        'FinanceiroContasReceber',
        'FinanceiroDRE',
        'FinanceiroCustos',
        'FinanceiroFluxoCaixa',
        'ObraTodas',
        'Relatorios'
      ],
      diretoria: [
        'Dashboard',
        'ObraTodas',
        'FinanceiroView',
        'Relatorios',
        'AlertasExecutivos'
      ],
      geral: [
        'Dashboard',
        'Calendario',
        'ObraTodas',
        'ObraDiario',
        'ObraEngenharia',
        'ObraMedicoes',
        'SuprimentosView',
        'EstoquesView',
        'LogisticaView',
        'EquipamentosView',
        'FinanceiroView',
        'CadastrosView',
        'RHView',
        'RelatoriosView',
        'AdministracaoView'
      ],
      programador: [
        '*' // Acesso total (coringa)
      ],
      campo: [
        'Dashboard',
        'Calendario',
        'ObraDetalhes',
        'ObraDiario',
        'RHView',
        'LogisticaView'
      ]
    };

    let createdCount = 0;
    let skippedCount = 0;

    for (const [role, permissions] of Object.entries(rolePermissionsMap)) {
      // Buscar permissões já existentes para este role
      const existing = await base44.entities.RolePermission.filter({ role });
      const existingKeys = new Set(existing.map(p => p.permission_key));

      // Inserir apenas permissões que não existem (respeita customizações)
      const toInsert = permissions
        .filter(perm => !existingKeys.has(perm))
        .map(perm => ({
          role,
          permission_key: perm,
          allowed: true,
          description: `${role} can access ${perm}`
        }));

      if (toInsert.length > 0) {
        await base44.entities.RolePermission.bulkCreate(toInsert);
        createdCount += toInsert.length;
      }

      skippedCount += existingKeys.size;
    }

    return Response.json({
      success: true,
      message: 'Role permissions seeded',
      created: createdCount,
      skipped: skippedCount,
      rolesProcessed: Object.keys(rolePermissionsMap).length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
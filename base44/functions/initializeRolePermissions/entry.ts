import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Inicializa as permissões padrão por perfil (role_permissions)
 * Execute uma vez para popular os dados
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Definição dos padrões por perfil
    const rolePermissionsData = [
      // ===== PROGRAMADOR =====
      { role: 'programador', menu_id: 'dashboard', menu_label: 'Dashboard', allowed: true, group: null },
      { role: 'programador', menu_id: 'calendario', menu_label: 'Calendário', allowed: true, group: null },
      { role: 'programador', menu_id: 'obras', menu_label: 'Obras', allowed: true, group: null },
      { role: 'programador', menu_id: 'obras-todas', menu_label: 'Todas as Obras', allowed: true, group: 'Listagem' },
      { role: 'programador', menu_id: 'obras-gestao', menu_label: 'Gestão de Obras', allowed: true, group: 'Listagem' },
      { role: 'programador', menu_id: 'obras-diario', menu_label: 'Diário de Obra', allowed: true, group: 'Execução' },
      { role: 'programador', menu_id: 'obras-engenharia', menu_label: 'Engenharia & Qualidade', allowed: true, group: 'Execução' },
      { role: 'programador', menu_id: 'obras-mapa-medicoes', menu_label: 'Mapa de Medições', allowed: true, group: 'Medições' },
      { role: 'programador', menu_id: 'obras-medicoes', menu_label: 'Medições', allowed: true, group: 'Medições' },
      { role: 'programador', menu_id: 'suprimentos', menu_label: 'Suprimentos', allowed: true, group: null },
      { role: 'programador', menu_id: 'suprimentos-solicitar', menu_label: 'Solicitar Compra', allowed: true, group: 'Solicitações' },
      { role: 'programador', menu_id: 'suprimentos-requisicoes', menu_label: 'Requisições', allowed: true, group: 'Solicitações' },
      { role: 'programador', menu_id: 'suprimentos-aprovar', menu_label: 'Aprovar Solicitações', allowed: true, group: 'Solicitações' },
      { role: 'programador', menu_id: 'suprimentos-cotacoes', menu_label: 'Cotações', allowed: true, group: 'Cotação & Compra' },
      { role: 'programador', menu_id: 'suprimentos-ordens-compra', menu_label: 'Ordens de Compra', allowed: true, group: 'Cotação & Compra' },
      { role: 'programador', menu_id: 'suprimentos-contratos', menu_label: 'Contratos com Fornecedores', allowed: true, group: 'Cotação & Compra' },
      { role: 'programador', menu_id: 'estoques', menu_label: 'Estoques', allowed: true, group: null },
      { role: 'programador', menu_id: 'estoques-painel', menu_label: 'Painel de Estoque', allowed: true, group: 'Visão Geral' },
      { role: 'programador', menu_id: 'estoques-saldo', menu_label: 'Saldo por Almoxarifado', allowed: true, group: 'Visão Geral' },
      { role: 'programador', menu_id: 'estoques-depositos', menu_label: 'Depósitos', allowed: true, group: 'Cadastros' },
      { role: 'programador', menu_id: 'logistica', menu_label: 'Logística & Frota', allowed: true, group: null },
      { role: 'programador', menu_id: 'logistica-solicitar-transporte', menu_label: 'Solicitar Transporte', allowed: true, group: 'Solicitações' },
      { role: 'programador', menu_id: 'logistica-minhas-rotas', menu_label: 'Minhas Rotas', allowed: true, group: 'Operação' },
      { role: 'programador', menu_id: 'logistica-viagens', menu_label: 'Viagens & Abastecimentos', allowed: true, group: 'Operação' },
      { role: 'programador', menu_id: 'logistica-frota', menu_label: 'Frota', allowed: true, group: 'Gestão' },
      { role: 'programador', menu_id: 'logistica-motoristas', menu_label: 'Motoristas', allowed: true, group: 'Gestão' },
      { role: 'programador', menu_id: 'equipamentos', menu_label: 'Equipamentos', allowed: true, group: null },
      { role: 'programador', menu_id: 'equipamentos-painel', menu_label: 'Painel', allowed: true, group: 'Visão' },
      { role: 'programador', menu_id: 'equipamentos-gestao', menu_label: 'Gestão', allowed: true, group: 'Gestão' },
      { role: 'programador', menu_id: 'equipamentos-agendamento', menu_label: 'Agendamento', allowed: true, group: 'Gestão' },
      { role: 'programador', menu_id: 'equipamentos-manutencao', menu_label: 'Manutenção', allowed: true, group: 'Manutenção' },
      { role: 'programador', menu_id: 'financeiro', menu_label: 'Financeiro', allowed: true, group: null },
      { role: 'programador', menu_id: 'cadastros', menu_label: 'Cadastros', allowed: true, group: null },
      { role: 'programador', menu_id: 'rh', menu_label: 'RH & Pessoas', allowed: true, group: null },
      { role: 'programador', menu_id: 'relatorios', menu_label: 'Relatórios', allowed: true, group: null },
      { role: 'programador', menu_id: 'administracao', menu_label: 'Administração', allowed: true, group: null },
      { role: 'programador', menu_id: 'ajustes', menu_label: 'Ajustes', allowed: true, group: null },
      { role: 'programador', menu_id: 'ti', menu_label: 'TI', allowed: true, group: null },

      // ===== GERAL (Admin Empresa) =====
      { role: 'geral', menu_id: 'dashboard', menu_label: 'Dashboard', allowed: true, group: null },
      { role: 'geral', menu_id: 'calendario', menu_label: 'Calendário', allowed: true, group: null },
      { role: 'geral', menu_id: 'obras', menu_label: 'Obras', allowed: true, group: null },
      { role: 'geral', menu_id: 'obras-todas', menu_label: 'Todas as Obras', allowed: true, group: 'Listagem' },
      { role: 'geral', menu_id: 'obras-gestao', menu_label: 'Gestão de Obras', allowed: true, group: 'Listagem' },
      { role: 'geral', menu_id: 'obras-diario', menu_label: 'Diário de Obra', allowed: true, group: 'Execução' },
      { role: 'geral', menu_id: 'suprimentos', menu_label: 'Suprimentos', allowed: true, group: null },
      { role: 'geral', menu_id: 'estoques', menu_label: 'Estoques', allowed: true, group: null },
      { role: 'geral', menu_id: 'logistica', menu_label: 'Logística & Frota', allowed: true, group: null },
      { role: 'geral', menu_id: 'equipamentos', menu_label: 'Equipamentos', allowed: true, group: null },
      { role: 'geral', menu_id: 'financeiro', menu_label: 'Financeiro', allowed: true, group: null },
      { role: 'geral', menu_id: 'cadastros', menu_label: 'Cadastros', allowed: true, group: null },
      { role: 'geral', menu_id: 'rh', menu_label: 'RH & Pessoas', allowed: true, group: null },
      { role: 'geral', menu_id: 'relatorios', menu_label: 'Relatórios', allowed: true, group: null },
      { role: 'geral', menu_id: 'administracao', menu_label: 'Administração', allowed: true, group: null },
      { role: 'geral', menu_id: 'ajustes', menu_label: 'Ajustes', allowed: true, group: null },

      // ===== DIRETORIA =====
      { role: 'diretoria', menu_id: 'dashboard', menu_label: 'Dashboard', allowed: true, group: null },
      { role: 'diretoria', menu_id: 'obras', menu_label: 'Obras', allowed: true, group: null },
      { role: 'diretoria', menu_id: 'obras-todas', menu_label: 'Todas as Obras', allowed: true, group: 'Listagem' },
      { role: 'diretoria', menu_id: 'financeiro', menu_label: 'Financeiro', allowed: true, group: null },
      { role: 'diretoria', menu_id: 'relatorios', menu_label: 'Relatórios', allowed: true, group: null },

      // ===== FINANCEIRO =====
      { role: 'financeiro', menu_id: 'dashboard', menu_label: 'Dashboard', allowed: true, group: null },
      { role: 'financeiro', menu_id: 'financeiro', menu_label: 'Financeiro', allowed: true, group: null },
      { role: 'financeiro', menu_id: 'relatorios', menu_label: 'Relatórios', allowed: true, group: null },
      { role: 'financeiro', menu_id: 'obras', menu_label: 'Obras', allowed: true, group: null },
      { role: 'financeiro', menu_id: 'obras-todas', menu_label: 'Todas as Obras', allowed: true, group: 'Listagem' },
      { role: 'financeiro', menu_id: 'cadastros', menu_label: 'Cadastros', allowed: true, group: null },

      // ===== ENGENHARIA =====
      { role: 'engenharia', menu_id: 'dashboard', menu_label: 'Dashboard', allowed: true, group: null },
      { role: 'engenharia', menu_id: 'calendario', menu_label: 'Calendário', allowed: true, group: null },
      { role: 'engenharia', menu_id: 'obras', menu_label: 'Obras', allowed: true, group: null },
      { role: 'engenharia', menu_id: 'obras-todas', menu_label: 'Todas as Obras', allowed: true, group: 'Listagem' },
      { role: 'engenharia', menu_id: 'obras-gestao', menu_label: 'Gestão de Obras', allowed: true, group: 'Listagem' },
      { role: 'engenharia', menu_id: 'obras-diario', menu_label: 'Diário de Obra', allowed: true, group: 'Execução' },
      { role: 'engenharia', menu_id: 'obras-engenharia', menu_label: 'Engenharia & Qualidade', allowed: true, group: 'Execução' },
      { role: 'engenharia', menu_id: 'obras-mapa-medicoes', menu_label: 'Mapa de Medições', allowed: true, group: 'Medições' },
      { role: 'engenharia', menu_id: 'obras-medicoes', menu_label: 'Medições', allowed: true, group: 'Medições' },
      { role: 'engenharia', menu_id: 'suprimentos', menu_label: 'Suprimentos', allowed: true, group: null },
      { role: 'engenharia', menu_id: 'suprimentos-solicitar', menu_label: 'Solicitar Compra', allowed: true, group: 'Solicitações' },
      { role: 'engenharia', menu_id: 'estoques', menu_label: 'Estoques', allowed: true, group: null },
      { role: 'engenharia', menu_id: 'equipamentos', menu_label: 'Equipamentos', allowed: true, group: null },
      { role: 'engenharia', menu_id: 'equipamentos-agendamento', menu_label: 'Agendamento', allowed: true, group: 'Gestão' },
      { role: 'engenharia', menu_id: 'relatorios', menu_label: 'Relatórios', allowed: true, group: null },

      // ===== COMPRAS =====
      { role: 'compras', menu_id: 'suprimentos', menu_label: 'Suprimentos', allowed: true, group: null },
      { role: 'compras', menu_id: 'suprimentos-solicitar', menu_label: 'Solicitar Compra', allowed: true, group: 'Solicitações' },
      { role: 'compras', menu_id: 'suprimentos-requisicoes', menu_label: 'Requisições', allowed: true, group: 'Solicitações' },
      { role: 'compras', menu_id: 'suprimentos-cotacoes', menu_label: 'Cotações', allowed: true, group: 'Cotação & Compra' },
      { role: 'compras', menu_id: 'suprimentos-ordens-compra', menu_label: 'Ordens de Compra', allowed: true, group: 'Cotação & Compra' },
      { role: 'compras', menu_id: 'suprimentos-contratos', menu_label: 'Contratos com Fornecedores', allowed: true, group: 'Cotação & Compra' },
      { role: 'compras', menu_id: 'cadastros', menu_label: 'Cadastros', allowed: true, group: null },
      { role: 'compras', menu_id: 'relatorios', menu_label: 'Relatórios', allowed: true, group: null },
      { role: 'compras', menu_id: 'obras', menu_label: 'Obras', allowed: true, group: null },

      // ===== ALMOXARIFADO =====
      { role: 'almoxarifado', menu_id: 'estoques', menu_label: 'Estoques', allowed: true, group: null },
      { role: 'almoxarifado', menu_id: 'logistica', menu_label: 'Logística & Frota', allowed: true, group: null },
      { role: 'almoxarifado', menu_id: 'suprimentos', menu_label: 'Suprimentos', allowed: true, group: null },
      { role: 'almoxarifado', menu_id: 'relatorios', menu_label: 'Relatórios', allowed: true, group: null },

      // ===== LOGÍSTICA =====
      { role: 'logistica', menu_id: 'dashboard', menu_label: 'Dashboard', allowed: true, group: null },
      { role: 'logistica', menu_id: 'logistica', menu_label: 'Logística & Frota', allowed: true, group: null },
      { role: 'logistica', menu_id: 'logistica-minhas-rotas', menu_label: 'Minhas Rotas', allowed: true, group: 'Operação' },
      { role: 'logistica', menu_id: 'logistica-viagens', menu_label: 'Viagens & Abastecimentos', allowed: true, group: 'Operação' },
      { role: 'logistica', menu_id: 'logistica-relatorios', menu_label: 'Relatórios de Viagem', allowed: true, group: 'Operação' },
      { role: 'logistica', menu_id: 'logistica-frota', menu_label: 'Frota', allowed: true, group: 'Gestão' },
      { role: 'logistica', menu_id: 'logistica-motoristas', menu_label: 'Motoristas', allowed: true, group: 'Gestão' },
      { role: 'logistica', menu_id: 'logistica-rastreamento', menu_label: 'Rastreamento GPS', allowed: true, group: 'Gestão' },
      { role: 'logistica', menu_id: 'logistica-custos', menu_label: 'Custos de Viagens', allowed: true, group: 'Relatórios' },
      { role: 'logistica', menu_id: 'logistica-solicitar-transporte', menu_label: 'Solicitar Transporte', allowed: true, group: 'Solicitações' },
      { role: 'logistica', menu_id: 'estoques', menu_label: 'Estoques', allowed: true, group: null },
      { role: 'logistica', menu_id: 'equipamentos', menu_label: 'Equipamentos', allowed: false, group: null },
      { role: 'logistica', menu_id: 'relatorios', menu_label: 'Relatórios', allowed: true, group: null },

      // ===== RH =====
      { role: 'rh', menu_id: 'rh', menu_label: 'RH & Pessoas', allowed: true, group: null },
      { role: 'rh', menu_id: 'obras', menu_label: 'Obras', allowed: true, group: null },
      { role: 'rh', menu_id: 'relatorios', menu_label: 'Relatórios', allowed: true, group: null },

      // ===== CAMPO =====
      { role: 'campo', menu_id: 'dashboard', menu_label: 'Dashboard', allowed: true, group: null },
      { role: 'campo', menu_id: 'calendario', menu_label: 'Calendário', allowed: true, group: null },
      { role: 'campo', menu_id: 'obras', menu_label: 'Obras', allowed: true, group: null },
      { role: 'campo', menu_id: 'obras-diario', menu_label: 'Diário de Obra', allowed: true, group: 'Execução' },
      { role: 'campo', menu_id: 'rh', menu_label: 'RH & Pessoas', allowed: true, group: null },
      { role: 'campo', menu_id: 'logistica', menu_label: 'Logística & Frota', allowed: true, group: null },
    ];

    // NÃO limpar dados existentes — apenas adicionar novas keys
    // Isso garante que o sistema antigo continua funcionando durante migração

    // Buscar dados existentes para não duplicar
    const existing = await base44.entities.RolePermission.list();
    const existingKeys = new Set(existing.map(p => `${p.role}__${p.permission_key}`));

    // Filtrar dados novos para não duplicar
    const newDataToInsert = rolePermissionsData.filter(item => {
      const key = `${item.role}__${item.menu_id}`;
      return !existingKeys.has(key);
    });

    // Inserir apenas dados novos (se houver)
    if (newDataToInsert.length > 0) {
      await base44.entities.RolePermission.bulkCreate(newDataToInsert);
    }

    // ============ ADICIONAR NOVAS PERMISSION KEYS (MODULO_ACAO) ============
    const newPermissionKeysData = [
      // Programador - acesso total
      ...generateNewKeysForRole('programador', [
        'DASHBOARD_VIEW', 'CALENDARIO_VIEW', 'OBRAS_VIEW', 'OBRAS_CREATE', 'OBRAS_EDIT', 'OBRAS_DELETE',
        'DIARIO_CREATE', 'MEDICOES_VIEW', 'MEDICOES_CREATE', 'MEDICOES_APPROVE',
        'ENGENHARIA_VIEW', 'COMPRAS_VIEW', 'COMPRAS_CREATE', 'COMPRAS_APPROVE', 'CONTRATOS_VIEW',
        'ESTOQUE_VIEW', 'ESTOQUE_CREATE', 'ESTOQUE_EDIT', 'LOGISTICA_VIEW', 'LOGISTICA_CREATE',
        'EQUIPAMENTOS_VIEW', 'FINANCEIRO_VIEW', 'FINANCEIRO_APPROVE', 'RH_VIEW', 'RELATORIOS_VIEW',
        'CADASTROS_VIEW', 'ADMIN_CONFIG', 'PROFILE_EDIT'
      ]),
      // Admin Empresa (geral)
      ...generateNewKeysForRole('geral', [
        'DASHBOARD_VIEW', 'CALENDARIO_VIEW', 'OBRAS_VIEW', 'OBRAS_CREATE', 'OBRAS_EDIT',
        'DIARIO_CREATE', 'MEDICOES_VIEW', 'COMPRAS_VIEW', 'COMPRAS_CREATE', 'COMPRAS_APPROVE',
        'CONTRATOS_VIEW', 'ESTOQUE_VIEW', 'ESTOQUE_CREATE', 'LOGISTICA_VIEW', 'LOGISTICA_CREATE',
        'EQUIPAMENTOS_VIEW', 'FINANCEIRO_VIEW', 'FINANCEIRO_APPROVE', 'RH_VIEW', 'RELATORIOS_VIEW',
        'CADASTROS_VIEW', 'ADMIN_CONFIG', 'PROFILE_EDIT'
      ]),
      // Diretoria
      ...generateNewKeysForRole('diretoria', [
        'DASHBOARD_VIEW', 'OBRAS_VIEW', 'FINANCEIRO_VIEW', 'FINANCEIRO_APPROVE', 'RELATORIOS_VIEW', 'PROFILE_EDIT'
      ]),
      // Financeiro
      ...generateNewKeysForRole('financeiro', [
        'DASHBOARD_VIEW', 'FINANCEIRO_VIEW', 'FINANCEIRO_APPROVE', 'RELATORIOS_VIEW', 'OBRAS_VIEW', 'CADASTROS_VIEW', 'PROFILE_EDIT'
      ]),
      // Engenharia
      ...generateNewKeysForRole('engenharia', [
        'DASHBOARD_VIEW', 'CALENDARIO_VIEW', 'OBRAS_VIEW', 'OBRAS_EDIT', 'DIARIO_CREATE', 'MEDICOES_VIEW',
        'MEDICOES_CREATE', 'ENGENHARIA_VIEW', 'COMPRAS_VIEW', 'COMPRAS_CREATE', 'ESTOQUE_VIEW',
        'EQUIPAMENTOS_VIEW', 'RELATORIOS_VIEW', 'PROFILE_EDIT'
      ]),
      // Compras
      ...generateNewKeysForRole('compras', [
        'COMPRAS_VIEW', 'COMPRAS_CREATE', 'COMPRAS_APPROVE', 'CONTRATOS_VIEW', 'CADASTROS_VIEW', 'RELATORIOS_VIEW', 'OBRAS_VIEW', 'PROFILE_EDIT'
      ]),
      // Almoxarifado
      ...generateNewKeysForRole('almoxarifado', [
        'ESTOQUE_VIEW', 'ESTOQUE_CREATE', 'ESTOQUE_EDIT', 'COMPRAS_VIEW', 'LOGISTICA_VIEW', 'RELATORIOS_VIEW', 'PROFILE_EDIT'
      ]),
      // Logística
      ...generateNewKeysForRole('logistica', [
        'DASHBOARD_VIEW', 'LOGISTICA_VIEW', 'LOGISTICA_CREATE', 'EQUIPAMENTOS_VIEW', 'ESTOQUE_VIEW', 'RELATORIOS_VIEW', 'PROFILE_EDIT'
      ]),
      // RH
      ...generateNewKeysForRole('rh', [
        'RH_VIEW', 'OBRAS_VIEW', 'RELATORIOS_VIEW', 'PROFILE_EDIT'
      ]),
      // Campo
      ...generateNewKeysForRole('campo', [
        'DASHBOARD_VIEW', 'CALENDARIO_VIEW', 'OBRAS_VIEW', 'DIARIO_CREATE', 'RH_VIEW', 'LOGISTICA_VIEW', 'PROFILE_EDIT'
      ])
    ];

    // Verificar quais já existem antes de inserir
    const newKeysFiltered = newPermissionKeysData.filter(item => {
      const key = `${item.role}__${item.permission_key}`;
      return !existingKeys.has(key);
    });

    if (newKeysFiltered.length > 0) {
      await base44.entities.RolePermission.bulkCreate(newKeysFiltered);
    }

    return Response.json({
      success: true,
      message: `Legacy keys: ${newDataToInsert.length} inserted. New keys (V2): ${newKeysFiltered.length} inserted.`,
      totalRoles: new Set(rolePermissionsData.map(p => p.role)).size,
      legacyKeysInserted: newDataToInsert.length,
      v2PermissionKeysInserted: newKeysFiltered.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  });

  /**
  * Helper: gera dados de novas permission keys para um role
  */
  function generateNewKeysForRole(role, permissionKeys) {
  return permissionKeys.map(permission_key => ({
    role,
    permission_key,
    allowed: true,
    description: `New standard key: ${permission_key}`
  }));
  }
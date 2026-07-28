import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Inicializa permissões granulares para perfil Logística
 * Substitui as permissões de Logística por granulares
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Deletar permissões antigas de Logística
    const oldLogisticaPerms = await base44.entities.RolePermission.filter({ role: 'logistica' });
    for (const perm of oldLogisticaPerms) {
      await base44.entities.RolePermission.delete(perm.id);
    }

    // Novas permissões granulares para Logística
    const newLogisticaPerms = [
      {
        role: 'logistica',
        permission_key: 'LOG_VIEW',
        description: 'Acessar módulo Logística',
        menu_ids: ['logistica'],
        allowed: true
      },
      {
        role: 'logistica',
        permission_key: 'LOG_ROUTES_VIEW',
        description: 'Visualizar Minhas Rotas',
        menu_ids: ['logistica-minhas-rotas'],
        allowed: true
      },
      {
        role: 'logistica',
        permission_key: 'LOG_TRIPS_VIEW',
        description: 'Visualizar Viagens & Abastecimentos',
        menu_ids: ['logistica-viagens'],
        allowed: true
      },
      {
        role: 'logistica',
        permission_key: 'LOG_REPORT_VIEW',
        description: 'Visualizar Relatórios de Viagem',
        menu_ids: ['logistica-relatorios'],
        allowed: true
      },
      {
        role: 'logistica',
        permission_key: 'LOG_FLEET_VIEW',
        description: 'Visualizar Frota',
        menu_ids: ['logistica-frota'],
        allowed: true
      },
      {
        role: 'logistica',
        permission_key: 'LOG_DRIVERS_VIEW',
        description: 'Visualizar Motoristas',
        menu_ids: ['logistica-motoristas'],
        allowed: true
      },
      {
        role: 'logistica',
        permission_key: 'LOG_TRACK_VIEW',
        description: 'Visualizar Rastreamento GPS',
        menu_ids: ['logistica-rastreamento'],
        allowed: true
      },
      {
        role: 'logistica',
        permission_key: 'LOG_COST_VIEW',
        description: 'Visualizar Custos de Viagens',
        menu_ids: ['logistica-custos'],
        allowed: true
      },
      {
        role: 'logistica',
        permission_key: 'LOG_REQ_VEH_CREATE',
        description: 'Solicitar Transporte',
        menu_ids: ['logistica-solicitar-transporte'],
        allowed: true
      },
      {
        role: 'logistica',
        permission_key: 'EQUIP_VIEW',
        description: 'Acessar módulo Equipamentos',
        menu_ids: ['equipamentos'],
        allowed: false
      },
      {
        role: 'logistica',
        permission_key: 'DASH_VIEW',
        description: 'Visualizar Dashboard',
        menu_ids: ['dashboard'],
        allowed: true
      }
    ];

    // Inserir novas permissões
    await base44.entities.RolePermission.bulkCreate(newLogisticaPerms);

    return Response.json({
      success: true,
      message: 'Logística RBAC initialized com permissões granulares',
      permissions: newLogisticaPerms.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
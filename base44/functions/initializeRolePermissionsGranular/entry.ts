import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Inicializa permissões granulares por role
 * Executa uma única vez ao bootstrap do sistema
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (user?.role !== 'admin') {
    return Response.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const rolesGranulares = {
      'admin_empresa': [
        // RH completo
        'RH_COLABORADOR_VIEW',
        'RH_COLABORADOR_EDIT',
        'RH_SALARIO_VIEW',
        'RH_SALARIO_EDIT',
        'RH_FOLHA_GERAR',
        // Outros
        'ObrasCriar',
        'ObrasEditar',
        'ObrasDeletar',
        'ObrasVisualizar',
        'SuprimentosVisualizar',
        'EstoquesVisualizar',
        'LogisticaVisualizar',
        'FinanceiroVisualizar',
        'MedicoesVisualizar',
        'ColaboradoresVisualizar',
        'RhVisualizar'
      ],
      'rh': [
        'RH_COLABORADOR_VIEW',
        'RH_COLABORADOR_EDIT',
        'RH_SALARIO_VIEW',
        'RH_SALARIO_EDIT',
        'RH_FOLHA_GERAR',
        'ColaboradoresVisualizar',
        'ColaboradoresEditar',
        'RhVisualizar',
        'ApontamentosVisualizar'
      ],
      'campo': [
        'DiarioObraVisualizar',
        'DiarioObraEditar',
        'ApontamentoVisualizar'
        // NÃO tem RH_SALARIO_VIEW
      ],
      'motorista': [
        'LogisticaVisualizar',
        'ViagensVisualizar'
        // NÃO tem RH_SALARIO_VIEW
      ],
      'almoxarifado': [
        'EstoquesVisualizar',
        'EstoquesEditar',
        'MovimentacoesEstoque'
        // NÃO tem RH_SALARIO_VIEW
      ]
    };

    // Criar/atualizar RolePermission para cada role
    for (const [role, perms] of Object.entries(rolesGranulares)) {
      // Obter permissões existentes
      const existing = await base44.entities.RolePermission.filter({ role });
      const existingKeys = new Set(existing.map(p => p.permission_key));

      // Adicionar novas permissões
      for (const permKey of perms) {
        if (!existingKeys.has(permKey)) {
          await base44.entities.RolePermission.create({
            role,
            permission_key: permKey,
            allowed: true,
            description: `Permissão granular: ${permKey}`
          });
          console.log(`[INIT] Criada permissão ${role}:${permKey}`);
        }
      }
    }

    return Response.json({
      success: true,
      message: 'Permissões granulares inicializadas com sucesso'
    });
  } catch (error) {
    console.error('[INIT ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
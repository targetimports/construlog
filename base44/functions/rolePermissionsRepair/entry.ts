import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * REPAIR IDEMPOTENTE: Insere permissões mínimas se roleId estiver sem base
 * - Se role_permissions(roleId) vazio: insere mínimo
 * - Se já tem: não sobrescreve
 * - Chamado automaticamente no login e getEffectivePermissionsV2
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { roleId } = await req.json();

    if (!roleId) {
      return Response.json({ error: 'roleId required' }, { status: 400 });
    }

    // MÍNIMAS POR PERFIL
    const minimumsByRole = {
      almoxarifado: [
        'EstoquesVisaoGeral',
        'EstoquesSaldo',
        'EstoquesDepositos',
        'EstoquesRecebimento',
        'EstoquesTransferencias',
        'Logistica',
        'Suprimentos',
        'Relatorios'
      ],
      logistica: [
        'Dashboard',
        'Logistica',
        'LogisticaSolicitarTransporte',
        'LogisticaMinhasRotas',
        'LogisticaViagens',
        'LogisticaFrota',
        'LogisticaMotoristas',
        'EstoquesVisaoGeral',
        'Relatorios'
      ],
      compras: [
        'Suprimentos',
        'SolicitarCompra',
        'Requisicoes',
        'Cotacoes',
        'OrdensCompra',
        'Contratos',
        'Cadastros',
        'Relatorios',
        'Obras'
      ],
      engenharia: [
        'Dashboard',
        'Calendario',
        'Obras',
        'GestaoObras',
        'DiarioObra',
        'Engenharia',
        'MapaMedicoes',
        'Medicoes',
        'Suprimentos',
        'SolicitarCompra',
        'EstoquesVisaoGeral',
        'Equipamentos',
        'Relatorios'
      ],
      financeiro: [
        'Dashboard',
        'Financeiro',
        'Relatorios',
        'Obras',
        'Cadastros'
      ],
      diretoria: [
        'Dashboard',
        'Obras',
        'GestaoObras',
        'Financeiro',
        'Relatorios'
      ],
      geral: [
        'Dashboard',
        'Calendario',
        'Obras',
        'GestaoObras',
        'DiarioObra',
        'Suprimentos',
        'EstoquesVisaoGeral',
        'EstoquesSaldo',
        'Logistica',
        'Equipamentos',
        'Financeiro',
        'Cadastros',
        'RH',
        'Relatorios',
        'Administracao'
      ],
      campo: [
        'Dashboard',
        'Calendario',
        'Obras',
        'DiarioObra',
        'RH',
        'Logistica'
      ],
      programador: [
        // Tudo
        'Dashboard',
        'Calendario',
        'Obras',
        'GestaoObras',
        'DiarioObra',
        'Engenharia',
        'MapaMedicoes',
        'Medicoes',
        'Suprimentos',
        'SolicitarCompra',
        'Requisicoes',
        'AprovarSolicitacoes',
        'Cotacoes',
        'OrdensCompra',
        'Contratos',
        'EstoquesVisaoGeral',
        'EstoquesSaldo',
        'EstoquesDepositos',
        'Logistica',
        'LogisticaSolicitarTransporte',
        'LogisticaMinhasRotas',
        'LogisticaViagens',
        'LogisticaFrota',
        'LogisticaMotoristas',
        'Equipamentos',
        'Financeiro',
        'Cadastros',
        'RH',
        'Relatorios',
        'Administracao'
      ]
    };

    const minimums = minimumsByRole[roleId] || [];

    if (minimums.length === 0) {
      return Response.json({
        success: true,
        message: `Role ${roleId} não tem mínimos definidos`,
        inserted: 0,
        skipped: 0
      });
    }

    // Verificar existentes
    const existing = await base44.entities.RolePermission.filter({ role: roleId });
    const existingKeys = new Set(existing.map(p => p.permission_key));

    let insertedCount = 0;

    // Inserir faltantes
    for (const permKey of minimums) {
      if (!existingKeys.has(permKey)) {
        await base44.entities.RolePermission.create({
          role: roleId,
          permission_key: permKey,
          allowed: true,
          description: `Permissão mínima para ${roleId}`
        });
        insertedCount++;
      }
    }

    return Response.json({
      success: true,
      message: `Repair completado para role ${roleId}`,
      roleId,
      inserted: insertedCount,
      alreadyExists: existingKeys.size,
      minimumRequired: minimums.length
    });
  } catch (error) {
    console.error('[REPAIR ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
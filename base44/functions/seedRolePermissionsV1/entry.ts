import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * SEED IDEMPOTENTE: Popula role_permissions com permissões mínimas por perfil
 * - Roda uma única vez
 * - Se já existe, não sobrescreve (verifica antes)
 * - Define o conjunto mínimo garantido por perfil
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // MÍNIMO DE PERMISSÕES POR PERFIL
    const rolePermissionsData = [
      // === PROGRAMADOR (acesso total) ===
      { role: 'programador', permission_key: 'Dashboard', description: 'Dashboard' },
      { role: 'programador', permission_key: 'Calendario', description: 'Calendário' },
      { role: 'programador', permission_key: 'Obras', description: 'Obras' },
      { role: 'programador', permission_key: 'GestaoObras', description: 'Gestão de Obras' },
      { role: 'programador', permission_key: 'DiarioObra', description: 'Diário de Obra' },
      { role: 'programador', permission_key: 'Engenharia', description: 'Engenharia & Qualidade' },
      { role: 'programador', permission_key: 'MapaMedicoes', description: 'Mapa de Medições' },
      { role: 'programador', permission_key: 'Medicoes', description: 'Medições' },
      { role: 'programador', permission_key: 'Suprimentos', description: 'Suprimentos' },
      { role: 'programador', permission_key: 'SolicitarCompra', description: 'Solicitar Compra' },
      { role: 'programador', permission_key: 'Requisicoes', description: 'Requisições' },
      { role: 'programador', permission_key: 'AprovarSolicitacoes', description: 'Aprovar Solicitações' },
      { role: 'programador', permission_key: 'Cotacoes', description: 'Cotações' },
      { role: 'programador', permission_key: 'OrdensCompra', description: 'Ordens de Compra' },
      { role: 'programador', permission_key: 'Contratos', description: 'Contratos' },
      { role: 'programador', permission_key: 'EstoquesVisaoGeral', description: 'Painel de Estoque' },
      { role: 'programador', permission_key: 'EstoquesSaldo', description: 'Saldo por Almoxarifado' },
      { role: 'programador', permission_key: 'EstoquesDepositos', description: 'Depósitos' },
      { role: 'programador', permission_key: 'Logistica', description: 'Logística & Frota' },
      { role: 'programador', permission_key: 'LogisticaSolicitarTransporte', description: 'Solicitar Transporte' },
      { role: 'programador', permission_key: 'LogisticaMinhasRotas', description: 'Minhas Rotas' },
      { role: 'programador', permission_key: 'LogisticaViagens', description: 'Viagens & Abastecimentos' },
      { role: 'programador', permission_key: 'LogisticaFrota', description: 'Frota' },
      { role: 'programador', permission_key: 'LogisticaMotoristas', description: 'Motoristas' },
      { role: 'programador', permission_key: 'Equipamentos', description: 'Equipamentos' },
      { role: 'programador', permission_key: 'Financeiro', description: 'Financeiro' },
      { role: 'programador', permission_key: 'Cadastros', description: 'Cadastros' },
      { role: 'programador', permission_key: 'RH', description: 'RH & Pessoas' },
      { role: 'programador', permission_key: 'Relatorios', description: 'Relatórios' },
      { role: 'programador', permission_key: 'Administracao', description: 'Administração' },

      // === GERAL (Admin Empresa) ===
      { role: 'geral', permission_key: 'Dashboard', description: 'Dashboard' },
      { role: 'geral', permission_key: 'Calendario', description: 'Calendário' },
      { role: 'geral', permission_key: 'Obras', description: 'Obras' },
      { role: 'geral', permission_key: 'GestaoObras', description: 'Gestão de Obras' },
      { role: 'geral', permission_key: 'DiarioObra', description: 'Diário de Obra' },
      { role: 'geral', permission_key: 'Suprimentos', description: 'Suprimentos' },
      { role: 'geral', permission_key: 'EstoquesVisaoGeral', description: 'Painel de Estoque' },
      { role: 'geral', permission_key: 'EstoquesSaldo', description: 'Saldo por Almoxarifado' },
      { role: 'geral', permission_key: 'Logistica', description: 'Logística & Frota' },
      { role: 'geral', permission_key: 'Equipamentos', description: 'Equipamentos' },
      { role: 'geral', permission_key: 'Financeiro', description: 'Financeiro' },
      { role: 'geral', permission_key: 'Cadastros', description: 'Cadastros' },
      { role: 'geral', permission_key: 'RH', description: 'RH & Pessoas' },
      { role: 'geral', permission_key: 'Relatorios', description: 'Relatórios' },
      { role: 'geral', permission_key: 'Administracao', description: 'Administração' },

      // === DIRETORIA ===
      { role: 'diretoria', permission_key: 'Dashboard', description: 'Dashboard' },
      { role: 'diretoria', permission_key: 'Obras', description: 'Obras' },
      { role: 'diretoria', permission_key: 'GestaoObras', description: 'Gestão de Obras' },
      { role: 'diretoria', permission_key: 'Financeiro', description: 'Financeiro' },
      { role: 'diretoria', permission_key: 'Relatorios', description: 'Relatórios' },

      // === FINANCEIRO ===
      { role: 'financeiro', permission_key: 'Dashboard', description: 'Dashboard' },
      { role: 'financeiro', permission_key: 'Financeiro', description: 'Financeiro' },
      { role: 'financeiro', permission_key: 'Relatorios', description: 'Relatórios' },
      { role: 'financeiro', permission_key: 'Obras', description: 'Obras' },
      { role: 'financeiro', permission_key: 'Cadastros', description: 'Cadastros' },

      // === ENGENHARIA ===
      { role: 'engenharia', permission_key: 'Dashboard', description: 'Dashboard' },
      { role: 'engenharia', permission_key: 'Calendario', description: 'Calendário' },
      { role: 'engenharia', permission_key: 'Obras', description: 'Obras' },
      { role: 'engenharia', permission_key: 'GestaoObras', description: 'Gestão de Obras' },
      { role: 'engenharia', permission_key: 'DiarioObra', description: 'Diário de Obra' },
      { role: 'engenharia', permission_key: 'Engenharia', description: 'Engenharia & Qualidade' },
      { role: 'engenharia', permission_key: 'MapaMedicoes', description: 'Mapa de Medições' },
      { role: 'engenharia', permission_key: 'Medicoes', description: 'Medições' },
      { role: 'engenharia', permission_key: 'Suprimentos', description: 'Suprimentos' },
      { role: 'engenharia', permission_key: 'SolicitarCompra', description: 'Solicitar Compra' },
      { role: 'engenharia', permission_key: 'EstoquesVisaoGeral', description: 'Painel de Estoque' },
      { role: 'engenharia', permission_key: 'Equipamentos', description: 'Equipamentos' },
      { role: 'engenharia', permission_key: 'Relatorios', description: 'Relatórios' },

      // === COMPRAS (SUPRIMENTOS) ===
      { role: 'compras', permission_key: 'Suprimentos', description: 'Suprimentos' },
      { role: 'compras', permission_key: 'SolicitarCompra', description: 'Solicitar Compra' },
      { role: 'compras', permission_key: 'Requisicoes', description: 'Requisições' },
      { role: 'compras', permission_key: 'Cotacoes', description: 'Cotações' },
      { role: 'compras', permission_key: 'OrdensCompra', description: 'Ordens de Compra' },
      { role: 'compras', permission_key: 'Contratos', description: 'Contratos' },
      { role: 'compras', permission_key: 'Cadastros', description: 'Cadastros' },
      { role: 'compras', permission_key: 'Relatorios', description: 'Relatórios' },
      { role: 'compras', permission_key: 'Obras', description: 'Obras' },

      // === ALMOXARIFADO (ESTOQUE) ===
      { role: 'almoxarifado', permission_key: 'EstoquesVisaoGeral', description: 'Painel de Estoque' },
      { role: 'almoxarifado', permission_key: 'EstoquesSaldo', description: 'Saldo por Almoxarifado' },
      { role: 'almoxarifado', permission_key: 'EstoquesDepositos', description: 'Depósitos' },
      { role: 'almoxarifado', permission_key: 'EstoquesRecebimento', description: 'Recebimento' },
      { role: 'almoxarifado', permission_key: 'EstoquesTransferencias', description: 'Transferências' },
      { role: 'almoxarifado', permission_key: 'Logistica', description: 'Logística & Frota' },
      { role: 'almoxarifado', permission_key: 'Suprimentos', description: 'Suprimentos' },
      { role: 'almoxarifado', permission_key: 'Relatorios', description: 'Relatórios' },

      // === LOGÍSTICA ===
      { role: 'logistica', permission_key: 'Dashboard', description: 'Dashboard' },
      { role: 'logistica', permission_key: 'Logistica', description: 'Logística & Frota' },
      { role: 'logistica', permission_key: 'LogisticaSolicitarTransporte', description: 'Solicitar Transporte' },
      { role: 'logistica', permission_key: 'LogisticaMinhasRotas', description: 'Minhas Rotas' },
      { role: 'logistica', permission_key: 'LogisticaViagens', description: 'Viagens & Abastecimentos' },
      { role: 'logistica', permission_key: 'LogisticaFrota', description: 'Frota' },
      { role: 'logistica', permission_key: 'LogisticaMotoristas', description: 'Motoristas' },
      { role: 'logistica', permission_key: 'EstoquesVisaoGeral', description: 'Painel de Estoque' },
      { role: 'logistica', permission_key: 'Relatorios', description: 'Relatórios' },

      // === RH ===
      { role: 'rh', permission_key: 'RH', description: 'RH & Pessoas' },
      { role: 'rh', permission_key: 'Obras', description: 'Obras' },
      { role: 'rh', permission_key: 'Relatorios', description: 'Relatórios' },

      // === CAMPO ===
      { role: 'campo', permission_key: 'Dashboard', description: 'Dashboard' },
      { role: 'campo', permission_key: 'Calendario', description: 'Calendário' },
      { role: 'campo', permission_key: 'Obras', description: 'Obras' },
      { role: 'campo', permission_key: 'DiarioObra', description: 'Diário de Obra' },
      { role: 'campo', permission_key: 'RH', description: 'RH & Pessoas' },
      { role: 'campo', permission_key: 'Logistica', description: 'Logística & Frota' }
    ];

    let insertedCount = 0;
    let skippedCount = 0;

    // Para cada permissão, verificar se já existe
    for (const perm of rolePermissionsData) {
      const existing = await base44.entities.RolePermission.filter({
        role: perm.role,
        permission_key: perm.permission_key
      });

      if (existing.length === 0) {
        await base44.entities.RolePermission.create({
          role: perm.role,
          permission_key: perm.permission_key,
          allowed: true,
          description: perm.description
        });
        insertedCount++;
      } else {
        skippedCount++;
      }
    }

    return Response.json({
      success: true,
      message: `Seed completado idempotentemente`,
      inserted: insertedCount,
      skipped: skippedCount,
      total: rolePermissionsData.length
    });
  } catch (error) {
    console.error('[SEED ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
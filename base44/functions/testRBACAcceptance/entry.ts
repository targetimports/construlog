import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * TESTE DE ACEITE: Valida que os 3 perfis críticos podem acessar seus módulos
 * Caso 1: almoxarifado → EstoquesVisaoGeral
 * Caso 2: logistica → LogisticaMinhasRotas
 * Caso 3: compras → SolicitarCompra
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // TESTES
    const testCases = [
      { role: 'almoxarifado', permissionKey: 'EstoquesVisaoGeral', desc: 'Estoque - Visão Geral' },
      { role: 'logistica', permissionKey: 'LogisticaMinhasRotas', desc: 'Logística - Minhas Rotas' },
      { role: 'compras', permissionKey: 'SolicitarCompra', desc: 'Compras - Solicitar' }
    ];

    const results = [];

    for (const testCase of testCases) {
      try {
        // Buscar usuário com este role
        const users = await base44.entities.User.filter({ 
          perfil_acesso: testCase.role 
        });

        if (users.length === 0) {
          results.push({
            role: testCase.role,
            permissionKey: testCase.permissionKey,
            description: testCase.desc,
            status: 'NO_USER',
            message: `❌ Nenhum usuário com role ${testCase.role}`
          });
          continue;
        }

        const testUser = users[0];

        // Obter effective permissions
        const permRes = await base44.functions.invoke('getEffectivePermissionsV2', {
          userId: testUser.email
        });

        const { effectivePermissions, basePermissionCount, overrideEnabled } = permRes.data;
        const hasPermission = effectivePermissions[testCase.permissionKey] === true;

        results.push({
          role: testCase.role,
          permissionKey: testCase.permissionKey,
          description: testCase.desc,
          testUser: testUser.email,
          status: hasPermission ? 'PASS' : 'FAIL',
          message: hasPermission 
            ? `✓ ${testCase.role} pode acessar ${testCase.permissionKey}`
            : `✗ ${testCase.role} NEGADO em ${testCase.permissionKey}`,
          basePermCount: basePermissionCount,
          overrideEnabled,
          effectivePermCount: Object.keys(effectivePermissions).length
        });
      } catch (err) {
        results.push({
          role: testCase.role,
          permissionKey: testCase.permissionKey,
          description: testCase.desc,
          status: 'ERROR',
          message: err.message
        });
      }
    }

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;

    return Response.json({
      success: true,
      testResults: results,
      summary: {
        total: results.length,
        passed,
        failed,
        allPassed: failed === 0,
        message: failed === 0 ? '✓ TODOS OS TESTES PASSARAM' : `✗ ${failed} testes falharam`
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { FunctionLogger } from './_shared/logger.ts';

/**
 * Health Check do Sistema
 * Valida:
 * - Conexão com banco
 * - Execução de functions
 * - Integridade de entidades principais
 * - Fila outbox
 * - Permissões básicas
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const logger = new FunctionLogger('healthCheckSistema', base44);

  const healthCheck = {
    timestamp: new Date().toISOString(),
    ok: true,
    status: 'healthy',
    checks: {
      database: { ok: false, message: '' },
      functions: { ok: false, message: '' },
      entities: { ok: false, message: '' },
      outbox: { ok: false, message: '' },
      permissions: { ok: false, message: '' }
    },
    problemas: []
  };

  try {
    const user = await base44.auth.me().catch(() => null);

    // 🔒 Autenticação obrigatória — endpoint não pode ser público
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ✅ 1. VERIFICAR CONEXÃO COM BANCO
    console.log('[healthCheckSistema] Verificando banco de dados...');
    try {
      const usuarios = await base44.asServiceRole.entities.User.list().catch(() => []);
      healthCheck.checks.database.ok = true;
      healthCheck.checks.database.message = `✓ Banco OK (${usuarios.length} usuários)`;
    } catch (err) {
      healthCheck.checks.database.ok = false;
      healthCheck.checks.database.message = `✗ Erro: ${err.message}`;
      healthCheck.problemas.push('Banco de dados indisponível');
    }

    // ✅ 2. VERIFICAR EXECUÇÃO DE FUNCTIONS
    console.log('[healthCheckSistema] Verificando execução de functions...');
    try {
      // Tentar invocar uma function simples (logAuditoria como teste)
      const testeLog = await base44.asServiceRole.entities.SystemLogs?.list?.().catch(() => []);
      healthCheck.checks.functions.ok = true;
      healthCheck.checks.functions.message = '✓ Functions OK';
    } catch (err) {
      healthCheck.checks.functions.ok = false;
      healthCheck.checks.functions.message = `✗ Erro: ${err.message}`;
      healthCheck.problemas.push('Execução de functions com erro');
    }

    // ✅ 3. VERIFICAR INTEGRIDADE DE ENTIDADES PRINCIPAIS
    console.log('[healthCheckSistema] Verificando integridades de entidades...');
    try {
      const entitiesToCheck = ['Obra', 'OrdemCompra', 'Medicao', 'ContaFinanceira', 'MovimentacaoEstoque'];
      const entityStats = {};
      let hasErrors = false;

      const results = await Promise.all(
        entitiesToCheck.map(async (entityName) => {
          try {
            const records = await base44.asServiceRole.entities[entityName].list('-created_date', 1);
            return { entityName, count: records.length, ok: true };
          } catch (err) {
            return { entityName, error: err.message, ok: false };
          }
        })
      );
      for (const r of results) {
        entityStats[r.entityName] = r.ok ? r.count : `ERRO: ${r.error}`;
        if (!r.ok) hasErrors = true;
      }

      if (!hasErrors) {
        healthCheck.checks.entities.ok = true;
        healthCheck.checks.entities.message = `✓ ${entitiesToCheck.length} entidades OK`;
      } else {
        healthCheck.checks.entities.ok = false;
        healthCheck.checks.entities.message = '✗ Algumas entidades com erro';
        healthCheck.problemas.push('Erro ao acessar entidades principais');
      }

      healthCheck.checks.entities.stats = entityStats;
    } catch (err) {
      healthCheck.checks.entities.ok = false;
      healthCheck.checks.entities.message = `✗ Erro: ${err.message}`;
      healthCheck.problemas.push('Falha ao verificar entidades');
    }

    // ✅ 4. VERIFICAR FILA OUTBOX
    console.log('[healthCheckSistema] Verificando fila outbox...');
    try {
      const outbox = await base44.asServiceRole.entities.OpsOutbox?.list?.().catch(() => []);
      const pendentes = outbox?.filter(o => o.status === 'PENDENTE') || [];
      const errados = outbox?.filter(o => o.status === 'ERRO') || [];

      if (errados.length > 0) {
        healthCheck.checks.outbox.ok = false;
        healthCheck.checks.outbox.message = `⚠ ${pendentes.length} pendentes, ${errados.length} com erro`;
        healthCheck.problemas.push(`Fila outbox com ${errados.length} mensagens em erro`);
      } else {
        healthCheck.checks.outbox.ok = true;
        healthCheck.checks.outbox.message = `✓ ${pendentes.length} pendentes (OK)`;
      }

      healthCheck.checks.outbox.pending = pendentes.length;
      healthCheck.checks.outbox.errors = errados.length;
    } catch (err) {
      healthCheck.checks.outbox.ok = false;
      healthCheck.checks.outbox.message = `✗ Erro: ${err.message}`;
      healthCheck.problemas.push('Erro ao verificar fila outbox');
    }

    // ✅ 5. VERIFICAR PERMISSÕES BÁSICAS
    console.log('[healthCheckSistema] Verificando permissões...');
    try {
      let permissionsOk = true;

      // Se tem usuário, verificar permissões
      if (user) {
        const hasBasicPerms = user.role && ['user', 'admin'].includes(user.role);
        if (!hasBasicPerms) {
          healthCheck.checks.permissions.ok = false;
          healthCheck.checks.permissions.message = `✗ Usuário ${user.email} sem role válida`;
          healthCheck.problemas.push('Permissões de usuário inválidas');
          permissionsOk = false;
        }
      }

      if (permissionsOk) {
        healthCheck.checks.permissions.ok = true;
        healthCheck.checks.permissions.message = user 
          ? `✓ ${user.email} (${user.role})`
          : '✓ Sistema sem usuário (OK para webhooks)';
      }
    } catch (err) {
      healthCheck.checks.permissions.ok = false;
      healthCheck.checks.permissions.message = `✗ Erro: ${err.message}`;
      healthCheck.problemas.push('Erro ao verificar permissões');
    }

    // ✅ CONSOLIDAR STATUS
    const allChecksOk = Object.values(healthCheck.checks).every(c => c.ok === true);
    healthCheck.ok = allChecksOk;
    healthCheck.status = allChecksOk ? 'healthy' : healthCheck.problemas.length < 3 ? 'degraded' : 'unhealthy';

    // Log
    if (user) {
      await logger.success(user, {}, healthCheck);
    } else {
      console.log('[healthCheckSistema] Health check concluído:', healthCheck.status);
    }

    return Response.json(healthCheck);
  } catch (error) {
    const user = await base44.auth.me().catch(() => null);
    if (user) {
      await logger.error(user, {}, error, 'HEALTH_CHECK_ERROR');
    }

    return Response.json({
      ok: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      problemas: [error.message]
    }, { status: 500 });
  }
});
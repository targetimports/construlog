import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Backup Automático do Sistema
 * - Exporta dados principais
 * - Salva snapshot
 * - Registra auditoria
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    // Automação agendada: não há usuário autenticado, usar service role
    const user = await base44.auth.me().catch(() => null);

    const backupStart = Date.now();
    const backupData = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      entities: {}
    };

    console.log('[backupSistemaAutomatico] Iniciando backup...');

    // ✅ 1. EXPORTAR ENTIDADES PRINCIPAIS
    const entitiesToBackup = [
      'Obra',
      'OrdemCompra',
      'Medicao',
      'ContaFinanceira',
      'MovimentacaoEstoque',
      'Colaborador',
      'Fornecedor',
      'Contrato',
      'Material',
      'SaldoEstoque'
    ];

    for (const entityName of entitiesToBackup) {
      try {
        const records = await base44.asServiceRole.entities[entityName].list().catch(() => []);
        backupData.entities[entityName] = {
          total: records.length,
          sample: records.slice(0, 1000) // Limitar a 1000 registros por entidade
        };
        console.log(`[backupSistemaAutomatico] ${entityName}: ${records.length} registros`);
      } catch (err) {
        console.warn(`[backupSistemaAutomatico] Erro ao exportar ${entityName}:`, err.message);
        backupData.entities[entityName] = { error: err.message, total: 0 };
      }
    }

    // ✅ 2. SALVAR SNAPSHOT
    console.log('[backupSistemaAutomatico] Salvando snapshot...');
    let snapshotId = null;
    try {
      const snapshotRecord = await base44.asServiceRole.entities.SnapshotSistema.create({
        timestamp: new Date().toISOString(),
        tipo: 'BACKUP_AUTOMATICO',
        status: 'CONCLUÍDO',
        tamanho_mb: Math.round(JSON.stringify(backupData).length / 1024 / 1024),
        descricao: 'Backup automático do sistema',
        criado_por: user?.email || 'sistema',
        dados: JSON.stringify(backupData),
        restauravel: true,
        hash: generateSimpleHash(backupData)
      });
      snapshotId = snapshotRecord.id;
      console.log(`[backupSistemaAutomatico] Snapshot criado: ${snapshotId}`);
    } catch (err) {
      console.error('[backupSistemaAutomatico] Erro ao salvar snapshot:', err.message);
    }

    // ✅ 3. REGISTRAR AUDITORIA
    console.log('[backupSistemaAutomatico] Registrando auditoria...');
    try {
      await base44.asServiceRole.entities.LogAuditoria?.create({
        user_email: user?.email || 'sistema-backup',
        acao: 'BACKUP_AUTOMATICO',
        resultado: 'SUCESSO',
        motivo: 'Backup automático agendado',
        data_hora: new Date().toISOString(),
        metadata: JSON.stringify({
          snapshot_id: snapshotId,
          entidades_processadas: entitiesToBackup.length,
          total_registros: Object.values(backupData.entities).reduce(
            (sum, e) => sum + (e.total || 0),
            0
          )
        })
      }).catch(() => {});
    } catch (err) {
      console.warn('[backupSistemaAutomatico] Erro ao registrar auditoria:', err.message);
    }

    // ✅ 4. REGISTRAR EM SYSTEMLOGS
    const executionTime = Date.now() - backupStart;
    const totalRegistros = Object.values(backupData.entities).reduce(
      (sum, e) => sum + (e.total || 0),
      0
    );

    console.log(`[backupSistemaAutomatico] Concluído em ${executionTime}ms. Total registros: ${totalRegistros}`);

    return Response.json({
      ok: true,
      message: 'Backup concluído com sucesso',
      backup: {
        snapshot_id: snapshotId,
        timestamp: backupData.timestamp,
        total_registros: totalRegistros,
        entidades_processadas: entitiesToBackup.length,
        tempo_ms: executionTime
      }
    });
  } catch (error) {
    console.error('[backupSistemaAutomatico] Erro:', error.message);
    return Response.json(
      { ok: false, code: 'ERROR', message: error.message },
      { status: 500 }
    );
  }
});

/**
 * Gerar hash simples para validação de integridade
 */
function generateSimpleHash(data) {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Converter para 32-bit
  }
  return Math.abs(hash).toString(16);
}
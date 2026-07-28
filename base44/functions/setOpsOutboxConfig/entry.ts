import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { crypto } from 'https://deno.land/std@0.208.0/crypto/mod.ts';

Deno.serve(async (req) => {
  const buildId = `OUTBOX-CONFIG-SET-${Date.now()}`;

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    webhook_url,
    webhook_secret_plain,
    batch_size,
    max_retries,
    backoff_base_ms,
    timeout_ms,
    enabled
  } = body;

  // Validação
  if (enabled === true && (!webhook_url || webhook_url.trim() === '')) {
    return Response.json(
      { error: 'webhook_url obrigatório quando enabled=true', field: 'webhook_url' },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const savedKeys = [];
  let secretSaved = false;

  try {
    // Preparar dados para salvar
    const configData = [];

    // webhook_url
    if (webhook_url !== undefined) {
      configData.push({
        chave: 'ops_outbox_webhook_url',
        valor: webhook_url || '',
        tipo: 'texto',
        categoria: 'notificacoes',
        descricao: 'URL do webhook para notificações OpsOutbox'
      });
    }

    // webhook_secret_hash (se secret foi passado)
    if (webhook_secret_plain !== undefined && webhook_secret_plain) {
      const encoder = new TextEncoder();
      const data = encoder.encode(webhook_secret_plain);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      configData.push({
        chave: 'ops_outbox_webhook_secret_hash',
        valor: hashHex,
        tipo: 'texto',
        categoria: 'notificacoes',
        descricao: 'SHA256 hash do webhook secret (nunca armazenar plain)'
      });
      secretSaved = true;
    }

    // batch_size
    if (batch_size !== undefined) {
      configData.push({
        chave: 'ops_outbox_batch_size',
        valor: String(batch_size || 20),
        tipo: 'numero',
        categoria: 'notificacoes',
        descricao: 'Tamanho do lote para processar outbox'
      });
    }

    // max_retries
    if (max_retries !== undefined) {
      configData.push({
        chave: 'ops_outbox_max_retries',
        valor: String(max_retries || 5),
        tipo: 'numero',
        categoria: 'notificacoes',
        descricao: 'Máximo de tentativas antes de deadletter'
      });
    }

    // backoff_base_ms
    if (backoff_base_ms !== undefined) {
      configData.push({
        chave: 'ops_outbox_backoff_base_ms',
        valor: String(backoff_base_ms || 3000),
        tipo: 'numero',
        categoria: 'notificacoes',
        descricao: 'Base em ms para backoff exponencial'
      });
    }

    // timeout_ms
    if (timeout_ms !== undefined) {
      configData.push({
        chave: 'ops_outbox_timeout_ms',
        valor: String(timeout_ms || 8000),
        tipo: 'numero',
        categoria: 'notificacoes',
        descricao: 'Timeout em ms para chamadas webhook'
      });
    }

    // enabled
    if (enabled !== undefined) {
      configData.push({
        chave: 'ops_outbox_enabled',
        valor: enabled === true ? 'true' : 'false',
        tipo: 'boolean',
        categoria: 'notificacoes',
        descricao: 'Se processamento de outbox está habilitado'
      });
    }

    // Salvar todas as chaves
    for (const cfg of configData) {
      // Tentar atualizar se existe, senão criar
      const existing = await base44.asServiceRole.entities.ConfiguracaoSistema.filter(
        { chave: cfg.chave },
        undefined,
        1
      );

      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.ConfiguracaoSistema.update(existing[0].id, cfg);
      } else {
        await base44.asServiceRole.entities.ConfiguracaoSistema.create(cfg);
      }
      savedKeys.push(cfg.chave);
    }

    // Auditoria (sem secret em detalhes)
    try {
      const detalhes = {
        updated_keys: savedKeys,
        secret_updated: secretSaved,
        enabled: enabled !== undefined ? enabled : 'unchanged'
      };
      await base44.asServiceRole.entities.LogAuditoria.create({
        user_email: user.email,
        acao: 'UPDATE_CONFIG',
        modulo: 'ops',
        entidade: 'OpsOutboxConfig',
        detalhes: JSON.stringify(detalhes),
        sucesso: true
      });
    } catch (e) {
      console.error('Erro auditoria:', e.message);
    }

    return Response.json({
      ok: true,
      build_id: buildId,
      saved_keys: savedKeys,
      enabled: enabled !== undefined ? enabled : 'unchanged',
      secret_saved: secretSaved
    });
  } catch (error) {
    console.error('Erro em setOpsOutboxConfig:', error.message);
    return Response.json({ error: error.message, build_id: buildId }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { requireRole } from './_lib/requireRole.js';
import { logAuditoria } from './_lib/logAuditoria.js';

/**
 * Aprovar Ordem de Compra
 * Decisão baseada em THRESHOLD numérico
 * - valor <= threshold: aprovação DIRETA
 * - valor > threshold: cria registro de APROVAÇÃO PENDENTE
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user } = await requireRole(base44, ['diretor', 'compras']);

    const { oc_id } = await req.json();
    if (!oc_id) {
      return Response.json({ error: 'oc_id é obrigatório' }, { status: 400 });
    }

    const BUILD_ID = 'APROVAR-OC-' + Date.now();
    console.log(`[${BUILD_ID}] Iniciando aprovarOrdemCompra para OC: ${oc_id}`);

    // Buscar OC
    let oc;
    try {
      oc = await base44.asServiceRole.entities.OrdemCompra.read(oc_id);
    } catch {
      return Response.json({ error: 'OC não encontrada' }, { status: 404 });
    }

    // VALIDAÇÕES CRÍTICAS
    if (!oc.obra_id) {
      return Response.json({
        error: 'Obra é obrigatória para aprovar OC',
        ok: false,
        build_id: BUILD_ID
      }, { status: 422 });
    }

    if (!oc.fornecedor_id && !oc.fornecedor_nome) {
      return Response.json({
        error: 'Fornecedor é obrigatório para aprovar OC',
        ok: false,
        build_id: BUILD_ID
      }, { status: 422 });
    }

    if (oc.status !== 'criada') {
      return Response.json({
        error: `OC já está com status: ${oc.status}`,
        ok: false,
        build_id: BUILD_ID
      }, { status: 422 });
    }

    // NORMALIZAR VALOR
    const oc_valor_raw = oc.valor_total;
    let oc_valor = oc_valor_raw;

    if (typeof oc_valor === 'string') {
      oc_valor = oc_valor
        .replace(/[R$\s]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
    }

    oc_valor = parseFloat(oc_valor);

    if (isNaN(oc_valor) || oc_valor <= 0) {
      return Response.json({
        error: 'Valor total da OC inválido ou menor/igual a zero',
        ok: false,
        build_id: BUILD_ID,
        oc_valor_raw
      }, { status: 400 });
    }

    // FETCH THRESHOLDS
    const configN1 = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({
      chave: 'compras_threshold_n1'
    });

    const thresholdN1_raw = configN1?.[0]?.valor || '5000';
    let thresholdN1 = parseFloat(thresholdN1_raw);
    if (isNaN(thresholdN1)) thresholdN1 = 5000;

    console.log(`[${BUILD_ID}] oc_valor=${oc_valor}, thresholdN1=${thresholdN1}`);

    // DECISÃO: DIRECT vs REQUIRES_APPROVAL
    const precisaAprovacao = oc_valor > thresholdN1;

    if (precisaAprovacao) {
      // BRANCH: REQUIRES_APPROVAL
      console.log(`[${BUILD_ID}] BRANCH=REQUIRES_APPROVAL`);

      // Verificar se já existe aprovação pendente
      const aprovExist = await base44.asServiceRole.entities.Aprovacao.filter({
        referencia_id: oc_id,
        status: 'pendente'
      });

      if (aprovExist && aprovExist.length > 0) {
        return Response.json({
          ok: true,
          build_id: BUILD_ID,
          branch: 'REQUIRES_APPROVAL',
          oc_id,
          oc_valor,
          oc_valor_raw,
          thresholdN1,
          thresholdN1_raw,
          aprovacao_id: aprovExist[0].id,
          message: 'OC já aguardando aprovação'
        });
      }

      // Criar nova Aprovacao
      const aprovacao = await base44.asServiceRole.entities.Aprovacao.create({
        modulo: 'compras',
        referencia_tipo: 'OrdemCompra',
        referencia_id: oc_id,
        obra_id: oc.obra_id,
        valor: oc_valor,
        nivel: 'N1',
        status: 'pendente',
        solicitado_por: user.email,
        solicitado_em: new Date().toISOString(),
        descricao: `OC ${oc.numero || oc_id} - ${oc.fornecedor_nome} - R$ ${oc_valor.toFixed(2)}`
      });

      // Atualizar OC
      await base44.asServiceRole.entities.OrdemCompra.update(oc_id, {
        status: 'em_aprovacao'
      });

      // Verificar persistência
      const ocVerify = await base44.asServiceRole.entities.OrdemCompra.read(oc_id);
      if (ocVerify.status !== 'em_aprovacao') {
        return Response.json({
          ok: false,
          build_id: BUILD_ID,
          error: 'PERSISTENCE_FAILED',
          oc_valor,
          oc_valor_raw,
          thresholdN1
        }, { status: 500 });
      }

      // Auditoria
      await logAuditoria(base44, {
        entidade_tipo: 'Aprovacao',
        entidade_id: aprovacao.id,
        acao: 'SOLICITAR_APROVACAO_OC',
        resumo: `Solicitação aprovação OC - R$ ${oc_valor.toFixed(2)}`,
        dados_novos: { oc_id, valor: oc_valor, referencia_tipo: 'OrdemCompra' },
        user_email: user.email,
        role: user.cargo,
        origem: 'ui',
        modulo: 'compras'
      });

      return Response.json({
        ok: true,
        build_id: BUILD_ID,
        branch: 'REQUIRES_APPROVAL',
        oc_id,
        oc_valor,
        oc_valor_raw,
        thresholdN1,
        thresholdN1_raw,
        aprovacao_id: aprovacao.id,
        message: `OC enviada para aprovação`
      });
    }

    // BRANCH: DIRECT
    console.log(`[${BUILD_ID}] BRANCH=DIRECT`);
    const dataAprovacao = new Date().toISOString().split('T')[0];
    
    await base44.asServiceRole.entities.OrdemCompra.update(oc_id, {
      status: 'aprovada',
      aprovado_por: user.email,
      data_aprovacao: dataAprovacao
    });

    // Verificar persistência
    const ocVerifyDirect = await base44.asServiceRole.entities.OrdemCompra.read(oc_id);
    if (ocVerifyDirect.status !== 'aprovada') {
      return Response.json({
        ok: false,
        build_id: BUILD_ID,
        error: 'PERSISTENCE_FAILED',
        oc_valor,
        oc_valor_raw,
        thresholdN1
      }, { status: 500 });
    }

    // Auditoria
    await logAuditoria(base44, {
      entidade_tipo: 'OrdemCompra',
      entidade_id: oc_id,
      acao: 'APROVAR',
      resumo: `OC ${oc.numero || oc_id} aprovada (direta)`,
      dados_anteriores: { status: 'criada' },
      dados_novos: { status: 'aprovada', aprovado_por: user.email },
      user_email: user.email,
      role: user.cargo,
      origem: 'ui',
      modulo: 'compras'
    });

    return Response.json({
      ok: true,
      build_id: BUILD_ID,
      branch: 'DIRECT',
      oc_id,
      oc_valor,
      oc_valor_raw,
      thresholdN1,
      thresholdN1_raw,
      aprovacao_id: null,
      message: 'OC aprovada com sucesso'
    });

  } catch (error) {
    console.error('[ERROR] aprovarOrdemCompra:', error);
    return Response.json({
      error: error.message || 'Erro ao aprovar OC',
      ok: false
    }, { status: 500 });
  }
});
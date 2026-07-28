import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Dispara quando BM é aprovada
 * - Recalcula BM e futuras
 * - Registra auditoria
 * - Atualiza Obra.percent_concluida_atual
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { event, data, old_data } = payload;

    if (event?.type !== 'update' || !data) {
      return Response.json({ skipped: true });
    }

    const { id: bm_id, status, obra_id, numero } = data;

    // Só processa se status muda para APROVADA ou RETIFICADA
    if (!['APROVADA', 'RETIFICADA'].includes(status)) {
      return Response.json({ skipped: true });
    }

    const statusAnterior = old_data?.status || 'RASCUNHO';
    const mudouParaAprovada = statusAnterior !== 'APROVADA' && status === 'APROVADA';

    // Se mudou para APROVADA, registrar auditoria
    if (mudouParaAprovada) {
      try {
        await base44.asServiceRole.entities.AuditLog.create({
          obra_id,
          entidade: 'BM',
          entidade_id: bm_id,
          acao: 'approve',
          dados_antes: old_data,
          dados_depois: data,
          usuario_id: 'sistema',
          observacao: `BM #${numero} aprovada`,
        });
      } catch (err) {
        console.log('Erro ao registrar auditoria:', err.message);
        // Não quebra o fluxo se auditoria falhar
      }

      // Se esta BM aprovada é uma retificação (possui retifica_bm_id), marcar a original como RETIFICADA
      if (data?.retifica_bm_id) {
        try {
          await base44.asServiceRole.entities.BM.update(data.retifica_bm_id, {
            status: 'RETIFICADA',
            retificada_por_id: bm_id,
          });
          await base44.asServiceRole.entities.AuditLog.create({
            obra_id,
            entidade: 'BM',
            entidade_id: data.retifica_bm_id,
            acao: 'rectify',
            dados_antes: old_data,
            dados_depois: { status: 'RETIFICADA', retificada_por_id: bm_id },
            usuario_id: 'sistema',
            observacao: `BM original #${numero} marcada como RETIFICADA por ${bm_id}`,
          });
        } catch (err) {
          console.log('Erro ao marcar original como RETIFICADA:', err.message);
        }
      }
    }

    // Chamar calcObraProgress para atualizar percent_concluida_atual
    if (mudouParaAprovada && obra_id) {
      try {
        await base44.functions.invoke('calcObraProgress', {
          event: { type: 'update' },
          data: { obra_id, contrato_versao_id: data.contrato_versao_id, status: 'APROVADA' },
        });
      } catch (err) {
        console.log('Erro ao calcular progresso:', err.message);
      }
    }

    return Response.json({ success: true, bm_id });
  } catch (error) {
    console.error('Erro em onBMApproveWithAudit:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
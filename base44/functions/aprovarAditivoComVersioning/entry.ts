import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Dispara quando Aditivo.status vira APROVADO
 * - Cria nova ContratoVersao (numero_versao +1)
 * - Copia todos ContratoItems da versão origem
 * - Aplica qtd_consolidada do AditivoItem
 * - Recalcula contrato (total_contrato)
 * - Arquiva versão anterior
 * - Registra auditoria
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { event, data, old_data } = payload;

    if (event?.type !== 'update' || !data) {
      return Response.json({ skipped: true });
    }

    const { id: aditivo_id, status, contrato_versao_origem_id, obra_id } = data;
    const statusAnterior = old_data?.status || 'RASCUNHO';

    // Só processa se status muda para APROVADO
    if (statusAnterior === 'APROVADO' || status !== 'APROVADO') {
      return Response.json({ skipped: true });
    }

    console.log('[ADITIVO VERSIONAMENTO] Iniciando para aditivo:', aditivo_id);

    // 1. Buscar versão origem
    const versaoOrigem = await base44.asServiceRole.entities.ContratoVersao.filter(
      { id: contrato_versao_origem_id }
    );
    if (!versaoOrigem || versaoOrigem.length === 0) {
      throw new Error(`ContratoVersao origem não encontrada: ${contrato_versao_origem_id}`);
    }
    const origem = versaoOrigem[0];

    // 2. Buscar todos ContratoItems da origem
    const itemsOrigem = await base44.asServiceRole.entities.ContratoItem.filter({
      contrato_versao_id: contrato_versao_origem_id,
    });

    // 3. Buscar todos AditivoItems para mapear qtd_consolidada
    const aditivoItems = await base44.asServiceRole.entities.AditivoItem.filter({
      aditivo_id,
    });
    const mapaAditivo = {};
    aditivoItems.forEach(ai => {
      mapaAditivo[ai.contrato_item_id] = ai;
    });

    // 4. Criar nova ContratoVersao
    const novaVersao = await base44.asServiceRole.entities.ContratoVersao.create({
      obra_id,
      numero_versao: (origem.numero_versao || 0) + 1,
      status: 'ATIVA',
      data_inicio_vigencia: new Date().toISOString().split('T')[0],
      total_contrato: 0, // será recalculado abaixo
    });
    const novaVersaoId = novaVersao.id;

    console.log('[ADITIVO VERSIONAMENTO] Nova versão criada:', novaVersaoId);

    // 5. Copiar ContratoItems, aplicando qtd_consolidada do aditivo
    const novosTotalContrato = [];
    const copiasMutation = [];

    for (const item of itemsOrigem) {
      const adItem = mapaAditivo[item.id];
      
      // Se tem aditivo item, usa qtd_consolidada; senão mantém quantidade original
      const qtdNova = adItem?.qtd_consolidada ?? item.qtd_contrato;

      // Recalcular preco_total com nova quantidade
      const novoPrecoTotal = (qtdNova ?? 0) * (item.preco_unit_com_bdi ?? 0);
      novosTotalContrato.push(novoPrecoTotal);

      // Criar novo item na nova versão
      copiasMutation.push(
        base44.asServiceRole.entities.ContratoItem.create({
          contrato_versao_id: novaVersaoId,
          item_codigo: item.item_codigo,
          descricao: item.descricao,
          unidade: item.unidade,
          qtd_contrato: qtdNova,
          preco_unit_sem_bdi: item.preco_unit_sem_bdi,
          bdi_percent: item.bdi_percent,
          preco_unit_com_bdi: item.preco_unit_com_bdi,
          preco_total: novoPrecoTotal,
          parent_codigo: item.parent_codigo,
          ordem: item.ordem,
        })
      );
    }

    // Executar cópias em paralelo
    if (copiasMutation.length > 0) {
      await Promise.all(copiasMutation);
    }

    // 6. Calcular total_contrato da nova versão
    const totalContratoNovo = novosTotalContrato.reduce((a, b) => a + b, 0);

    // 7. Atualizar total da nova versão
    await base44.asServiceRole.entities.ContratoVersao.update(novaVersaoId, {
      total_contrato: parseFloat(totalContratoNovo.toFixed(2)),
    });

    console.log('[ADITIVO VERSIONAMENTO] Items copiados, total:', totalContratoNovo);

    // 8. Arquivar versão anterior e apontar futuras BMs para nova versão somente a partir da próxima criação
    await base44.asServiceRole.entities.ContratoVersao.update(
      contrato_versao_origem_id,
      { status: 'ARQUIVADA', bm_inicio_id: null }
    );

    console.log('[ADITIVO VERSIONAMENTO] Versão anterior arquivada');

    // 9. Registrar auditoria
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        obra_id,
        entidade: 'ContratoVersao',
        entidade_id: novaVersaoId,
        acao: 'create',
        dados_depois: {
          numero_versao: (origem.numero_versao || 0) + 1,
          status: 'ATIVA',
          total_contrato: totalContratoNovo,
          origin_from_aditivo: aditivo_id,
        },
        usuario_id: 'sistema',
        observacao: `Nova versão criada via Aditivo ${aditivo_id}`,
      });
    } catch (err) {
      console.log('Erro ao registrar auditoria:', err.message);
    }

    return Response.json({
      success: true,
      aditivo_id,
      novaVersaoId,
      totalItems: itemsOrigem.length,
      totalContratoNovo,
      fluxo: 'ContratoVersao origem ARQUIVADA -> Nova ContratoVersao ATIVA; novas BMs usarão a versão ativa via criarBM; BMs antigas mantêm vínculo com versão antiga.'
    });
  } catch (error) {
    console.error('[ADITIVO VERSIONAMENTO] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
/**
 * VALIDADOR: garante encadeamento SOLICITAÇÃO → COTAÇÃO → ORDEM DE COMPRA
 * 
 * Uso:
 *   await validarFluxoCotacao(base44, requisicaoId);
 *   await validarFluxoOrdemCompra(base44, requisicaoId, cotacaoId);
 */

import { erroSeguro } from './erroSeguradoResponse.ts';

/**
 * Valida que cotação pode ser criada a partir de requisição
 */
async function validarFluxoCotacao(base44, requisicaoId, obraId) {
  // 1. Verificar requisição existe
  const requisicoes = await base44.entities.RequisicaoCompra.filter({ id: requisicaoId });
  if (!requisicoes || requisicoes.length === 0) {
    throw erroSeguro('RECURSO_NAO_ENCONTRADO', 'Requisição não encontrada');
  }
  
  const requisicao = requisicoes[0];
  
  // 2. Verificar status permite cotação
  if (!['aberta', 'em_cotacao'].includes(requisicao.status)) {
    throw erroSeguro(
      'ESTADO_INVALIDO',
      `Requisição em status '${requisicao.status}' não permite novas cotações`
    );
  }
  
  // 3. Verificar obra
  if (requisicao.obra_id !== obraId) {
    throw erroSeguro(
      'OBRA_INVALIDA',
      'Requisição pertence a outra obra'
    );
  }
  
  return requisicao;
}

/**
 * Valida que OC pode ser criada a partir de cotação
 */
async function validarFluxoOrdemCompra(base44, requisicaoId, cotacaoId, obraId) {
  // 1. Validar requisição
  const requisicao = await validarFluxoCotacao(base44, requisicaoId, obraId);
  
  // 2. Verificar cotação existe e pertence a esta requisição
  const cotacoes = await base44.entities.CotacaoFornecedor.filter({
    id: cotacaoId,
    requisicao_id: requisicaoId
  });
  
  if (!cotacoes || cotacoes.length === 0) {
    throw erroSeguro(
      'RECURSO_NAO_ENCONTRADO',
      'Cotação não encontrada ou não pertence a esta requisição'
    );
  }
  
  const cotacao = cotacoes[0];
  
  // 3. Verificar status da cotação
  if (!['aberta', 'selecionada'].includes(cotacao.status)) {
    throw erroSeguro(
      'ESTADO_INVALIDO',
      `Cotação em status '${cotacao.status}' não pode gerar OC`
    );
  }
  
  // 4. Verificar que cotação não foi já usada
  if (cotacao.ordem_compra_id) {
    throw erroSeguro(
      'CONFLITO_DADOS',
      `Cotação já foi usada na OC ${cotacao.ordem_compra_id}`
    );
  }
  
  return { requisicao, cotacao };
}

/**
 * Atualiza status em cascata quando OC é criada
 */
async function atualizarStatusEmCascata(base44, requisicaoId, cotacaoId, novaOC) {
  try {
    // 1. Marcar cotação como selecionada + vinculada à OC
    await base44.asServiceRole.entities.CotacaoFornecedor.update(cotacaoId, {
      status: 'selecionada',
      ordem_compra_id: novaOC.id,
      selecionada_para_oc: true
    });
    
    // 2. Atualizar requisição para status 'comprada'
    const requisicoes = await base44.entities.RequisicaoCompra.filter({ id: requisicaoId });
    if (requisicoes && requisicoes.length > 0) {
      const req = requisicoes[0];
      req.status = 'comprada';
      req.itens = req.itens || [];
      req.itens = req.itens.map(item => ({
        ...item,
        ordem_compra_id: novaOC.id,
        status: 'em_compra'
      }));
      
      await base44.asServiceRole.entities.RequisicaoCompra.update(requisicaoId, req);
    }
    
    return true;
  } catch (error) {
    console.error('[cascata] Erro ao atualizar status:', error.message);
    // Não falhar a operação principal se cascata falhar
    return false;
  }
}

/**
 * Valida integridade do fluxo (para auditoria)
 */
async function validarIntegridadeFluxo(base44, ordemCompraId) {
  const ocs = await base44.entities.OrdemCompra.filter({ id: ordemCompraId });
  if (!ocs || ocs.length === 0) return { ok: false, erro: 'OC não encontrada' };
  
  const oc = ocs[0];
  
  // Verificar que requisição e cotação existem
  const requisicoes = await base44.entities.RequisicaoCompra.filter({ id: oc.requisicao_id });
  if (!requisicoes || requisicoes.length === 0) {
    return { ok: false, erro: 'Requisição referenciada não existe' };
  }
  
  const cotacoes = await base44.entities.CotacaoFornecedor.filter({ id: oc.cotacao_id });
  if (!cotacoes || cotacoes.length === 0) {
    return { ok: false, erro: 'Cotação referenciada não existe' };
  }
  
  // Verificar que cotação também referencia esta requisição
  if (cotacoes[0].requisicao_id !== oc.requisicao_id) {
    return { ok: false, erro: 'Cotação não pertence a esta requisição' };
  }
  
  return { ok: true };
}

export {
  validarFluxoCotacao,
  validarFluxoOrdemCompra,
  atualizarStatusEmCascata,
  validarIntegridadeFluxo
};
/**
 * VALIDADOR MEDIÇÃO: estrutura e regras
 * 
 * Uso:
 *   validarMedicao(medicao)
 *   await validarAprovacao(base44, medicao)
 *   await validarFaturamento(base44, medicao)
 */

import { erroSeguro } from './erroSeguradoResponse.ts';

/**
 * Valida estrutura de medição
 */
function validarMedicao(medicao) {
  if (!medicao) {
    throw erroSeguro('RECURSO_NAO_ENCONTRADO', 'Medição não encontrada');
  }
  
  if (!medicao.obra_id) {
    throw erroSeguro('OBRA_REQUIRED', 'Medição sem obra é inválida');
  }
  
  if (!medicao.numero) {
    throw erroSeguro('VALIDACAO', 'Número de medição obrigatório');
  }
  
  if (!medicao.responsavel_email) {
    throw erroSeguro('VALIDACAO', 'Responsável obrigatório');
  }
  
  return true;
}

/**
 * Valida que medição pode ser enviada
 */
function validarEnvio(medicao, itens) {
  validarMedicao(medicao);
  
  if (medicao.status !== 'rascunho') {
    throw erroSeguro(
      'ESTADO_INVALIDO',
      `Medição em status '${medicao.status}' não pode ser enviada`
    );
  }
  
  if (!itens || itens.length === 0) {
    throw erroSeguro('VALIDACAO', 'Medição sem itens não pode ser enviada');
  }
  
  // Validar itens
  for (const item of itens) {
    if (!item.descricao || item.quantidade_periodo === undefined) {
      throw erroSeguro('VALIDACAO', 'Item incompleto (falta descrição ou quantidade)');
    }
  }
  
  return true;
}

/**
 * Valida que medição pode ser aprovada
 */
function validarAprovacao(medicao) {
  validarMedicao(medicao);
  
  if (medicao.status !== 'enviada') {
    throw erroSeguro(
      'ESTADO_INVALIDO',
      `Apenas medições em status 'enviada' podem ser aprovadas. Status atual: ${medicao.status}`
    );
  }
  
  return true;
}

/**
 * Valida que medição aprovada pode gerar faturamento
 */
function validarFaturamento(medicao) {
  validarMedicao(medicao);
  
  if (medicao.status !== 'aprovada') {
    throw erroSeguro(
      'ESTADO_INVALIDO',
      `Apenas medições aprovadas podem gerar faturamento. Status: ${medicao.status}`
    );
  }
  
  if (medicao.valor_total_realizado <= 0) {
    throw erroSeguro('VALIDACAO', 'Medição sem valor não pode ser faturada');
  }
  
  if (medicao.receita_id) {
    throw erroSeguro('CONFLITO_DADOS', 'Medição já possui receita vinculada');
  }
  
  return true;
}

/**
 * Calcula totais de medição
 */
function calcularTotaisMedicao(itens) {
  let valor_total = 0;
  let qtd_total = 0;
  
  if (!itens) return { valor_total, qtd_total };
  
  for (const item of itens) {
    qtd_total += item.quantidade_periodo || 0;
    valor_total += (item.quantidade_periodo || 0) * (item.valor_unitario || 0);
  }
  
  return { valor_total, qtd_total };
}

/**
 * Calcula retenção
 */
function calcularRetencao(valor_bruto, percentual_retencao) {
  const retencao = valor_bruto * (percentual_retencao / 100);
  return {
    retencao,
    liquido: valor_bruto - retencao
  };
}

export {
  validarMedicao,
  validarEnvio,
  validarAprovacao,
  validarFaturamento,
  calcularTotaisMedicao,
  calcularRetencao
};
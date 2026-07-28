/**
 * VALIDADOR DRE: regras de lançamento de custo e receita
 */

import { erroSeguro } from './erroSeguradoResponse.ts';

/**
 * Valida lançamento de custo
 */
function validarLancamentoCusto(lancamento) {
  if (!lancamento.obra_id) {
    throw erroSeguro('OBRA_REQUIRED', 'Obra obrigatória');
  }
  
  if (!lancamento.origem_tipo) {
    throw erroSeguro('VALIDACAO', 'Tipo de origem obrigatório');
  }
  
  if (!lancamento.valor || lancamento.valor <= 0) {
    throw erroSeguro('VALIDACAO', 'Valor deve ser positivo');
  }
  
  return true;
}

/**
 * Valida lançamento de receita
 */
function validarLancamentoReceita(lancamento) {
  if (!lancamento.obra_id) {
    throw erroSeguro('OBRA_REQUIRED', 'Obra obrigatória');
  }
  
  if (!lancamento.origem_tipo) {
    throw erroSeguro('VALIDACAO', 'Tipo de origem obrigatório');
  }
  
  if (!lancamento.valor_bruto || lancamento.valor_bruto <= 0) {
    throw erroSeguro('VALIDACAO', 'Valor bruto deve ser positivo');
  }
  
  if (lancamento.retencoes_percentual < 0 || lancamento.retencoes_percentual > 100) {
    throw erroSeguro('VALIDACAO', 'Retenção deve estar entre 0 e 100%');
  }
  
  return true;
}

/**
 * Calcula mês de referência (primeiro dia do mês)
 */
function calcularMesReferencia(data) {
  const d = new Date(data);
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

export {
  validarLancamentoCusto,
  validarLancamentoReceita,
  calcularMesReferencia
};
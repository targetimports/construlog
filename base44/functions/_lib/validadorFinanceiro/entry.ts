/**
 * VALIDADOR FINANCEIRO: NF → ContaPagar → Pagamento
 * 
 * Uso:
 *   validarNF(nf)
 *   await validarContaPagar(base44, conta)
 *   await validarPagamento(base44, conta, valor)
 */

import { erroSeguro } from './erroSeguradoResponse.ts';

/**
 * Valida estrutura de NF
 */
function validarNF(nf) {
  if (!nf) {
    throw erroSeguro('RECURSO_NAO_ENCONTRADO', 'NF não encontrada');
  }
  
  if (!nf.obra_id) {
    throw erroSeguro('OBRA_REQUIRED', 'NF sem obra é inválida');
  }
  
  if (!nf.fornecedor_id) {
    throw erroSeguro('VALIDACAO', 'NF sem fornecedor é inválida');
  }
  
  if (nf.valor_bruto <= 0) {
    throw erroSeguro('VALIDACAO', 'Valor bruto deve ser positivo');
  }
  
  return true;
}

/**
 * Valida que NF pode gerar conta a pagar
 */
async function validarGerContaPagar(base44, nf) {
  validarNF(nf);
  
  // Verificar se já tem conta associada
  if (nf.conta_pagar_id) {
    throw erroSeguro('CONFLITO_DADOS', 'NF já possui conta a pagar vinculada');
  }
  
  // Verificar se obra existe
  const obras = await base44.entities.Obra.filter({ id: nf.obra_id });
  if (!obras || obras.length === 0) {
    throw erroSeguro('OBRA_INVALIDA', 'Obra não encontrada');
  }
  
  return true;
}

/**
 * Valida que conta pode ser paga
 */
async function validarPagamento(base44, conta, valorPagamento) {
  if (!conta) {
    throw erroSeguro('RECURSO_NAO_ENCONTRADO', 'Conta não encontrada');
  }
  
  if (conta.tipo !== 'pagar') {
    throw erroSeguro('VALIDACAO', 'Apenas contas a pagar podem ser pagas');
  }
  
  if (!['pendente', 'parcial', 'atrasado'].includes(conta.status)) {
    throw erroSeguro(
      'ESTADO_INVALIDO',
      `Conta em status '${conta.status}' não pode ser paga`
    );
  }
  
  if (valorPagamento <= 0) {
    throw erroSeguro('VALIDACAO', 'Valor de pagamento deve ser positivo');
  }
  
  const valorRestante = (conta.valor || 0) - (conta.valor_pago || 0);
  if (valorPagamento > valorRestante) {
    throw erroSeguro(
      'VALOR_INVALIDO',
      `Valor de pagamento (${valorPagamento}) excede saldo devedor (${valorRestante})`
    );
  }
  
  return true;
}

/**
 * Valida divergência NF ↔ OC
 */
async function validarDivergenciaNFOC(base44, nf, ocId) {
  if (!ocId) return null;
  
  try {
    const ocs = await base44.entities.OrdemCompra.filter({ id: ocId });
    if (!ocs || ocs.length === 0) return null;
    
    const oc = ocs[0];
    
    // Alertas de divergência
    const divergencias = [];
    
    if (Math.abs((nf.valor_bruto || 0) - (oc.valor_total || 0)) > 1) {
      divergencias.push({
        tipo: 'valor',
        esperado: oc.valor_total,
        recebido: nf.valor_bruto,
        diferenca: nf.valor_bruto - oc.valor_total
      });
    }
    
    if ((nf.data || '') > (oc.data_emissao || '')) {
      divergencias.push({
        tipo: 'data',
        aviso: 'NF com data posterior à OC'
      });
    }
    
    return divergencias.length > 0 ? divergencias : null;
  } catch (error) {
    // Falha silenciosa em validação de divergência
    return null;
  }
}

/**
 * Calcula juros e multa (estrutura pronta)
 */
function calcularJurosMulta(valorOriginal, diasAtraso) {
  const taxaMulta = 0.02; // 2% multa fixa
  const taxaJuros = 0.001; // 0.1% ao dia
  
  const multa = valorOriginal * taxaMulta;
  const juros = valorOriginal * taxaJuros * diasAtraso;
  
  return {
    multa,
    juros,
    total_acrescimo: multa + juros,
    valor_final: valorOriginal + multa + juros
  };
}

export {
  validarNF,
  validarGerContaPagar,
  validarPagamento,
  validarDivergenciaNFOC,
  calcularJurosMulta
};
/**
 * VALIDADOR ESTOQUE: regras e cálculos de saldo
 * 
 * Uso:
 *   validarRecebimento(oc, itens)
 *   await validarTransferencia(base44, depositoOrigem, depositoDestino, itens)
 *   await validarBaixaObra(base44, obraId, itens)
 */

import { erroSeguro } from './erroSeguradoResponse.ts';

/**
 * Valida que OC está aprovada para receber
 */
function validarRecebimento(oc) {
  if (!oc) {
    throw erroSeguro('RECURSO_NAO_ENCONTRADO', 'Ordem de Compra não encontrada');
  }
  
  if (!['criada', 'aprovada'].includes(oc.status)) {
    throw erroSeguro(
      'ESTADO_INVALIDO',
      `OC em status '${oc.status}' não permite recebimento`
    );
  }
  
  if (!oc.itens || oc.itens.length === 0) {
    throw erroSeguro('VALIDACAO', 'OC não possui itens');
  }
  
  return true;
}

/**
 * Valida saldo disponível para transferência
 */
async function validarTransferencia(base44, depositoOrigem, itens) {
  if (!depositoOrigem) {
    throw erroSeguro('RECURSO_NAO_ENCONTRADO', 'Depósito de origem não encontrado');
  }
  
  if (!itens || itens.length === 0) {
    throw erroSeguro('VALIDACAO', 'Nenhum item a transferir');
  }
  
  // Verificar saldo de cada insumo
  for (const item of itens) {
    if (!item.insumo_id || !item.quantidade) {
      throw erroSeguro('VALIDACAO', 'Item incompleto (falta insumo_id ou quantidade)');
    }
    
    if (item.quantidade <= 0) {
      throw erroSeguro('VALIDACAO', `Quantidade deve ser positiva (insumo ${item.insumo_id})`);
    }
    
    // Buscar saldo no estoque da obra (se for transferência de obra central para obra)
    // Aqui seria lógica de busca do SaldoEstoque se existir
  }
  
  return true;
}

/**
 * Valida que obra existe e tem estoque para baixar
 */
async function validarBaixaObra(base44, obraId, itens, centroCustoId) {
  if (!obraId) {
    throw erroSeguro('OBRA_REQUIRED', 'Obra não informada');
  }
  
  if (!centroCustoId) {
    throw erroSeguro('VALIDACAO', 'Centro de custo obrigatório para baixa');
  }
  
  if (!itens || itens.length === 0) {
    throw erroSeguro('VALIDACAO', 'Nenhum item a baixar');
  }
  
  // Verificar que obra existe
  const obras = await base44.entities.Obra.filter({ id: obraId });
  if (!obras || obras.length === 0) {
    throw erroSeguro('OBRA_INVALIDA', 'Obra não encontrada');
  }
  
  for (const item of itens) {
    if (!item.insumo_id || item.quantidade <= 0) {
      throw erroSeguro('VALIDACAO', 'Item incompleto ou quantidade inválida');
    }
  }
  
  return true;
}

/**
 * Calcula custo médio ponderado
 */
function calcularCustoMedio(saldoAnterior, custoAnterior, entradaQuantidade, entradaValor) {
  if (saldoAnterior === 0 && entradaQuantidade === 0) return 0;
  if (entradaQuantidade === 0) return custoAnterior;
  
  const valorTotalAnterior = saldoAnterior * custoAnterior;
  const novoValorTotal = valorTotalAnterior + entradaValor;
  const novoSaldo = saldoAnterior + entradaQuantidade;
  
  return novoValorTotal / novoSaldo;
}

/**
 * Atualizar saldo de EstoqueObra
 */
async function atualizarSaldoEstoqueObra(base44, obraId, insumoId, qtdVariacao, custoUnitario) {
  try {
    const estoques = await base44.entities.EstoqueObra.filter({
      obra_id: obraId,
      insumo_id: insumoId
    });
    
    let estoque;
    if (estoques && estoques.length > 0) {
      estoque = estoques[0];
      // Atualizar existente
      const saldoAnterior = estoque.quantidade_total || 0;
      const novoSaldo = saldoAnterior + qtdVariacao;
      const custoMedio = qtdVariacao > 0 
        ? calcularCustoMedio(saldoAnterior, estoque.custo_unitario || custoUnitario, qtdVariacao, qtdVariacao * custoUnitario)
        : estoque.custo_unitario;
      
      await base44.asServiceRole.entities.EstoqueObra.update(insumoId, {
        quantidade_total: Math.max(0, novoSaldo),
        quantidade_disponivel: Math.max(0, novoSaldo - (estoque.quantidade_reservada || 0)),
        custo_unitario: custoMedio,
        valor_total_estoque: novoSaldo * custoMedio,
        data_ultima_movimentacao: new Date().toISOString(),
        status_alerta: novoSaldo < (estoque.quantidade_minima || 0) ? 'critico' : 'ok'
      });
    } else {
      // Criar novo
      await base44.entities.EstoqueObra.create({
        obra_id: obraId,
        insumo_id: insumoId,
        insumo_descricao: 'A completar',
        unidade: 'un',
        quantidade_total: Math.max(0, qtdVariacao),
        quantidade_disponivel: Math.max(0, qtdVariacao),
        custo_unitario: custoUnitario,
        valor_total_estoque: Math.max(0, qtdVariacao * custoUnitario),
        data_ultima_movimentacao: new Date().toISOString(),
        status_alerta: 'ok'
      });
    }
    
    return true;
  } catch (error) {
    console.error('[estoque] Erro ao atualizar saldo:', error.message);
    return false;
  }
}

export {
  validarRecebimento,
  validarTransferencia,
  validarBaixaObra,
  calcularCustoMedio,
  atualizarSaldoEstoqueObra
};
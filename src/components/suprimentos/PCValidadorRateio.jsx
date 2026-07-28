/**
 * Validador de Rateio para Pedido Multi-Obra
 * Garante que:
 * - Todos os itens com rateio têm soma = quantidade total
 * - Não há divergências entre quantidade pedida e rateada
 */

export const validarRateioPorItem = (item) => {
  if (!item.material_id) return { valido: true, erro: null };
  if (!item.rateio_obras || item.rateio_obras.length === 0) {
    return { 
      valido: false, 
      erro: `${item.descricao || 'Item'} não possui rateio definido` 
    };
  }

  const totalRateado = item.rateio_obras.reduce((sum, r) => sum + (r.quantidade || 0), 0);
  const qtdPedida = item.quantidade_pedida || 0;

  if (Math.abs(qtdPedida - totalRateado) > 0.01) {
    return {
      valido: false,
      erro: `${item.descricao || 'Item'}: rateio incompleto (${totalRateado.toFixed(3)} de ${qtdPedida})`,
      divergencia: Math.abs(qtdPedida - totalRateado),
    };
  }

  return { valido: true, erro: null };
};

export const validarRateioPedido = (itens) => {
  const erros = [];
  const itemsComRateio = itens.filter(it => it.material_id);

  itemsComRateio.forEach((item) => {
    const resultado = validarRateioPorItem(item);
    if (!resultado.valido) {
      erros.push(resultado.erro);
    }
  });

  return {
    valido: erros.length === 0,
    erros,
    totalItensRateados: itemsComRateio.length,
  };
};

export const calcularTotalRateioPorObra = (itens, obraId) => {
  return itens.reduce((total, item) => {
    if (!item.rateio_obras) return total;
    const rateioObra = item.rateio_obras.find(r => r.obra_id === obraId);
    if (!rateioObra) return total;
    return total + (rateioObra.quantidade * (item.preco_unitario || 0));
  }, 0);
};
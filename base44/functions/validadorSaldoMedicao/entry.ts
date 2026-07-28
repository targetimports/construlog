import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Validador: bloqueia medição que ultrapassa saldo físico ou financeiro
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { item_orcamento_id, quantidade_medida, obra_id } = await req.json();

    if (!item_orcamento_id || !quantidade_medida || !obra_id) {
      return Response.json({ error: 'Campos obrigatórios faltando' }, { status: 422 });
    }

    // Buscar item do orçamento
    const item = await base44.entities.ItemOrcamentoObra.read(item_orcamento_id);
    if (!item || item.obra_id !== obra_id) {
      return Response.json({ error: 'Item não encontrado' }, { status: 404 });
    }

    // Calcular saldos
    const saldo_quantidade = item.quantidade_orcada - item.quantidade_medida_acumulada;
    const saldo_valor = item.valor_total - item.valor_medido_acumulado;

    // Validar quantidade
    if (quantidade_medida > saldo_quantidade) {
      return Response.json({ 
        ok: false,
        bloqueado: true,
        motivo: 'QUANTIDADE_EXCEDIDA',
        quantidade_orcada: item.quantidade_orcada,
        quantidade_medida_acumulada: item.quantidade_medida_acumulada,
        saldo_quantidade,
        quantidade_solicitada: quantidade_medida
      }, { status: 422 });
    }

    // Calcular valor proposto
    const valor_proposto = quantidade_medida * item.valor_unitario;

    // Validar valor
    if (valor_proposto > saldo_valor) {
      return Response.json({ 
        ok: false,
        bloqueado: true,
        motivo: 'VALOR_EXCEDIDO',
        valor_orcado: item.valor_total,
        valor_medido_acumulado: item.valor_medido_acumulado,
        saldo_valor,
        valor_proposto
      }, { status: 422 });
    }

    return Response.json({ 
      ok: true,
      bloqueado: false,
      saldo_quantidade,
      saldo_valor,
      valor_proposto
    });

  } catch (error) {
    console.error('Validador saldo erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
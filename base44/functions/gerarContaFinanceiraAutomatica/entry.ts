import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Gera ContaFinanceira automaticamente ao aprovar medição ou ordem de compra
 * Payload: { tipo: 'medicao' | 'ordem_compra', origem_id: string }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { tipo, origem_id } = await req.json();

    if (!tipo || !origem_id) {
      return Response.json({ error: 'tipo e origem_id são obrigatórios' }, { status: 400 });
    }

    let conta = null;

    if (tipo === 'medicao') {
      // Buscar medição
      const medicoes = await base44.asServiceRole.entities.Medicao.filter({ id: origem_id });
      const medicao = medicoes[0];

      if (!medicao) {
        return Response.json({ error: 'Medição não encontrada' }, { status: 404 });
      }

      // Verificar se já existe conta para esta medição
      const contasExistentes = await base44.asServiceRole.entities.ContaFinanceira.filter({ 
        medicao_id: origem_id 
      });

      if (contasExistentes.length > 0) {
        return Response.json({ 
          message: 'Conta já existe para esta medição',
          conta: contasExistentes[0]
        });
      }

      // Criar conta a receber
      conta = await base44.asServiceRole.entities.ContaFinanceira.create({
        tipo: 'receber',
        descricao: `Medição ${medicao.numero || '#' + medicao.id.slice(0, 8)} - ${medicao.descricao || 'Obra'}`,
        valor: medicao.valor_total || 0,
        data_vencimento: medicao.data_vencimento || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pendente',
        obra_id: medicao.obra_id,
        categoria: 'medicao',
        medicao_id: origem_id,
        observacao: `Ref: Medição do período de ${new Date(medicao.data_inicio).toLocaleDateString('pt-BR')} a ${new Date(medicao.data_fim).toLocaleDateString('pt-BR')}`
      });
    } 
    else if (tipo === 'ordem_compra') {
      // Buscar ordem de compra
      const ordens = await base44.asServiceRole.entities.OrdemCompra.filter({ id: origem_id });
      const ordem = ordens[0];

      if (!ordem) {
        return Response.json({ error: 'Ordem de compra não encontrada' }, { status: 404 });
      }

      // Verificar se já existe conta
      const contasExistentes = await base44.asServiceRole.entities.ContaFinanceira.filter({ 
        nota_fiscal: `OC-${ordem.numero}` 
      });

      if (contasExistentes.length > 0) {
        return Response.json({ 
          message: 'Conta já existe para esta ordem',
          conta: contasExistentes[0]
        });
      }

      // Criar conta a pagar
      conta = await base44.asServiceRole.entities.ContaFinanceira.create({
        tipo: 'pagar',
        descricao: `Pagamento OC #${ordem.numero} - ${ordem.descricao}`,
        valor: ordem.valor_total || 0,
        data_vencimento: ordem.data_prevista_entrega || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pendente',
        obra_id: ordem.obra_id,
        categoria: 'material',
        fornecedor_cliente: ordem.fornecedor_nome,
        nota_fiscal: `OC-${ordem.numero}`,
        observacao: `Ref: Ordem de Compra #${ordem.numero}`
      });
    } else {
      return Response.json({ error: 'Tipo inválido. Use "medicao" ou "ordem_compra"' }, { status: 400 });
    }

    return Response.json({ 
      success: true,
      conta,
      message: 'Conta financeira gerada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao gerar conta financeira:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tipo, acao } = body;

    if (tipo === 'medicao') {
      // Busca medicões pendentes de lançamento
      const medicoes = await base44.entities.Medicao.filter({ status: 'aprovada' });
      
      for (const medicao of medicoes) {
        // Cria conta financeira automaticamente
        await base44.entities.ContaFinanceira.create({
          tipo: 'receber',
          descricao: `Faturamento - Medição ${medicao.numero}`,
          valor: medicao.valor_total,
          data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'pendente',
          categoria: 'medicao',
          medicao_id: medicao.id,
          obra_id: medicao.obra_id
        });
      }

      return Response.json({ 
        success: true, 
        message: `${medicoes.length} lançamentos criados automaticamente` 
      });
    }

    if (tipo === 'ordem_compra') {
      // Busca ordens de compra recebidas
      const ordens = await base44.entities.OrdemCompra.filter({ status: 'recebida' });
      
      for (const ordem of ordens) {
        await base44.entities.ContaFinanceira.create({
          tipo: 'pagar',
          descricao: `Pagamento - OC ${ordem.numero}`,
          valor: ordem.valor_total,
          data_vencimento: ordem.data_vencimento || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'pendente',
          categoria: 'material',
          fornecedor_cliente: ordem.fornecedor_nome,
          nota_fiscal: ordem.nota_fiscal,
          obra_id: ordem.obra_id
        });
      }

      return Response.json({ 
        success: true, 
        message: `${ordens.length} contas a pagar criadas` 
      });
    }

    return Response.json({ error: 'Tipo de automação inválido' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
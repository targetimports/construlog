import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { nota_fiscal_id } = payload;

    if (!nota_fiscal_id) {
      return Response.json({ error: 'nota_fiscal_id obrigatório' }, { status: 400 });
    }

    // Buscar NF e itens
    const nf = await base44.asServiceRole.entities.NotaFiscal.get(nota_fiscal_id);
    if (!nf) {
      return Response.json({ error: 'NF não encontrada' }, { status: 404 });
    }

    const itens = await base44.asServiceRole.entities.NotaFiscalItem.filter({
      nota_fiscal_id
    });

    const entradas = [];
    const erros = [];

    for (const item of itens) {
      // Só processar MATERIAL
      if (item.categoria !== 'MATERIAL') continue;

      // Exigir produto_id
      if (!item.produto_id) {
        erros.push(`Item "${item.descricao}" sem produto_id mapeado`);
        continue;
      }

      try {
        // Criar MovimentacaoEstoque de ENTRADA
        const mov = await base44.asServiceRole.entities.MovimentacaoEstoque.create({
          tipo: 'ENTRADA',
          produto_id: item.produto_id,
          obra_id: nf.obra_id,
          quantidade: item.quantidade,
          unidade: item.unidade || 'un',
          valor_unitario: item.valor_unitario,
          valor_total: item.valor_total,
          descricao: `NF ${nf.numero}/${nf.serie} - ${nf.fornecedor_nome}`,
          referencia_tipo: 'NotaFiscalItem',
          referencia_id: item.id,
          nf_id: nf.id,
          registrado_por: user.email
        });

        entradas.push({
          item_id: item.id,
          movimentacao_id: mov.id,
          produto_id: item.produto_id,
          quantidade: item.quantidade
        });
      } catch (err) {
        erros.push(`Erro ao criar entrada para "${item.descricao}": ${err.message}`);
      }
    }

    // Log auditoria
    await base44.asServiceRole.entities.AuditLogNF.create({
      nota_fiscal_id,
      acao: 'ESTOQUE_PROCESSADO',
      usuario_email: user.email,
      descricao: `${entradas.length} entradas criadas. ${erros.length} erros.`
    });

    return Response.json({
      message: 'Entradas de estoque criadas',
      entradas,
      erros: erros.length > 0 ? erros : null
    });
  } catch (error) {
    console.error('❌ Erro ao criar entrada estoque:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
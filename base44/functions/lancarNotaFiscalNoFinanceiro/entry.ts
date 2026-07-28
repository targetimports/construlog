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

    // Buscar NF
    const nf = await base44.asServiceRole.entities.NotaFiscal.get(nota_fiscal_id);
    if (!nf) {
      return Response.json({ error: 'NF não encontrada' }, { status: 404 });
    }

    if (nf.status !== 'APROVADA') {
      return Response.json({ error: 'NF deve estar em status APROVADA' }, { status: 400 });
    }

    // Criar ContaPagar ou LancamentoFinanceiro
    let lancamento_id = null;
    try {
      const lancamento = await base44.asServiceRole.entities.ContaPagar.create({
        obra_id: nf.obra_id,
        descricao: `NF ${nf.numero}/${nf.serie} - ${nf.fornecedor_nome}`,
        valor: nf.valor_total,
        fornecedor_nome: nf.fornecedor_nome,
        fornecedor_cnpj: nf.fornecedor_cnpj,
        data_vencimento: nf.data_emissao,
        status: 'ABERTO',
        categoria: 'fornecedores',
        referencia_tipo: 'NotaFiscal',
        referencia_id: nf.id
      });
      lancamento_id = lancamento.id;
    } catch (err) {
      console.warn('⚠️ Erro ao criar ContaPagar, tentando LancamentoFinanceiro:', err.message);
      // Fallback: criar lançamento genérico
      const lancamento = await base44.asServiceRole.entities.LancamentoFinanceiro.create({
        obra_id: nf.obra_id,
        descricao: `NF ${nf.numero}/${nf.serie} - ${nf.fornecedor_nome}`,
        tipo: 'despesa',
        valor: nf.valor_total,
        data: nf.data_emissao,
        categoria: 'fornecedores'
      });
      lancamento_id = lancamento.id;
    }

    // Atualizar NF
    await base44.asServiceRole.entities.NotaFiscal.update(nota_fiscal_id, {
      status: 'LANCADA',
      lancamento_financeiro_id: lancamento_id,
      data_lancamento: new Date().toISOString(),
      revisada_por: user.email
    });

    // Auditoria
    await base44.asServiceRole.entities.AuditLogNF.create({
      nota_fiscal_id,
      acao: 'LANCADA',
      usuario_email: user.email,
      descricao: `Lançado no financeiro (ID: ${lancamento_id})`
    });

    return Response.json({
      message: 'NF aprovada e lançada no financeiro',
      lancamento_id
    });
  } catch (error) {
    console.error('❌ Erro ao lançar NF:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
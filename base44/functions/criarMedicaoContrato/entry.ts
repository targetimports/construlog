import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contrato_id, data_medicao, numero, titulo, descricao, periodo_de, periodo_ate, valor_bruto, retencoes, observacoes } = await req.json();

    if (!contrato_id) return Response.json({ error: 'contrato_id obrigatório' }, { status: 400 });
    if (valor_bruto === undefined || valor_bruto < 0) return Response.json({ error: 'valor_bruto obrigatório e >= 0' }, { status: 400 });

    // Carregar contrato para herdar obra_id, fornecedor_id, categoria_id
    const contratos = await base44.entities.Contrato.filter({ id: contrato_id });
    if (contratos.length === 0) return Response.json({ error: 'Contrato não encontrado' }, { status: 404 });

    const contrato = contratos[0];
    const obra_id = contrato.obra_id;
    const fornecedor_id = contrato.fornecedor_id;

    // Calcular retenções
    let retencoesList = [];
    if (retencoes && retencoes.length > 0) {
      retencoesList = retencoes;
    } else if (contrato.retencoes_padrao && contrato.retencoes_padrao.length > 0) {
      // Aplicar padrão do contrato
      retencoesList = contrato.retencoes_padrao.map(ret => ({
        tipo: ret.tipo,
        percentual: ret.percentual,
        valor: (valor_bruto * ret.percentual) / 100
      }));
    }

    // Calcular valor_liquido
    const valorRetencoes = retencoesList.reduce((sum, r) => sum + (r.valor || 0), 0);
    const valor_liquido = valor_bruto - valorRetencoes;

    const medicao = await base44.entities.MedicaoContrato.create({
      contrato_id,
      obra_id,
      fornecedor_id,
      data_medicao: data_medicao || new Date().toISOString().split('T')[0],
      numero: numero || '',
      titulo: titulo || '',
      descricao: descricao || '',
      valor_total: valor_bruto,
      percentual_acumulado: 0,
      status: 'rascunho',
      observacoes: observacoes || '',
      periodo_de: periodo_de || null,
      periodo_ate: periodo_ate || null,
      valor_bruto,
      retencoes: retencoesList,
      valor_liquido: valor_liquido
    });

    // Auditoria
    await base44.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'criar',
      modulo: 'contratos',
      entidade: 'MedicaoContrato',
      entidade_id: medicao.id,
      dados_novos: medicao,
      detalhes: `Medição criada: ${titulo || numero}`,
      sucesso: true
    });

    return Response.json({ ok: true, medicao_id: medicao.id, medicao });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
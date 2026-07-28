import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * IA Preencher BM - Assistente de Medições
 * 
 * Entrada: arquivo PDF/imagem/texto do boletim OU texto digitado
 * Saída: sugestões de qtd_periodo_input por item_codigo
 * 
 * Nunca salva automaticamente - apenas sugere.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bm_id, contrato_versao_id, file_urls = [], texto_digitado = '' } = await req.json();

    if (!bm_id || !contrato_versao_id) {
      return Response.json({ error: 'bm_id e contrato_versao_id obrigatórios' }, { status: 400 });
    }

    // Buscar BM e items
    const bm = await base44.entities.BM.filter({ id: bm_id });
    if (!bm || bm.length === 0) {
      return Response.json({ error: 'BM não encontrada' }, { status: 404 });
    }

    const contratoItems = await base44.entities.ContratoItem.filter({
      contrato_versao_id,
    });

    if (!contratoItems || contratoItems.length === 0) {
      return Response.json({ error: 'Nenhum item de contrato encontrado' }, { status: 404 });
    }

    // Construir contexto para IA
    const itensContexto = contratoItems
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
      .map(ci => ({
        item_codigo: ci.item_codigo,
        descricao: ci.descricao,
        unidade: ci.unidade,
        qtd_contrato: ci.qtd_contrato,
      }));

    // Montar prompt
    let prompt = `Você é um assistente especializado em Boletins de Medição (BM) para construção.

Analise o documento/texto fornecido e extraia as quantidades medidas para cada item.

ITENS DO CONTRATO:
${JSON.stringify(itensContexto, null, 2)}

${file_urls.length > 0 ? 'Analise as imagens/documentos anexados.' : ''}
${texto_digitado ? `Texto digitado pelo usuário:\n${texto_digitado}` : ''}

Retorne um JSON com array "sugestoes" onde cada item tem:
- item_codigo: string (ex: "2.3")
- qtd_sugerida: number (quantidade para o período)
- confianca: number 0-100 (quanto você tem certeza dessa sugestão)
- justificativa: string (motivo da sugestão)

Se não conseguir extrair algum item, omita-o da resposta.
Retorne APENAS o JSON, sem explicação adicional.`;

    // Chamar IA via InvokeLLM
    const resultado = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: file_urls.length > 0 ? file_urls : undefined,
      add_context_from_internet: false,
      response_json_schema: {
        type: 'object',
        properties: {
          sugestoes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item_codigo: { type: 'string' },
                qtd_sugerida: { type: 'number' },
                confianca: { type: 'number' },
                justificativa: { type: 'string' },
              },
            },
          },
        },
      },
    });

    // Buscar BM items atuais para comparação
    const bmItems = await base44.entities.BMItem.filter({ bm_id });
    const mapaAtual = {};
    bmItems.forEach(bmi => {
      const ci = contratoItems.find(c => c.id === bmi.contrato_item_id);
      if (ci) {
        mapaAtual[ci.item_codigo] = bmi.qtd_periodo_input || 0;
      }
    });

    // Enriquecer sugestões com diff
    const sugestoesComDiff = (resultado.sugestoes || []).map(s => ({
      ...s,
      qtd_atual: mapaAtual[s.item_codigo] || 0,
      diff: (s.qtd_sugerida || 0) - (mapaAtual[s.item_codigo] || 0),
    }));

    return Response.json({
      success: true,
      bm_id,
      sugestoes: sugestoesComDiff,
      total_sugestoes: sugestoesComDiff.length,
    });
  } catch (error) {
    console.error('[iaPreencherBMassistente] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
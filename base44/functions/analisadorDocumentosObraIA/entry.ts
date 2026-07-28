import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obraId, documentoUrl, tipoDocumento } = await req.json();

    if (!obraId || !documentoUrl) {
      return Response.json({ error: 'obraId e documentoUrl são obrigatórios' }, { status: 400 });
    }

    const tiposValidos = ['contrato', 'planta', 'especificacao_tecnica', 'aditivo', 'outro'];
    const tipo = tiposValidos.includes(tipoDocumento) ? tipoDocumento : 'outro';

    const prompts = {
      contrato: `Você é um especialista jurídico em construção civil. Analise este contrato e extraia:

1. CLÁUSULAS CRÍTICAS (escopo, prazos, responsabilidades, garantias)
2. CONFLITOS DETECTADOS (contradições internas, ambiguidades)
3. RISCOS LEGAIS (cláusulas potencialmente problemáticas)
4. DATAS E PRAZOS IMPORTANTES
5. PENALIDADES E GARANTIAS
6. RESPONSABILIDADES DO CONTRATANTE E CONTRATADO

Retorne JSON com análise estruturada.`,

      planta: `Você é um engenheiro especializado em projetos. Analise esta planta/projeto e extraia:

1. COMPONENTES PRINCIPAIS (estrutura, sistemas)
2. POTENCIAIS CONFLITOS (incompatibilidades entre sistemas)
3. REQUISITOS CRÍTICOS (materiais especiais, procedimentos)
4. ÁREAS DE RISCO (pontos críticos de execução)
5. INTERDEPENDÊNCIAS (ordem de execução recomendada)
6. OBSERVAÇÕES DE QUALIDADE

Retorne JSON com análise técnica.`,

      especificacao_tecnica: `Você é especialista em especificações técnicas de construção. Analise e extraia:

1. REQUISITOS TÉCNICOS (materiais, dimensões, qualidade)
2. NORMAS E PADRÕES (NBR, regulamentações)
3. PROCEDIMENTOS DE EXECUÇÃO (passo-a-passo)
4. CRITÉRIOS DE ACEITAÇÃO
5. POSSÍVEIS CONFLITOS COM ORÇAMENTO
6. ALERTAS DE CONFORMIDADE

Retorne JSON estruturado.`,

      aditivo: `Você é especialista em modificações contratuais. Analise este aditivo e identifique:

1. MUDANÇAS DE ESCOPO (adições/reduções)
2. IMPACTOS FINANCEIROS (custos adicionais)
3. IMPACTOS NO CRONOGRAMA
4. POSSÍVEIS CONFLITOS COM CONTRATO ORIGINAL
5. RESPONSABILIDADES ALTERADAS
6. NOVOS RISCOS INTRODUZIDOS

Retorne JSON com análise de impactos.`
    };

    const prompt = prompts[tipo] || prompts.outro;

    const analise = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      file_urls: [documentoUrl],
      add_context_from_internet: false,
      response_json_schema: {
        type: 'object',
        properties: {
          resumo: { type: 'string' },
          clausulas_criticas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                titulo: { type: 'string' },
                conteudo: { type: 'string' },
                severidade: { type: 'string' },
                impacto: { type: 'string' }
              }
            }
          },
          conflitos_detectados: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                descricao: { type: 'string' },
                localizacao: { type: 'string' },
                recomendacao: { type: 'string' },
                urgencia: { type: 'string' }
              }
            }
          },
          riscos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tipo: { type: 'string' },
                descricao: { type: 'string' },
                nivel: { type: 'string' },
                mitigacao: { type: 'string' }
              }
            }
          },
          datas_prazos: { type: 'array', items: { type: 'string' } },
          requisitos_executivos: { type: 'array', items: { type: 'string' } },
          alertas: { type: 'array', items: { type: 'string' } },
          score_analise: { type: 'number' }
        }
      }
    });

    // Salvar análise
    await base44.entities.AnexoObra.create({
      obra_id: obraId,
      tipo_documento: tipo,
      url_documento: documentoUrl,
      analise_ia: analise,
      data_analise: new Date().toISOString(),
      analisado_por: user.email
    });

    return Response.json({
      analise,
      tipo_documento: tipo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
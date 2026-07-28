import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contratoId, conteudoContrato } = await req.json();

    if (!conteudoContrato) {
      return Response.json({ error: 'Conteúdo do contrato é obrigatório' }, { status: 400 });
    }

    // Análise de cláusulas e riscos via IA
    const analiseIA = await base44.integrations.Core.InvokeLLM({
      prompt: `Você é um especialista jurídico em contratos de obras. Analise o seguinte contrato de forma detalhada e estruturada.

CONTRATO:
${conteudoContrato}

Forneça uma análise em JSON com os seguintes campos:
1. clausulasChave: array de cláusulas importantes (máx 10)
2. riscosIdentificados: array de riscos (reajustes, multas, prazos, garantias)
3. sugestoesAditivos: array de aditivos sugeridos (adiantamentos, escopo, prazos)
4. datas_criticas: objeto com datas importantes (vencimento, renovação, prazos)
5. avisos_urgentes: array de alertas críticos
6. score_risco: número de 1-10
7. recomendacoes: array de recomendações

Retorne APENAS JSON válido, sem markdown.`,
      response_json_schema: {
        type: 'object',
        properties: {
          clausulasChave: {
            type: 'array',
            items: { type: 'string' }
          },
          riscosIdentificados: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tipo: { type: 'string' },
                descricao: { type: 'string' },
                severidade: { type: 'string' }
              }
            }
          },
          sugestoesAditivos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tipo: { type: 'string' },
                descricao: { type: 'string' },
                motivo: { type: 'string' }
              }
            }
          },
          datas_criticas: {
            type: 'object'
          },
          avisos_urgentes: {
            type: 'array',
            items: { type: 'string' }
          },
          score_risco: {
            type: 'number'
          },
          recomendacoes: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    });

    // Salvar análise no banco se contratoId foi fornecido
    if (contratoId) {
      await base44.entities.Contrato.update(contratoId, {
        analise_ia: analiseIA,
        data_ultima_analise: new Date().toISOString()
      });
    }

    return Response.json({
      analise: analiseIA,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
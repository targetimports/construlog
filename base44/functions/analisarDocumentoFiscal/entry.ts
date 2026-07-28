import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Analisa documento fiscal com IA
 * Extrai: valor_total, data_emissao, numero, emissor_nome, emissor_cnpj
 * Opcionais: frete, desconto, outros, impostos
 * 
 * Retorna: ai_json com dados extraídos e ai_confianca (0-1)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documento_fiscal_id } = await req.json();

    if (!documento_fiscal_id) {
      return Response.json(
        { error: 'documento_fiscal_id é obrigatório' },
        { status: 400 }
      );
    }

    // 1. Buscar documento
    const nf = await base44.entities.NotaFiscal.get(documento_fiscal_id);

    if (!nf) {
      return Response.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    if (!nf.arquivo_url) {
      return Response.json({ error: 'Documento sem arquivo anexado' }, { status: 400 });
    }

    // 2. Prompt para IA extrair dados principais
    const prompt = `
Você é um especialista em leitura de Documentos Fiscais (Nota Fiscal, NF-e, RPS, Recibo, etc).

TAREFA: Analise a imagem/PDF do documento e extraia os seguintes campos:

CAMPOS OBRIGATÓRIOS (sempre tente extrair):
1. numero: Número do documento (ex: "12345", "1234567")
2. data_emissao: Data de emissão (formato: YYYY-MM-DD, ex: "2024-02-22")
3. valor_total: Valor total do documento em reais (ex: "1500.50")
4. emissor_nome: Nome/Razão Social de quem emitiu (ex: "EMPRESA LTDA")

CAMPOS OPCIONAIS (extraia se encontrar):
5. emissor_cnpj: CNPJ do emissor (sem formatação, ex: "12345678000198")
6. valor_frete: Valor de frete (ex: "50.00", ou null se não houver)
7. valor_desconto: Valor de desconto (ex: "100.00", ou null se não houver)
8. valor_impostos: Total de impostos (ex: "200.00", ou null)
9. valor_outros: Outros acréscimos (ex: "25.00", ou null)

IMPORTANTE:
- Se o valor está em outro formato (ex: "R$ 1.500,50"), converta para número decimal: "1500.50"
- Se não encontrar um campo, use null
- Sempre retorne apenas JSON válido, sem explicações extras

Retorne exatamente neste formato JSON:
{
  "numero": "valor",
  "data_emissao": "YYYY-MM-DD",
  "valor_total": "número decimal",
  "emissor_nome": "texto",
  "emissor_cnpj": "14 dígitos ou null",
  "valor_frete": "decimal ou null",
  "valor_desconto": "decimal ou null",
  "valor_impostos": "decimal ou null",
  "valor_outros": "decimal ou null",
  "confianca_geral": 0.95
}

A confianca_geral deve estar entre 0 (muito incerto) e 1 (muito confiante) baseado em:
- Legibilidade do documento
- Clareza dos campos
- Se conseguiu preencher os campos obrigatórios

Exemplo de resposta:
{
  "numero": "12345",
  "data_emissao": "2024-02-22",
  "valor_total": "1500.50",
  "emissor_nome": "EMPRESA FORNECEDORA LTDA",
  "emissor_cnpj": "12345678000198",
  "valor_frete": "50.00",
  "valor_desconto": "100.00",
  "valor_impostos": "200.00",
  "valor_outros": null,
  "confianca_geral": 0.92
}
    `;

    // 3. Chamar IA para extrair dados
    const resultadoIA = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [nf.arquivo_url],
      response_json_schema: {
        type: 'object',
        properties: {
          numero: { type: 'string' },
          data_emissao: { type: 'string' },
          valor_total: { type: 'string' },
          emissor_nome: { type: 'string' },
          emissor_cnpj: { type: 'string' },
          valor_frete: { type: ['string', 'null'] },
          valor_desconto: { type: ['string', 'null'] },
          valor_impostos: { type: ['string', 'null'] },
          valor_outros: { type: ['string', 'null'] },
          confianca_geral: { type: 'number' },
        },
        required: ['numero', 'data_emissao', 'valor_total', 'emissor_nome', 'confianca_geral'],
      },
    });

    // 4. Processar resultado
    const ai_confianca = Math.min(1, Math.max(0, resultadoIA.confianca_geral || 0.5));

    const ai_json = {
      extraido_em: new Date().toISOString(),
      metodo: 'IA_OCR',
      confianca: ai_confianca,
      campos_extraidos: {
        numero: resultadoIA.numero,
        data_emissao: resultadoIA.data_emissao,
        valor_total: resultadoIA.valor_total,
        emissor_nome: resultadoIA.emissor_nome,
        emissor_cnpj: resultadoIA.emissor_cnpj,
        valor_frete: resultadoIA.valor_frete,
        valor_desconto: resultadoIA.valor_desconto,
        valor_impostos: resultadoIA.valor_impostos,
        valor_outros: resultadoIA.valor_outros,
      },
    };

    // 5. Atualizar documento
    await base44.entities.NotaFiscal.update(documento_fiscal_id, {
      numero: resultadoIA.numero || nf.numero,
      data_emissao: resultadoIA.data_emissao || nf.data_emissao,
      valor_total: resultadoIA.valor_total ? Number(resultadoIA.valor_total) : nf.valor_total,
      emissor_nome: resultadoIA.emissor_nome || nf.emissor_nome,
      emissor_cnpj: resultadoIA.emissor_cnpj || nf.emissor_cnpj,
      valor_frete: resultadoIA.valor_frete ? Number(resultadoIA.valor_frete) : 0,
      valor_desconto: resultadoIA.valor_desconto ? Number(resultadoIA.valor_desconto) : 0,
      valor_outros: resultadoIA.valor_outros ? Number(resultadoIA.valor_outros) : 0,
      ai_json,
      ai_confianca,
      status: 'ANALISADO_IA',
    });

    // 6. Registrar auditoria
    await base44.asServiceRole.entities.NotaFiscalAuditoria.create({
      documento_fiscal_id,
      user_id: user.email,
      user_nome: user.full_name,
      acao: 'IA_PROCESSAMENTO',
      campo_alterado: null,
      motivo: `IA extraiu com confiança ${(ai_confianca * 100).toFixed(0)}%`,
    });

    return Response.json({
      success: true,
      documento_fiscal_id,
      ai_json,
      ai_confianca,
      dados_extraidos: ai_json.campos_extraidos,
      aviso: 'Valores sugeridos pela IA. Revise e edite se necessário antes de confirmar.',
    });
  } catch (error) {
    console.error('Erro ao analisar documento:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});
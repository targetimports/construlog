import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Processa Nota Fiscal com IA para extrair dados
 * Retorna objeto com campos preenchidos
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url, contexto_tipo, contexto_id } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'file_url é obrigatório' }, { status: 400 });
    }

    // Prompt para extrair dados da NF
    const prompt = `
Você é um especialista em leitura de Notas Fiscais (NF).
Analise a imagem/PDF da Nota Fiscal fornecida e extraia os seguintes dados:

1. numero_nf: Número da NF (campo obrigatório)
2. chave_nf: Chave de acesso (44 dígitos, se for NF-e)
3. data_emissao: Data de emissão (formato ISO: YYYY-MM-DD)
4. fornecedor_nome: Nome/Razão Social do fornecedor
5. fornecedor_cnpj: CNPJ do fornecedor (sem formatação)
6. valor_total: Valor total da NF (em reais, sem R$)
7. valor_impostos: Valor total de impostos (ICMS + PIS + COFINS, se houver)
8. observacao: Qualquer informação relevante (tipo de NF, descrição dos itens principais)

Retorne APENAS um JSON válido com esses campos. Se algum campo não estiver disponível, use null.
Exemplo de retorno:
{
  "numero_nf": "12345",
  "chave_nf": "35240101234567000123550010000000011234567890",
  "data_emissao": "2024-02-15",
  "fornecedor_nome": "EMPRESA LTDA",
  "fornecedor_cnpj": "12345678000198",
  "valor_total": "1500.50",
  "valor_impostos": "300.10",
  "observacao": "NF de materiais de construção"
}
    `;

    // Chamar IA para extrair dados
    const resultado = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          numero_nf: { type: 'string' },
          chave_nf: { type: 'string' },
          data_emissao: { type: 'string' },
          fornecedor_nome: { type: 'string' },
          fornecedor_cnpj: { type: 'string' },
          valor_total: { type: 'string' },
          valor_impostos: { type: 'string' },
          observacao: { type: 'string' },
        },
        required: ['numero_nf'],
      },
    });

    // Log de auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      acao: 'PROCESSAR_NF_COM_IA',
      tipo_entidade: 'NotaFiscal',
      id_entidade: contexto_id,
      usuario_id: user.email,
      detalhes: {
        contexto_tipo,
        arquivo_url: file_url,
        resultado: resultado,
      },
      timestamp: new Date().toISOString(),
    });

    return Response.json(resultado);
  } catch (error) {
    console.error('Erro ao processar NF:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});
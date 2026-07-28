import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Calcula confiança baseada em campos extraídos
 * Foca nos mais importantes: valor_total, data_emissao, numero, emissor
 */
function calcularConfianca(iaResult) {
  let pontos = 0;
  let maxPontos = 4;

  // valor_total (35%)
  if (iaResult.valores?.total && iaResult.valores.total > 0) {
    pontos += 1.4;
  }

  // data_emissao (35%)
  if (iaResult.data_emissao && /^\d{4}-\d{2}-\d{2}$/.test(iaResult.data_emissao)) {
    pontos += 1.4;
  }

  // numero (20%)
  if (iaResult.numero) {
    pontos += 0.8;
  }

  // emissor_nome (10%)
  if (iaResult.emissor_nome) {
    pontos += 0.4;
  }

  return Math.min(1.0, pontos / maxPontos);
}

/**
 * POST /notaFiscalAnalisarIA
 * Analisa NF com IA e sugere valores (status=ANALISADO_IA)
 * 
 * Payload:
 * {
 *   documento_fiscal_id: "nf-123"
 * }
 * 
 * Garantia: Nunca bloqueia o usuário mesmo com confiança baixa ou campos faltando
 */
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documento_fiscal_id } = await req.json();

    if (!documento_fiscal_id) {
      return Response.json({ error: 'documento_fiscal_id é obrigatório' }, { status: 400 });
    }

    // Buscar NF
    const nf = await base44.entities.NotaFiscal.list().then(nfs => 
      nfs.find(n => n.id === documento_fiscal_id)
    );

    if (!nf) {
      return Response.json({ error: 'NF não encontrada' }, { status: 404 });
    }

    if (!nf.arquivo_url) {
      return Response.json({ error: 'Nenhum arquivo para analisar' }, { status: 400 });
    }

    let iaResult = null;
    let confianca = 0;
    let erroIA = null;

    // Tentar analisar com IA (fallback para edição manual se falhar)
    try {
      iaResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um especialista em leitura de notas fiscais brasileiras.
        
Analise este documento e extraia APENAS os campos mais importantes em JSON:
{
  "numero": "número da NF (ex: 12345)",
  "data_emissao": "data de emissão em formato YYYY-MM-DD",
  "emissor_nome": "razão social do emissor",
  "emissor_cnpj": "CNPJ sem formatação (números apenas)",
  "valor_total": número (valor total em reais, use . para decimal),
  "valor_desconto": número (0 se não houver),
  "valor_frete": número (0 se não houver),
  "valor_outros": número (0 se não houver)
}

REGRAS CRÍTICAS:
1. Se não tiver certeza de um campo, coloque null
2. Retorne APENAS o JSON, sem explicações ou markdown
3. Use valores numéricos para valores (não string)
4. Para datas, use YYYY-MM-DD ou null
5. Priorize: valor_total > data_emissao > numero > emissor`,
        file_urls: [nf.arquivo_url],
        response_json_schema: {
          type: 'object',
          properties: {
            numero: { type: ['string', 'null'] },
            data_emissao: { type: ['string', 'null'] },
            emissor_nome: { type: ['string', 'null'] },
            emissor_cnpj: { type: ['string', 'null'] },
            valor_total: { type: ['number', 'null'] },
            valor_desconto: { type: ['number', 'null'] },
            valor_frete: { type: ['number', 'null'] },
            valor_outros: { type: ['number', 'null'] },
          },
        },
      });

      confianca = calcularConfianca(iaResult);
    } catch (erro) {
      console.warn('Falha ao analisar com IA:', erro.message);
      erroIA = erro.message;
      iaResult = {
        numero: null,
        data_emissao: null,
        emissor_nome: null,
        emissor_cnpj: null,
        valor_total: null,
        valor_desconto: null,
        valor_frete: null,
        valor_outros: null,
      };
      confianca = 0; // Sem extração, confiança = 0
    }

    // Garantir que sempre temos valores numéricos
    const total = iaResult.valor_total || 0;
    const desconto = iaResult.valor_desconto || 0;
    const frete = iaResult.valor_frete || 0;
    const outros = iaResult.valor_outros || 0;
    const valorFinalAjustado = Math.max(0, total - desconto + frete + outros);

    // Atualizar NF com dados extraídos (SEM BLOQUEAR MESMO COM CONFIANÇA BAIXA)
    const nfAtualizada = await base44.entities.NotaFiscal.update(documento_fiscal_id, {
      numero: iaResult.numero || '',
      chave_acesso: iaResult.chave_acesso || '',
      data_emissao: iaResult.data_emissao || nf.data_emissao,
      emissor_nome: iaResult.emissor_nome || '',
      emissor_cnpj: iaResult.emissor_cnpj || '',
      valor_total: total,
      valor_desconto: desconto,
      valor_frete: frete,
      valor_outros: outros,
      valor_final_ajustado: valorFinalAjustado,
      status: 'ANALISADO_IA',
      ai_json: iaResult,
      ai_confianca: confianca,
    });

    // Registrar auditoria
    await base44.entities.NotaFiscalAuditoria.create({
      documento_fiscal_id,
      user_id: user.email,
      user_nome: user.full_name || user.email,
      acao: 'IA_PROCESSAMENTO',
      campo_alterado: 'status',
      valor_antigo: 'ENVIADO',
      valor_novo: 'ANALISADO_IA',
      motivo: `Análise automática com IA (confiança: ${(confianca * 100).toFixed(0)}%)${erroIA ? ` - com fallback: ${erroIA}` : ''}`,
    });

    return Response.json({
      nf: nfAtualizada,
      confianca,
      erroIA: erroIA || null,
      aviso: confianca < 0.5 
        ? 'Confiança baixa - revise os campos sugeridos' 
        : confianca < 0.8
        ? 'Revise campos importantes (valor, data, número)'
        : null,
    });
  } catch (error) {
    console.error('Erro ao analisar NF:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
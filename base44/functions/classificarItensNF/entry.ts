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

    // Buscar itens
    const itens = await base44.asServiceRole.entities.NotaFiscalItem.filter({
      nota_fiscal_id
    });

    const classificacoes = [];

    for (const item of itens) {
      let categoria = classificarPorRegras(item.descricao || '');

      // Se não classificou com regras, tentar IA
      if (!categoria) {
        try {
          const iaRes = await base44.integrations.Core.InvokeLLM({
            prompt: `Classifique este item de nota fiscal em UMA das categorias: MATERIAL, SERVICO, FRETE ou OUTROS. Responda APENAS com a categoria.

Item: "${item.descricao || ''}"

Exemplos:
- "Cimento Portland" -> MATERIAL
- "Tijolos cerâmicos" -> MATERIAL
- "Mão de obra" -> SERVICO
- "Frete para obra" -> FRETE
- "Outros" -> OUTROS`,
            response_json_schema: null
          });

          categoria = (iaRes || '').trim().toUpperCase();
          if (!['MATERIAL', 'SERVICO', 'FRETE', 'OUTROS'].includes(categoria)) {
            categoria = 'OUTROS';
          }
        } catch (err) {
          console.warn('⚠️ Erro IA classificação:', err.message);
          categoria = 'OUTROS';
        }
      }

      // Atualizar item
      await base44.asServiceRole.entities.NotaFiscalItem.update(item.id, {
        categoria
      });

      classificacoes.push({
        item_id: item.id,
        descricao: item.descricao,
        categoria
      });
    }

    // Log auditoria
    await base44.asServiceRole.entities.AuditLogNF.create({
      nota_fiscal_id,
      acao: 'ITENS_CLASSIFICADOS',
      usuario_email: user.email,
      descricao: `${classificacoes.length} itens classificados automaticamente`
    });

    return Response.json({
      message: 'Itens classificados com sucesso',
      classificacoes
    });
  } catch (error) {
    console.error('❌ Erro ao classificar itens:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function classificarPorRegras(descricao) {
  const desc = (descricao || '').toLowerCase();

  // FRETE
  if (desc.includes('frete') || desc.includes('transporte') || desc.includes('envio')) {
    return 'FRETE';
  }

  // SERVIÇO
  if (desc.includes('mão de obra') || desc.includes('serviço') || desc.includes('manutenção') ||
      desc.includes('limpeza') || desc.includes('consultoria') || desc.includes('projeto') ||
      desc.includes('inspeção') || desc.includes('trabalho')) {
    return 'SERVICO';
  }

  // MATERIAL - palavras-chave
  if (desc.includes('cimento') || desc.includes('tijolo') || desc.includes('concreto') ||
      desc.includes('aço') || desc.includes('madeira') || desc.includes('vidro') ||
      desc.includes('tinta') || desc.includes('cobre') || desc.includes('alumínio') ||
      desc.includes('ferro') || desc.includes('pedra') || desc.includes('areia') ||
      desc.includes('cal') || desc.includes('gesso') || desc.includes('asfalto') ||
      desc.includes('pvc') || desc.includes('telha') || desc.includes('bloco') ||
      desc.includes('parede') || desc.includes('piso') || desc.includes('revestimento')) {
    return 'MATERIAL';
  }

  // Padrão: se tem unidade de medida típica de material, é MATERIAL
  if (desc.match(/\b(kg|kg|ton|m|m²|m³|un|cx|sc|lt|l)\b/i)) {
    return 'MATERIAL';
  }

  return null;
}
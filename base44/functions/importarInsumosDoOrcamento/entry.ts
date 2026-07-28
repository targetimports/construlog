import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planilha_id, obra_id } = await req.json();

    if (!planilha_id || !obra_id) {
      return Response.json({
        error: 'planilha_id e obra_id são obrigatórios'
      }, { status: 400 });
    }

    // Buscar ImportacaoPlanilha
    const planilha = await base44.asServiceRole.entities.ImportacaoPlanilha.read(planilha_id);
    if (!planilha) {
      return Response.json({ error: 'Planilha não encontrada' }, { status: 404 });
    }

    // Buscar ImportacaoLinha
    const linhas = await base44.asServiceRole.entities.ImportacaoLinha.filter({
      importacao_id: planilha_id
    });

    const insumosProcessados = [];
    const erros = [];

    for (const linha of linhas) {
      try {
        const raw = JSON.parse(linha.raw_json);

        // Extrair dados da linha (depende da estrutura da planilha)
        const codigo = raw.codigo || raw.code || `IMP-${Date.now()}`;
        const descricao = raw.descricao || raw.description || raw.item || '';
        const unidade = raw.unidade || raw.unit || 'un';
        const quantidade = parseFloat(raw.quantidade || raw.quantity || 1);

        if (!descricao) {
          erros.push(`Linha ${linha.linha_numero}: descrição vazia`);
          continue;
        }

        // 1. Buscar ou criar Insumo com origem=importado
        const insumosExistentes = await base44.asServiceRole.entities.Insumo.filter({
          codigo
        });

        let insumo_id;
        if (insumosExistentes && insumosExistentes.length > 0) {
          insumo_id = insumosExistentes[0].id;
        } else {
          const novoInsumo = await base44.asServiceRole.entities.Insumo.create({
            codigo,
            descricao,
            unidade,
            grupo: 'material',
            tipo: 'material',
            origem: 'importado',
            preco_referencia: 0,
            preco_ultima_compra: 0,
            status_precificacao: 'pendente'
          });
          insumo_id = novoInsumo.id;
        }

        // 2. NÃO criar entrada de estoque automaticamente
        // Estoque só entra quando houver recebimento + pagamento de OC

        // 3. Registrar como "quantidade prevista" ou "lista de materiais" em DemandaEstoqueObra
        await base44.asServiceRole.entities.DemandaEstoqueObra.create({
          obra_id,
          insumo_id,
          quantidade_prevista: quantidade,
          status: 'prevista',
          origem_importacao_id: planilha_id
        });

        insumosProcessados.push({
          codigo,
          descricao,
          insumo_id,
          status: 'cadastrado (lista prevista, não estoque real)'
        });

      } catch (lineError) {
        erros.push(`Linha ${linha.linha_numero}: ${lineError.message}`);
      }
    }

    return Response.json({
      success: true,
      planilha_id,
      obra_id,
      total_processado: insumosProcessados.length,
      insumosProcessados,
      erros,
      mensagem: `${insumosProcessados.length} insumos cadastrados como "lista prevista". O estoque será alimentado quando você receber e pagar a OC.`
    });
  } catch (error) {
    console.error('Erro ao importar insumos:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
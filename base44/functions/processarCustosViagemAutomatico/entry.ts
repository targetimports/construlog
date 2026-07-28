import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { viagem_id } = await req.json();

    if (!viagem_id) {
      return Response.json({ error: 'viagem_id obrigatório' }, { status: 400 });
    }

    const viagens = await base44.entities.Viagem.list();
    const viagem = viagens.find(v => v.id === viagem_id);

    if (!viagem) {
      return Response.json({ error: 'Viagem não encontrada' }, { status: 404 });
    }

    // Verificar se já existe custo registrado para esta viagem
    const custosExistentes = await base44.entities.CustoViagem.filter({ viagem_id });
    if (custosExistentes && custosExistentes.length > 0) {
      return Response.json({
        success: false,
        message: 'Já existem custos registrados para esta viagem'
      });
    }

    const custosGerados = [];

    // 1. Processar abastecimentos da viagem
    const abastecimentos = await base44.entities.Abastecimento.filter({ viagem_id });
    
    for (const abast of abastecimentos) {
      const custoAbast = await base44.entities.CustoViagem.create({
        viagem_id: viagem_id,
        categoria: 'abastecimento',
        data: abast.data || new Date().toISOString().split('T')[0],
        valor_total: abast.valor || 0,
        quantidade: abast.litros || null,
        unidade: 'litros',
        descricao: `Abastecimento automático - ${abast.posto || 'N/A'}`,
        tipo_registro: 'automatico',
        status: 'aprovado'
      });
      custosGerados.push(custoAbast);
    }

    // 2. Buscar despesas genéricas da viagem (se houver)
    const lancamentosGenericos = await base44.entities.LancamentoGenerico.filter({
      categoria: 'Despesa Viagem'
    });

    const despesasViagem = lancamentosGenericos.filter(l => 
      l.observacao && l.observacao.includes(viagem.numero)
    );

    for (const despesa of despesasViagem) {
      const custoDespesa = await base44.entities.CustoViagem.create({
        viagem_id: viagem_id,
        categoria: 'outros',
        data: despesa.data,
        valor_total: despesa.valor,
        descricao: despesa.descricao || 'Despesa de viagem',
        tipo_registro: 'automatico',
        status: 'pendente'
      });
      custosGerados.push(custoDespesa);
    }

    // 3. Usar IA para analisar fotos e identificar possíveis custos não registrados
    let alertasIA = [];
    try {
      if (viagem.foto_painel_inicial_url || viagem.foto_painel_final_url) {
        const analiseIA = await base44.integrations.Core.InvokeLLM({
          prompt: `Analise estas fotos de uma viagem e identifique se há recibos, notas fiscais ou 
          comprovantes visíveis nas fotos. Se encontrar, extraia: tipo de despesa, valor, data.
          Retorne uma lista de despesas encontradas.`,
          file_urls: [
            viagem.foto_painel_inicial_url,
            viagem.foto_painel_final_url
          ].filter(Boolean),
          response_json_schema: {
            type: "object",
            properties: {
              despesas_encontradas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    tipo: { type: "string" },
                    valor: { type: "number" },
                    data: { type: "string" }
                  }
                }
              }
            }
          }
        });

        if (analiseIA?.despesas_encontradas && analiseIA.despesas_encontradas.length > 0) {
          alertasIA = analiseIA.despesas_encontradas;
        }
      }
    } catch (err) {
      console.log('Erro na análise de IA:', err);
    }

    return Response.json({
      success: true,
      custos_gerados: custosGerados.length,
      custos: custosGerados,
      alertas_ia: alertasIA,
      mensagem: `${custosGerados.length} custo(s) processado(s) automaticamente`
    });

  } catch (error) {
    console.error('Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
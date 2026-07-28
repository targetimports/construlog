import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obraId, orcamentoId } = await req.json();

    // 1. Buscar orçamento e medições
    const orcamento = await base44.entities.Orcamento.filter({ id: orcamentoId }, null, 1);
    if (orcamento.length === 0) {
      return Response.json({ error: 'Orçamento não encontrado' }, { status: 404 });
    }

    const orc = orcamento[0];
    const medicoes = await base44.entities.Medicao.filter({ orcamento_id: orcamentoId, status: 'aprovada' });

    // 2. Calcular evolução física por item
    const evolucaoFisica = {};
    
    orc.itens?.forEach(item => {
      const medidoItem = medicoes.reduce((acc, m) => {
        const mi = m.itens?.find(x => x.item_orcamento_id === item.id);
        return acc + (mi?.valor_medido || 0);
      }, 0);

      const percentualItem = item.valor_total > 0 ? (medidoItem / item.valor_total) * 100 : 0;
      evolucaoFisica[item.id] = {
        item_orcamento_id: item.id,
        descricao: item.descricao,
        etapa: item.etapa,
        percentual_evolucao: Math.min(100, parseFloat(percentualItem.toFixed(2)))
      };
    });

    // 3. Buscar gestão de custos da obra
    try {
      const gestaoObras = await base44.entities.GestaoObra.filter({ obra_id: obraId }, null, 1);
      
      if (gestaoObras.length > 0) {
        const gestao = gestaoObras[0];
        const evolucaoAtualizada = {
          ...gestao,
          medicoes_sincronizadas: evolucaoFisica,
          data_ultima_sincronizacao: new Date().toISOString(),
          origem_sincronizacao: 'medicoes'
        };

        await base44.entities.GestaoObra.update(gestao.id, evolucaoAtualizada);
      }
    } catch (e) {
      console.log('Gestão não encontrada, criando registro...');
    }

    // 4. Log de sincronização
    const logSinc = {
      obra_id: obraId,
      orcamento_id: orcamentoId,
      data_sincronizacao: new Date().toISOString(),
      usuario: user.email,
      itens_sincronizados: Object.keys(evolucaoFisica).length,
      status: 'sucesso'
    };

    return Response.json({
      sucesso: true,
      evolucao_fisica: evolucaoFisica,
      log: logSinc,
      mensagem: `${Object.keys(evolucaoFisica).length} itens sincronizados com evolução física`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
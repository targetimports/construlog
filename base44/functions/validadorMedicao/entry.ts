import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { medicaoData, orcamentoId } = await req.json();

    const erros = [];
    const avisos = [];

    // 1. Validar se há itens preenchidos
    const itensMedidos = medicaoData.itens?.filter(i => i.quantidade_medida > 0 || i.percentual_medido > 0).length || 0;
    if (itensMedidos === 0) {
      erros.push({
        tipo: 'erro',
        mensagem: 'Nenhum item foi medido. Preencha pelo menos um item.',
        campo: 'itens'
      });
    }

    // 2. Validar se a soma dos percentuais não ultrapassa 100%
    const totalPercentual = medicaoData.itens?.reduce((acc, i) => acc + (i.percentual_medido || 0), 0) || 0;
    if (totalPercentual > 100) {
      erros.push({
        tipo: 'erro',
        mensagem: `Total de percentuais (${totalPercentual.toFixed(1)}%) ultrapassa 100%`,
        campo: 'percentuais'
      });
    }

    // 3. Buscar orçamento
    const orcamento = await base44.entities.Orcamento.filter({ id: orcamentoId }, null, 1);
    if (orcamento.length === 0) {
      return Response.json({ error: 'Orçamento não encontrado' }, { status: 404 });
    }

    const orc = orcamento[0];

    // 4. Validar saldos
    const medicoes = await base44.entities.Medicao.filter({ orcamento_id: orcamentoId }, '-data_envio');
    
    for (const item of medicaoData.itens || []) {
      const itemOrc = orc.itens?.find(i => i.id === item.item_orcamento_id);
      if (!itemOrc) continue;

      const valorOrcado = itemOrc.valor_total || 0;
      const jaMedido = medicoes.reduce((acc, m) => {
        const itemMedicao = m.itens?.find(i => i.item_orcamento_id === item.item_orcamento_id);
        return acc + (itemMedicao?.valor_medido || 0);
      }, 0);

      const valorNovaMedicao = item.valor_medido || 0;
      const totalMedido = jaMedido + valorNovaMedicao;

      if (totalMedido > valorOrcado * 1.05) { // 5% de tolerância
        erros.push({
          tipo: 'erro',
          mensagem: `Item "${itemOrc.descricao}" ultrapassa orçado em ${((totalMedido / valorOrcado) * 100 - 100).toFixed(1)}%`,
          item_id: item.item_orcamento_id
        });
      } else if (totalMedido > valorOrcado * 1.02) { // 2% = aviso
        avisos.push({
          tipo: 'aviso',
          mensagem: `Item "${itemOrc.descricao}" próximo ao limite orçado`,
          item_id: item.item_orcamento_id
        });
      }
    }

    // 5. Validar descontos e retenções
    const totalDescontos = medicaoData.descontos?.reduce((acc, d) => acc + (d.valor || 0), 0) || 0;
    const totalRetencoes = medicaoData.retencoes?.reduce((acc, r) => acc + (r.valor || 0), 0) || 0;
    const valorMedido = medicaoData.itens?.reduce((acc, i) => acc + (i.valor_medido || 0), 0) || 0;

    const valorLiquido = valorMedido - totalDescontos - totalRetencoes;
    
    if (valorLiquido < 0) {
      erros.push({
        tipo: 'erro',
        mensagem: 'Descontos e retenções excedem o valor medido',
        campo: 'financeiro'
      });
    }

    // 6. Validar anexos (se houver política)
    if (medicaoData.itens?.length > 10 && (!medicaoData.anexos || medicaoData.anexos.length === 0)) {
      avisos.push({
        tipo: 'aviso',
        mensagem: 'Medição grande sem anexos comprobatórios. Recomendamos adicionar fotos.',
        campo: 'anexos'
      });
    }

    const valido = erros.length === 0;

    return Response.json({
      valido,
      erros,
      avisos,
      resumo: {
        itens_medidos: itensMedidos,
        total_percentual: totalPercentual.toFixed(1),
        valor_medido: valorMedido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        valor_liquido: valorLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orcamentoId, medicaoId } = await req.json();

    const alertas = [];
    const avisos = [];

    // 1. Buscar orçamento e medições
    const orcamento = await base44.entities.Orcamento.filter({ id: orcamentoId }, null, 1);
    if (orcamento.length === 0) {
      return Response.json({ error: 'Orçamento não encontrado' }, { status: 404 });
    }

    const orc = orcamento[0];
    const medicoes = await base44.entities.Medicao.filter({ orcamento_id: orcamentoId, status: 'aprovada' }, '-data_envio');

    // 2. Verificar itens deletados no orçamento mas medidos anteriormente
    if (medicoes.length > 0) {
      const medicoesItens = new Set();
      medicoes.forEach(m => {
        m.itens?.forEach(mi => medicoesItens.add(mi.item_orcamento_id));
      });

      const orcItens = new Set(orc.itens?.map(i => i.id) || []);
      
      for (const itemId of medicoesItens) {
        if (!orcItens.has(itemId)) {
          alertas.push({
            tipo: 'erro',
            severidade: 'critica',
            mensagem: `Item ${itemId} foi deletado do orçamento mas possui medições aprovadas. Remova as medições antes de deletar.`,
            campo: 'itens'
          });
        }
      }
    }

    // 3. Verificar alterações em etapas/estrutura
    if (orc.etapas_alteradas_apos_medicao) {
      avisos.push({
        tipo: 'aviso',
        severidade: 'alta',
        mensagem: 'Estrutura do orçamento foi alterada desde a última medição. Verifique percentuais e valores.',
        campo: 'etapas'
      });
    }

    // 4. Validar totais
    const totalOrcadoAtual = orc.itens?.reduce((acc, i) => acc + (i.valor_total || 0), 0) || 0;
    const totalMedidoAprovado = medicoes.reduce((acc, m) => {
      return acc + (m.itens?.reduce((iacc, mi) => iacc + (mi.valor_medido || 0), 0) || 0);
    }, 0);

    if (totalMedidoAprovado > totalOrcadoAtual * 1.05) {
      alertas.push({
        tipo: 'erro',
        severidade: 'alta',
        mensagem: `Total medido (R$ ${totalMedidoAprovado.toFixed(2)}) ultrapassa orçado (R$ ${totalOrcadoAtual.toFixed(2)}) em mais de 5%`,
        campo: 'totais'
      });
    } else if (totalMedidoAprovado > totalOrcadoAtual) {
      avisos.push({
        tipo: 'aviso',
        severidade: 'media',
        mensagem: `Total medido (R$ ${totalMedidoAprovado.toFixed(2)}) ultrapassa orçado em ${((totalMedidoAprovado / totalOrcadoAtual - 1) * 100).toFixed(1)}%`,
        campo: 'totais'
      });
    }

    // 5. Verificar inconsistências de quantidades
    const inconsistenciasQtd = [];
    orc.itens?.forEach(item => {
      const medicoesItem = medicoes.filter(m => m.itens?.some(mi => mi.item_orcamento_id === item.id));
      const qtdMedida = medicoesItem.reduce((acc, m) => {
        const mi = m.itens?.find(x => x.item_orcamento_id === item.id);
        return acc + (mi?.quantidade_medida || 0);
      }, 0);

      if (qtdMedida > item.quantidade * 1.1) {
        inconsistenciasQtd.push({
          descricao: item.descricao,
          orcado: item.quantidade,
          medido: qtdMedida
        });
      }
    });

    if (inconsistenciasQtd.length > 0) {
      alertas.push({
        tipo: 'aviso',
        severidade: 'media',
        mensagem: `${inconsistenciasQtd.length} item(ns) com quantidade medida > 10% do orçado`,
        detalhes: inconsistenciasQtd
      });
    }

    // 6. Verificar status de bloqueio do orçamento
    const temMedicoes = medicoes.length > 0;
    if (temMedicoes && orc.pode_editar !== false) {
      avisos.push({
        tipo: 'aviso',
        severidade: 'alta',
        mensagem: 'Orçamento possui medições mas não está bloqueado para edição. Recomenda-se bloquear.',
        campo: 'bloqueio'
      });
    }

    const temErros = alertas.some(a => a.tipo === 'erro');
    const temAvisos = avisos.length > 0;

    return Response.json({
      valido: !temErros,
      alertas,
      avisos,
      resumo: {
        total_orcado: totalOrcadoAtual,
        total_medido_aprovado: totalMedidoAprovado,
        diferenca_percentual: ((totalMedidoAprovado / totalOrcadoAtual - 1) * 100).toFixed(2),
        medicoes_aprovadas: medicoes.length,
        tem_erros: temErros,
        tem_avisos: temAvisos
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
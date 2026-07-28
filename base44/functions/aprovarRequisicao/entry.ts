import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { requisicao_id, aprovado = true, aprovador_email, motivo } = await req.json();

    if (!requisicao_id) {
      return Response.json({ error: 'requisicao_id é obrigatório' }, { status: 400 });
    }

    // Buscar requisição
    const requisicoes = await base44.asServiceRole.entities.RequisicaoCompra.filter({ id: requisicao_id });
    const requisicao = requisicoes[0];

    if (!requisicao) {
      return Response.json({ error: 'Requisição não encontrada' }, { status: 404 });
    }

    const user = await base44.auth.me();
    const emailAprovador = aprovador_email || user?.email || 'Sistema';

    // Atualizar status da requisição
    const novoStatus = aprovado ? 'aprovada' : 'recusada';
    await base44.asServiceRole.entities.RequisicaoCompra.update(requisicao_id, {
      status: novoStatus,
      aprovado_por: emailAprovador,
      data_aprovacao: new Date().toISOString().split('T')[0],
      observacoes: motivo ? `${requisicao.observacoes || ''}\n\n[${novoStatus}]: ${motivo}` : requisicao.observacoes
    });

    let ordemCompra = null;

    // Se aprovado, criar Ordem de Compra automaticamente
    if (aprovado) {
      const numeroOC = `OC-${Date.now()}`;
      const itens = requisicao.itens || [];
      const valorTotal = itens.reduce((sum, item) => 
        sum + ((item.quantidade_solicitada || 0) * (item.valor_estimado || 0)), 0
      );

      // Pegar melhor cotação se existir
      let fornecedorNome = 'A definir';
      let fornecedorId = null;
      
      try {
        const cotacoes = await base44.asServiceRole.entities.CotacaoFornecedor.filter({ requisicao_id });
        if (cotacoes.length > 0) {
          const melhorCotacao = cotacoes.reduce((min, c) => 
            (c.valor_total || 0) < (min.valor_total || 0) ? c : min
          );
          fornecedorNome = melhorCotacao.fornecedor;
          fornecedorId = melhorCotacao.fornecedor_id;
        }
      } catch (e) {
        console.log('Sem cotações vinculadas');
      }

      ordemCompra = await base44.asServiceRole.entities.OrdemCompra.create({
        numero: numeroOC,
        requisicao_id: requisicao_id,
        obra_id: requisicao.obra_id,
        fornecedor_id: fornecedorId,
        fornecedor_nome: fornecedorNome,
        descricao: requisicao.descricao_resumo || requisicao.titulo || 'Ordem de Compra',
        valor_total: valorTotal,
        data_emissao: new Date().toISOString().split('T')[0],
        data_prevista_entrega: requisicao.data_necessidade,
        status: 'emitida',
        aprovado_por: emailAprovador,
        data_aprovacao: new Date().toISOString().split('T')[0],
        itens: itens.map(item => ({
          descricao: item.descricao,
          unidade: item.unidade,
          quantidade: item.quantidade_solicitada,
          valor_unitario: item.valor_estimado || 0,
          valor_total: (item.quantidade_solicitada || 0) * (item.valor_estimado || 0)
        }))
      });

      // Atualizar status para "em_compra"
      await base44.asServiceRole.entities.RequisicaoCompra.update(requisicao_id, {
        status: 'em_compra'
      });
    }

    // Enviar notificação ao solicitante
    if (requisicao.solicitante) {
      try {
        const obras = await base44.asServiceRole.entities.Obra.filter({ id: requisicao.obra_id });
        const obra = obras[0];

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: requisicao.solicitante,
          subject: `Requisição ${novoStatus === 'aprovada' ? 'Aprovada' : 'Rejeitada'} - ${requisicao.descricao_resumo || requisicao.titulo}`,
          body: `
            Olá,

            Sua requisição de compra foi ${novoStatus === 'aprovada' ? 'aprovada' : 'rejeitada'}.

            Detalhes:
            - Obra: ${obra?.nome || 'N/A'}
            - Descrição: ${requisicao.descricao_resumo || requisicao.titulo}
            - Valor Estimado: R$ ${(requisicao.valor_total_estimado || 0).toLocaleString('pt-BR')}
            - Aprovador: ${emailAprovador}
            ${aprovado ? `\n- Ordem de Compra: ${ordemCompra?.numero}` : ''}
            ${motivo ? `\n\nMotivo: ${motivo}` : ''}

            Atenciosamente,
            Sistema GERMANOS CONSTRULOG
          `
        });
      } catch (emailError) {
        console.error('Erro ao enviar email:', emailError);
      }
    }

    return Response.json({ 
      success: true,
      status: novoStatus,
      ordem_compra: ordemCompra,
      message: `Requisição ${novoStatus === 'aprovada' ? 'aprovada' : 'rejeitada'} com sucesso${aprovado ? ' e ordem de compra gerada' : ''}`
    });
  } catch (error) {
    console.error('Erro ao processar aprovação:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
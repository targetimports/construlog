import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { sugestao_id, tipo, obra_id, obra_nome, itens_selecionados } = body;
    // tipo: 'solicitacao_compra' ou 'ordem_compra'

    if (!sugestao_id || !tipo) {
      return Response.json({ error: 'sugestao_id e tipo são obrigatórios' }, { status: 400 });
    }

    // 1. Buscar sugestão
    const sugestoes = await base44.asServiceRole.entities.SugestaoCompra.filter({ id: sugestao_id });
    const sugestao = sugestoes?.[0];
    if (!sugestao) return Response.json({ error: 'Sugestão não encontrada' }, { status: 404 });
    if (sugestao.status === 'convertida') {
      return Response.json({ error: 'Sugestão já convertida' }, { status: 400 });
    }

    // Filtrar itens selecionados
    const todosItens = sugestao.itens || [];
    const itensFinal = itens_selecionados && itens_selecionados.length > 0
      ? todosItens.filter(i => itens_selecionados.includes(i.material_id))
      : todosItens.filter(i => i.selecionado !== false);

    if (itensFinal.length === 0) {
      return Response.json({ error: 'Nenhum item selecionado para conversão' }, { status: 400 });
    }

    let documentoId = null;

    if (tipo === 'solicitacao_compra') {
      // Criar Solicitação de Compra
      const sc = await base44.asServiceRole.entities.SolicitacaoCompra.create({
        obra_id: obra_id || '',
        obra_nome: obra_nome || '',
        solicitante_user_id: user.email,
        solicitante_nome: user.full_name || user.email,
        status: 'ENVIADA',
        prioridade: 'ALTA',
        observacao: `Gerada automaticamente a partir de sugestão de compra (${sugestao.almoxarifado_nome || 'Almox'}) — ${itensFinal.length} item(ns)`
      });

      // Criar itens da SC
      const itensData = itensFinal.map(item => ({
        solicitacao_id: sc.id,
        material_id: item.material_id,
        material_nome: item.material_nome,
        material_unidade: item.unidade,
        quantidade: item.sugerido,
        observacao: item.motivo || ''
      }));

      await base44.asServiceRole.entities.SolicitacaoCompraItem.bulkCreate(itensData);
      documentoId = sc.id;

    } else {
      // tipo === 'ordem_compra' — não é possível criar OC completa sem fornecedor/cotação
      // Cria uma Solicitação com flag para virar OC
      const sc = await base44.asServiceRole.entities.SolicitacaoCompra.create({
        obra_id: obra_id || '',
        obra_nome: obra_nome || '',
        solicitante_user_id: user.email,
        solicitante_nome: user.full_name || user.email,
        status: 'APROVADA',
        prioridade: 'ALTA',
        observacao: `Pré-aprovada para OC — sugestão automática (${sugestao.almoxarifado_nome || 'Almox'}) — ${itensFinal.length} item(ns)`
      });

      const itensData = itensFinal.map(item => ({
        solicitacao_id: sc.id,
        material_id: item.material_id,
        material_nome: item.material_nome,
        material_unidade: item.unidade,
        quantidade: item.sugerido,
        observacao: item.motivo || ''
      }));

      await base44.asServiceRole.entities.SolicitacaoCompraItem.bulkCreate(itensData);
      documentoId = sc.id;
    }

    // Atualizar sugestão
    const temTodosItens = itensFinal.length >= todosItens.length;
    await base44.asServiceRole.entities.SugestaoCompra.update(sugestao_id, {
      status: temTodosItens ? 'convertida' : 'parcial',
      convertido_em_tipo: tipo === 'ordem_compra' ? 'ordem_compra' : 'solicitacao_compra',
      convertido_em_id: documentoId
    });

    return Response.json({
      success: true,
      message: tipo === 'solicitacao_compra'
        ? `Solicitação de Compra criada com ${itensFinal.length} item(ns).`
        : `Solicitação pré-aprovada criada com ${itensFinal.length} item(ns) para gerar OC.`,
      documento_id: documentoId,
      tipo_documento: 'solicitacao_compra'
    });

  } catch (error) {
    console.error('Erro ao converter sugestão:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
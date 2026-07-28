import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { propostaId, acao, dadosProposta } = await req.json();

    // Buscar proposta existente
    const versoes = await base44.entities.VersaoProposta.filter({ 
      proposta_id: propostaId 
    }, '-numero_versao', 1);

    const ultimaVersao = versoes.length > 0 ? versoes[0].numero_versao : 0;
    const novaVersao = ultimaVersao + 1;

    // Desativar versão anterior
    if (versoes.length > 0) {
      await base44.entities.VersaoProposta.update(versoes[0].id, { ativa: false });
    }

    // Criar snapshot dos dados
    const snapshot = {
      descricao: dadosProposta?.descricao || '',
      valor_total: dadosProposta?.valor_total || 0,
      desconto_aplicado: dadosProposta?.desconto_aplicado || 0,
      valor_final: dadosProposta?.valor_final || 0,
      condicoes_pagamento: dadosProposta?.condicoes_pagamento || '',
      data_vencimento: dadosProposta?.data_vencimento || '',
      status: dadosProposta?.status || 'rascunho'
    };

    // Ações possíveis
    let statusClienteAtualizado = 'nao_enviada';
    let dataAtualizacao = null;

    switch (acao) {
      case 'enviar':
        statusClienteAtualizado = 'enviada';
        dataAtualizacao = { data_envio: new Date().toISOString() };
        break;
      case 'visualizar':
        statusClienteAtualizado = 'visualizada';
        dataAtualizacao = { data_visualizacao: new Date().toISOString() };
        break;
      case 'aceitar':
        statusClienteAtualizado = 'aceita';
        dataAtualizacao = { data_resposta: new Date().toISOString() };
        break;
      case 'recusar':
        statusClienteAtualizado = 'recusada';
        dataAtualizacao = { 
          data_resposta: new Date().toISOString(),
          motivo_recusa: dadosProposta?.motivo || 'Sem especificação'
        };
        break;
      case 'editar':
        statusClienteAtualizado = 'nao_enviada';
        break;
    }

    // Criar nova versão
    const novaVersaoData = {
      proposta_id: propostaId,
      numero_versao: novaVersao,
      data_criacao: new Date().toISOString(),
      criado_por: user.email,
      descricao_alteracao: dadosProposta?.descricao_alteracao || `Versão ${novaVersao}`,
      dados_proposta_snapshot: snapshot,
      status_cliente: statusClienteAtualizado,
      cliente_email: dadosProposta?.cliente_email || '',
      ativa: true,
      ...dataAtualizacao
    };

    const novaVersaoCriada = await base44.entities.VersaoProposta.create(novaVersaoData);

    return Response.json({
      success: true,
      versao: novaVersao,
      statusCliente: statusClienteAtualizado,
      versaoId: novaVersaoCriada.id,
      timeline: {
        acao,
        timestamp: new Date().toISOString(),
        usuario: user.email,
        descricao: `Proposta ${acao === 'enviar' ? 'enviada' : acao === 'visualizar' ? 'visualizada' : acao === 'aceitar' ? 'aceita' : acao === 'recusar' ? 'recusada' : 'modificada'}`
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
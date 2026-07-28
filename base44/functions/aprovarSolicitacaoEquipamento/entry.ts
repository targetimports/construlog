import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { solicitacaoId, action, motivo_rejeicao } = await req.json();

    const solicitacao = await base44.entities.SolicitacaoEquipamentoObra.read(solicitacaoId);

    if (action === 'aprovar') {
      // Atualizar solicitação
      await base44.entities.SolicitacaoEquipamentoObra.update(solicitacaoId, {
        status: 'aprovado',
        aprovado_por: user.email,
        data_aprovacao: new Date().toISOString()
      });

      // Criar registro de uso do equipamento
      const registroUso = await base44.entities.RegistroUsoEquipamento.create({
        equipamento_id: solicitacao.equipamento_id,
        obra_id: solicitacao.obra_id,
        data_inicio: solicitacao.data_inicio,
        data_fim: solicitacao.data_fim,
        tipo_uso: 'alugado'
      });

      // Vincular ao registro
      await base44.entities.SolicitacaoEquipamentoObra.update(solicitacaoId, {
        registro_uso_equipamento_id: registroUso.id
      });

      return Response.json({ success: true, message: 'Solicitação aprovada' });
    } else if (action === 'rejeitar') {
      await base44.entities.SolicitacaoEquipamentoObra.update(solicitacaoId, {
        status: 'rejeitado',
        motivo_rejeicao,
        aprovado_por: user.email,
        data_aprovacao: new Date().toISOString()
      });

      return Response.json({ success: true, message: 'Solicitação rejeitada' });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
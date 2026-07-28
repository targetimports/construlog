import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Verifica se operação tem aprovação pendente ou rejeitada
 * Bloqueia ações se não aprovado
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { tipo_operacao, referencia_id } = await req.json();

    if (!tipo_operacao || !referencia_id) {
      return Response.json({ 
        error: 'Campos obrigatórios: tipo_operacao, referencia_id' 
      }, { status: 400 });
    }

    // Buscar aprovação
    const aprovacoes = await base44.entities.AprovacaoPendente.filter({
      tipo_operacao,
      referencia_id
    });

    if (aprovacoes.length === 0) {
      // Sem aprovação = pode prosseguir
      return Response.json({
        pode_prosseguir: true,
        mensagem: 'Sem aprovação necessária'
      });
    }

    const aprovacao = aprovacoes[0];

    if (aprovacao.status === 'rejeitado') {
      return Response.json({
        pode_prosseguir: false,
        bloqueado: true,
        motivo: 'Operação foi rejeitada',
        detalhes: {
          status: 'rejeitado',
          motivo_rejeicao: aprovacao.motivo_rejeicao,
          usuario_rejeitou: aprovacao.usuario_aprovou
        }
      });
    }

    if (aprovacao.status === 'pendente') {
      return Response.json({
        pode_prosseguir: false,
        bloqueado: true,
        motivo: `Aguardando aprovação de nível ${aprovacao.nivel_atual}`,
        detalhes: {
          status: 'pendente',
          nivel_atual: aprovacao.nivel_atual,
          nivel_requerido: aprovacao.nivel_requerido,
          aprovacao_id: aprovacao.id
        }
      });
    }

    // Status = aprovado
    return Response.json({
      pode_prosseguir: true,
      aprovado: true,
      detalhes: {
        status: 'aprovado',
        usuario_aprovou: aprovacao.usuario_aprovou,
        data_aprovacao: aprovacao.data_aprovacao
      }
    });

  } catch (error) {
    console.error('Erro ao verificar aprovação:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Função para gerar notificações quando:
 * - Contrato é criado/aprovado/rejeitado
 * - MediçãoContrato é criada/aprovada/rejeitada
 * - NaoConformidade é criada/atualizada/resolvida
 */

const TIPO_NOTIFICACAO = {
  CONTRATO_CRIACAO: 'contrato_aprovacao',
  CONTRATO_APROVADO: 'contrato_aprovado',
  CONTRATO_REJEITADO: 'contrato_rejeitado',
  MEDICAO_CRIACAO: 'medicao_aprovacao',
  MEDICAO_APROVADA: 'medicao_aprovada',
  MEDICAO_REJEITADA: 'medicao_rejeitada',
  NC_CRIADA: 'nc_criada',
  NC_CRITICA: 'nc_critica',
  NC_MAIOR: 'nc_maior',
  NC_RESOLVIDA: 'nc_resolvida'
};

async function notificarAprovadores(base44, event) {
  const { tipo, id, dados } = event;

  let notificacoes = [];

  // ========== CONTRATO ==========
  if (tipo === 'contrato_criado') {
    // Notificar aprovadores de contratos
    const aprovadores = await base44.asServiceRole.entities.User?.list() || [];
    const aprovadoresRelevantes = aprovadores.filter(u => 
      ['admin', 'diretoria', 'gestor_compras'].includes(u.role)
    );

    notificacoes = aprovadoresRelevantes.map(u => ({
      destinatario_email: u.email,
      tipo: TIPO_NOTIFICACAO.CONTRATO_CRIACAO,
      titulo: `Contrato ${dados.numero} aguarda aprovação`,
      mensagem: `Novo contrato criado: ${dados.numero} - ${dados.titulo || 'Sem título'}`,
      link_acao: `/MedicaoContratos`,
      usuario_relacionado_email: dados.created_by
    }));
  } else if (tipo === 'contrato_aprovado') {
    // Notificar criador
    notificacoes = [{
      destinatario_email: dados.created_by,
      tipo: TIPO_NOTIFICACAO.CONTRATO_APROVADO,
      titulo: `Contrato ${dados.numero} aprovado`,
      mensagem: `Seu contrato foi aprovado`,
      link_acao: `/MedicaoContratos`,
      usuario_relacionado_email: dados.aprovado_por
    }];
  } else if (tipo === 'contrato_rejeitado') {
    // Notificar criador
    notificacoes = [{
      destinatario_email: dados.created_by,
      tipo: TIPO_NOTIFICACAO.CONTRATO_REJEITADO,
      titulo: `Contrato ${dados.numero} rejeitado`,
      mensagem: `Contrato foi rejeitado. Motivo: ${dados.motivo_rejeicao || 'Não informado'}`,
      link_acao: `/MedicaoContratos`,
      usuario_relacionado_email: dados.rejeitado_por
    }];
  }

  // ========== MEDIÇÃO CONTRATO ==========
  else if (tipo === 'medicao_criada') {
    // Notificar aprovadores
    const aprovadores = await base44.asServiceRole.entities.User?.list() || [];
    const aprovadoresRelevantes = aprovadores.filter(u => 
      ['admin', 'diretoria', 'engenharia'].includes(u.role)
    );

    notificacoes = aprovadoresRelevantes.map(u => ({
      destinatario_email: u.email,
      tipo: TIPO_NOTIFICACAO.MEDICAO_CRIACAO,
      titulo: `Medição de contrato aguarda aprovação`,
      mensagem: `Nova medição criada e aguarda revisão`,
      link_acao: `/MedicaoContratos`,
      usuario_relacionado_email: dados.created_by
    }));
  } else if (tipo === 'medicao_aprovada') {
    notificacoes = [{
      destinatario_email: dados.created_by,
      tipo: TIPO_NOTIFICACAO.MEDICAO_APROVADA,
      titulo: `Medição aprovada`,
      mensagem: `Sua medição foi aprovada e processada`,
      link_acao: `/MedicaoContratos`,
      usuario_relacionado_email: dados.aprovado_por
    }];
  } else if (tipo === 'medicao_rejeitada') {
    notificacoes = [{
      destinatario_email: dados.created_by,
      tipo: TIPO_NOTIFICACAO.MEDICAO_REJEITADA,
      titulo: `Medição rejeitada`,
      mensagem: `Sua medição foi rejeitada`,
      link_acao: `/MedicaoContratos`,
      usuario_relacionado_email: dados.rejeitado_por
    }];
  }

  // ========== NÃO-CONFORMIDADE ==========
  else if (tipo === 'nc_criada') {
    // Notificar engenharia e qualidade
    const usuarios = await base44.asServiceRole.entities.User?.list() || [];
    const relevantes = usuarios.filter(u => 
      ['admin', 'engenharia', 'qualidade', 'mestre_obra'].includes(u.role)
    );

    const tipoNC = dados.severidade === 'crítica' ? TIPO_NOTIFICACAO.NC_CRITICA : 
                   dados.severidade === 'maior' ? TIPO_NOTIFICACAO.NC_MAIOR :
                   TIPO_NOTIFICACAO.NC_CRIADA;

    notificacoes = relevantes.map(u => ({
      destinatario_email: u.email,
      tipo: tipoNC,
      titulo: `Não-conformidade ${dados.severidade} registrada`,
      mensagem: dados.descricao.substring(0, 100),
      link_acao: `/EngenhariaeQualidade`,
      usuario_relacionado_email: dados.created_by
    }));
  } else if (tipo === 'nc_resolvida') {
    // Notificar responsável original
    notificacoes = [{
      destinatario_email: dados.responsavel_email || dados.created_by,
      tipo: TIPO_NOTIFICACAO.NC_RESOLVIDA,
      titulo: `Não-conformidade resolvida`,
      mensagem: `NC foi marcada como resolvida`,
      link_acao: `/EngenhariaeQualidade`,
      usuario_relacionado_email: dados.resolvido_por
    }];
  }

  // Salvar notificações
  for (const notif of notificacoes) {
    try {
      await base44.asServiceRole.entities.Notificacao?.create({
        ...notif,
        lida: false
      });
    } catch (error) {
      console.error('Erro ao criar notificação:', error);
    }
  }

  return notificacoes;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Método não permitido' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { tipo, id, dados } = await req.json();

    if (!tipo || !dados) {
      return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    const notificacoes = await notificarAprovadores(base44, { tipo, id, dados });

    return Response.json({
      ok: true,
      notificacoes_criadas: notificacoes.length
    });
  } catch (error) {
    console.error('Erro em gerarNotificacoes:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
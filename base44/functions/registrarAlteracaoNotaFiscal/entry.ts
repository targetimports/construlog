import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Registra alterações em campos de Nota Fiscal (auditoria)
 * Chamado após usuário editar um campo extraído pela IA
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { nf_id, campo, valor_original, valor_novo, motivo } = await req.json();

    if (!nf_id || !campo) {
      return Response.json(
        { error: 'nf_id e campo são obrigatórios' },
        { status: 400 }
      );
    }

    // Criar registro de auditoria
    const auditoria = await base44.asServiceRole.entities.LogAuditoria.create({
      acao: 'EDITAR_CAMPO_NF',
      tipo_entidade: 'NotaFiscal',
      id_entidade: nf_id,
      usuario_id: user.email,
      usuario_nome: user.full_name,
      detalhes: {
        campo,
        valor_original,
        valor_novo,
        motivo: motivo || 'Correção de dados extraídos pela IA',
      },
      timestamp: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      auditoria_id: auditoria.id,
      mensagem: `Campo "${campo}" registrado em auditoria`,
    });
  } catch (error) {
    console.error('Erro ao registrar alteração:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});
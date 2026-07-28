import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * APROVAR MEDIÇÃO: enviada → aprovada
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ ok: false, code: 'NAO_AUTORIZADO', message: 'Login necessário' }, { status: 401 });
    }
    
    const payload = await req.json();
    const { medicao_id, observacoes } = payload;
    
    if (!medicao_id) {
      return Response.json({ ok: false, code: 'VALIDACAO', message: 'medicao_id obrigatório' }, { status: 400 });
    }
    
    // Buscar medição via list e filtrar no client (evita exceção de ID inválido)
    let medicao = null;
    try {
      const medicoes = await base44.asServiceRole.entities.Medicao.list('-created_date', 200);
      medicao = (medicoes || []).find(m => m.id === medicao_id) || null;
    } catch (err) {
      console.error('[aprovarMedicaoObra] erro ao buscar:', err?.message);
    }
    
    if (!medicao) {
      return Response.json({ ok: false, code: 'RECURSO_NAO_ENCONTRADO', message: 'Medição não encontrada' }, { status: 404 });
    }
    
    if (medicao.status !== 'enviada') {
      return Response.json({ ok: false, code: 'ESTADO_INVALIDO', message: `Apenas medições 'enviada' podem ser aprovadas. Status atual: ${medicao.status}` }, { status: 409 });
    }
    
    // Atualizar medição
    await base44.asServiceRole.entities.Medicao.update(medicao_id, {
      status: 'aprovada',
      aprovado_por: user.email,
      data_aprovacao: new Date().toISOString(),
      observacoes: observacoes || medicao.observacoes
    });

    // Auditoria soft (não bloqueia)
    base44.asServiceRole.entities.LogAuditoria?.create({
      user_email: user.email,
      entidade: 'Medicao',
      entidade_id: medicao_id,
      acao: 'APROVAR',
      modulo: 'medicoes',
      detalhes: `Aprovação pelo usuário ${user.email}`,
      sucesso: true
    }).catch(() => {});
    
    return Response.json({
      ok: true,
      message: 'Medição aprovada com sucesso',
      data: { medicao_id, status: 'aprovada', aprovado_por: user.email }
    });
    
  } catch (error) {
    console.error('[aprovarMedicaoObra] erro completo:', JSON.stringify({ msg: error?.message, status: error?.status, data: error?.data }));
    return Response.json({ ok: false, code: 'ERRO_INTERNO', message: error?.message || 'Erro ao aprovar medição' }, { status: 500 });
  }
});
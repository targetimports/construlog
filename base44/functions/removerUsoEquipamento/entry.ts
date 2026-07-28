import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { registro_id } = await req.json();

    if (!registro_id) {
      return Response.json({ error: 'ID do registro obrigatório' }, { status: 400 });
    }

    const registro = await base44.asServiceRole.entities.RegistroUsoEquipamento.list();
    const reg = registro.find(r => r.id === registro_id);

    if (!reg) return Response.json({ error: 'Registro não encontrado' }, { status: 404 });

    // Deletar lançamento financeiro vinculado
    if (reg.lancamento_financeiro_id) {
      await base44.asServiceRole.entities.LancamentoFinanceiro.delete(reg.lancamento_financeiro_id);
    }

    // Deletar registro de uso
    await base44.entities.RegistroUsoEquipamento.delete(registro_id);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
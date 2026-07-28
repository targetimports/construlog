import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { diarioId, motivos } = await req.json();

    if (!diarioId || !Array.isArray(motivos)) {
      return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    // Buscar motivos atuais do diário
    const motivosAtuais = await base44.entities.DiarioObraMotivo.filter({ diario_id: diarioId });

    // Deletar motivos desmarcados
    const motivosParaDeletar = motivosAtuais.filter(m => !motivos.find(x => x.id === m.motivo_id));
    for (const motivo of motivosParaDeletar) {
      await base44.entities.DiarioObraMotivo.delete(motivo.id);
    }

    // Criar/atualizar motivos selecionados
    for (const motivo of motivos) {
      const jaExiste = motivosAtuais.find(m => m.motivo_id === motivo.id);

      if (jaExiste) {
        // Atualizar observação se mudou
        if (jaExiste.observacao !== motivo.observacao) {
          await base44.entities.DiarioObraMotivo.update(jaExiste.id, {
            observacao: motivo.observacao || null
          });
        }
      } else {
        // Criar novo
        await base44.entities.DiarioObraMotivo.create({
          diario_id: diarioId,
          motivo_id: motivo.id,
          observacao: motivo.observacao || null
        });
      }
    }

    return Response.json({
      message: 'Motivos salvos com sucesso',
      total: motivos.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
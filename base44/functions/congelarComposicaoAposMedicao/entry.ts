import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { medicao_id } = await req.json();

    if (!medicao_id) {
      return Response.json({ error: 'medicao_id obrigatório' }, { status: 400 });
    }

    // Buscar medição
    const medicoes = await base44.entities.Medicao.filter({ id: medicao_id });
    if (!medicoes || medicoes.length === 0) {
      return Response.json({ error: 'Medição não encontrada' }, { status: 404 });
    }

    const medicao = medicoes[0];

    // Congelar composição
    if (medicao.composicao_id) {
      const composicoes = await base44.entities.Composicao.filter({ id: medicao.composicao_id });
      if (composicoes && composicoes.length > 0) {
        const composicao = composicoes[0];
        
        // Incrementar contador de medições e congelar se não estava
        const novasMedicoes = (composicao.medicoes_confirmadas || 0) + 1;
        
        await base44.entities.Composicao.update(medicao.composicao_id, {
          medicoes_confirmadas: novasMedicoes,
          congelada: true
        });

        return Response.json({
          sucesso: true,
          composicao_id: medicao.composicao_id,
          mensagem: `Composição congelada. ${novasMedicoes} medição(ões) confirmada(s).`,
          congelada: true
        });
      }
    }

    return Response.json({ sucesso: false, mensagem: 'Composição não identificada' });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
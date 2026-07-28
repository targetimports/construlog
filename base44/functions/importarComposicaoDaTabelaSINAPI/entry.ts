import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { codigo_sinapi } = await req.json();

    if (!codigo_sinapi) {
      return Response.json({ error: 'codigo_sinapi is required' }, { status: 400 });
    }

    // TODO: Se tiver TabelaSINAPI, buscar lá
    // Por enquanto, criamos composição manual com origem SINAPI

    const novaComp = await base44.entities.Composicao.create({
      codigo: codigo_sinapi,
      descricao: `Composição SINAPI ${codigo_sinapi}`,
      unidade: 'un',
      tipo: 'servico',
      origem: 'sinapi',
      status: 'bloqueado',
      atualizado_por: user.email
    });

    return Response.json({
      status: 'sucesso',
      composicao_id: novaComp.id,
      composicao: novaComp,
      mensagem: 'Composição SINAPI criada. Adicione itens manualmente ou via importação de tabela.'
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
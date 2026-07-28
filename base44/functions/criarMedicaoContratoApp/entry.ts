import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();

    // Chamar a função criarMedicaoContrato internamente
    const response = await base44.functions.invoke('criarMedicaoContrato', payload);

    return Response.json(response.data);

  } catch (error) {
    console.error('Erro ao criar medição de contrato via app:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
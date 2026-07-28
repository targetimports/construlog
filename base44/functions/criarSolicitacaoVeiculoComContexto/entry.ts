import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { tipo_vinculo = 'obra', ...dados } = payload;

    // Validar obrigatoriedade da obra se tipo_vinculo == 'obra'
    let obra_id = dados.obra_id;
    let cliente_id = dados.cliente_id;

    if (tipo_vinculo === 'obra') {
      // Tentar carregar contexto do usuário
      const contextos = await base44.entities.ContextoUsuario.filter({
        user_email: user.email
      });
      
      const contexto = contextos[0];
      if (contexto?.obra_atual_id) {
        obra_id = contexto.obra_atual_id;
        cliente_id = contexto.cliente_atual_id;
      }

      // Se ainda não tiver obra, rejeitar
      if (!obra_id) {
        return Response.json(
          { error: 'Selecione uma Obra no menu superior para criar solicitação de tipo "Obra"' },
          { status: 400 }
        );
      }
    }

    // Gerar número sequencial
    const solicitacoes = await base44.entities.SolicitacaoVeiculo.list('-created_date', 1);
    const ultimaNum = solicitacoes[0]?.numero ? parseInt(solicitacoes[0].numero.split('-')[1]) : 0;
    const numero = `SV-${String(ultimaNum + 1).padStart(6, '0')}`;

    // Criar solicitação
    const solicitacao = await base44.entities.SolicitacaoVeiculo.create({
      numero,
      solicitante_user_id: user.email,
      tipo_vinculo,
      obra_id: obra_id || null,
      cliente_id: cliente_id || null,
      ...dados,
      status: 'rascunho'
    });

    return Response.json({
      success: true,
      solicitacao
    });
  } catch (error) {
    console.error('Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
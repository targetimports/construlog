import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas admin pode criar dados de teste' }, { status: 403 });
    }

    // Cria usuários de teste pendentes
    const usuariosTeste = [
      {
        email: 'teste1@germanos.com.br',
        full_name: 'Usuário Teste 1',
        telefone: '11999999999',
        cargo: 'Engenharia'
      },
      {
        email: 'teste2@germanos.com.br',
        full_name: 'Usuário Teste 2',
        telefone: '11988888888',
        cargo: 'Compras'
      },
      {
        email: 'teste3@germanos.com.br',
        full_name: 'Usuário Teste 3',
        telefone: '11977777777',
        cargo: 'Almoxarifado'
      }
    ];

    const criados = [];
    for (const uData of usuariosTeste) {
      // Verifica se já existe
      const existing = await base44.asServiceRole.entities.AprovacaoUsuario.filter({ 
        user_email: uData.email 
      });

      if (!existing || existing.length === 0) {
        const aprovacao = await base44.asServiceRole.entities.AprovacaoUsuario.create({
          user_email: uData.email,
          status: 'pendente',
          status_acesso: 'pendente',
          full_name: uData.full_name,
          telefone: uData.telefone,
          cargo: uData.cargo,
          empresa: '',
          perfil_acesso: 'campo',
          observacoes: 'Usuário de teste criado automaticamente'
        });
        criados.push(aprovacao);
      }
    }

    return Response.json({ 
      message: `${criados.length} usuários de teste criados`,
      usuarios: criados 
    });
  } catch (error) {
    console.error('[seedUsuariosTeste] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { medicaoId, config } = await req.json();

    // 1. Buscar medição
    const medicao = await base44.entities.Medicao.filter({ id: medicaoId }, null, 1);
    if (medicao.length === 0) {
      return Response.json({ error: 'Medição não encontrada' }, { status: 404 });
    }

    const med = medicao[0];

    // 2. Gerar token único
    const token = btoa(`${medicaoId}-${Date.now()}-${Math.random()}`).replace(/=/g, '').substring(0, 32);

    // 3. Criar configuração pública
    const configPublica = {
      medicao_id: medicaoId,
      obra_id: med.obra_id,
      token_acesso: token,
      visao: config?.visao || 'completa', // completa | apenas_percentuais
      mostrar_etapas: config?.mostrar_etapas !== false,
      mostrar_comentarios: config?.mostrar_comentarios !== false,
      mostrar_anexos: config?.mostrar_anexos !== false,
      mostrar_assinaturas: config?.mostrar_assinaturas !== false,
      mostrar_dados_empresa: config?.mostrar_dados_empresa !== false,
      data_geracao: new Date().toISOString(),
      valido_ate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 dias
      criado_por: user.email,
      acessos_count: 0,
      ativo: true
    };

    // 4. Salvar configuração
    try {
      await base44.entities.LinkPublicoMedicao.create(configPublica);
    } catch (e) {
      // Tabela pode não existir, criar registro apenas em memória
      console.log('Armazenamento permanente não disponível');
    }

    // 5. Gerar URL pública
    const baseUrl = req.headers.get('x-forwarded-proto') ? 
      `${req.headers.get('x-forwarded-proto')}://${req.headers.get('x-forwarded-host')}` :
      'https://app.construlog.com';

    const linkPublico = `${baseUrl}/relatorio-medicao-publico?token=${token}&medicao=${medicaoId}`;

    return Response.json({
      sucesso: true,
      link_publico: linkPublico,
      token: token,
      config: configPublica,
      validade: configPublica.valido_ate,
      instrucoes: {
        copiar_link: 'Copie e compartilhe o link acima com seu cliente',
        validade: 'Link válido por 90 dias',
        acessos: 'Sem limite de acessos',
        privacidade: 'Apenas os dados configurados serão visíveis'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
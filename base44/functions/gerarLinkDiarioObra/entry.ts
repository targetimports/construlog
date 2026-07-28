import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { diarioId, periodo, config } = await req.json();

    // 1. Gerar token
    const token = btoa(`${diarioId}-${Date.now()}-${Math.random()}`).replace(/=/g, '').substring(0, 32);

    // 2. Configuração do link
    const linkConfig = {
      diario_id: diarioId,
      token_acesso: token,
      tipo_periodo: periodo?.tipo || 'individual', // individual | periodo | ilimitado
      data_inicio: periodo?.inicio,
      data_fim: periodo?.fim,
      visao_titulo: config?.titulo || 'Relatório Diário de Obras',
      mostrar_obra: config?.mostrar_obra !== false,
      mostrar_cliente: config?.mostrar_cliente !== false,
      mostrar_clima: config?.mostrar_clima !== false,
      mostrar_mao_obra: config?.mostrar_mao_obra !== false,
      mostrar_equipamentos: config?.mostrar_equipamentos !== false,
      mostrar_ocorrencias: config?.mostrar_ocorrencias !== false,
      mostrar_comentarios: config?.mostrar_comentarios !== false,
      mostrar_fotos: config?.mostrar_fotos !== false,
      mostrar_assinaturas: config?.mostrar_assinaturas !== false,
      data_geracao: new Date().toISOString(),
      valido_ate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      criado_por: user.email,
      acessos: 0,
      ativo: true
    };

    // 3. URL pública
    const baseUrl = 'https://app.construlog.com';
    const linkPublico = `${baseUrl}/relatorio-diario-publico?token=${token}&diario=${diarioId}`;

    return Response.json({
      sucesso: true,
      link_publico: linkPublico,
      token,
      config: linkConfig,
      compartilhamento: {
        whatsapp: `https://wa.me/?text=${encodeURIComponent(`Confira o diário: ${linkPublico}`)}`,
        email_subject: 'Relatório Diário de Obras',
        email_body: `Acesse o relatório: ${linkPublico}`
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
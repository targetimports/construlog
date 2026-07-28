import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { titulo, tipo, data_inicio, data_fim, prioridade, descricao, local, obra_id } = body;

    if (!titulo || !data_inicio) {
      return Response.json({ error: 'Dados do evento obrigatórios' }, { status: 400 });
    }

    // Buscar nome da obra se vinculada
    let nomeObra = '';
    if (obra_id) {
      const obra = await base44.entities.Obra.list();
      const obraEncontrada = obra.find(o => o.id === obra_id);
      nomeObra = obraEncontrada?.nome || obra_id;
    }

    // Formatar datas para exibição
    const dataFormatada = new Date(data_inicio).toLocaleDateString('pt-BR');
    const dataFimFormatada = data_fim ? new Date(data_fim).toLocaleDateString('pt-BR') : '';

    // Montar corpo do email
    const corpo = `
    <h2>Novo Evento Agendado</h2>
    <p><strong>Título:</strong> ${titulo}</p>
    <p><strong>Tipo:</strong> ${tipo}</p>
    <p><strong>Data Início:</strong> ${dataFormatada}</p>
    ${dataFimFormatada ? `<p><strong>Data Fim:</strong> ${dataFimFormatada}</p>` : ''}
    <p><strong>Prioridade:</strong> ${prioridade}</p>
    ${local ? `<p><strong>Local:</strong> ${local}</p>` : ''}
    ${nomeObra ? `<p><strong>Obra:</strong> ${nomeObra}</p>` : ''}
    ${descricao ? `<p><strong>Descrição:</strong> ${descricao}</p>` : ''}
    <p><strong>Criado por:</strong> ${user.full_name} (${user.email})</p>
    <p><em>Acesse a agenda para mais detalhes.</em></p>
    `;

    // Enviar email
    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: `Novo evento agendado: ${titulo}`,
      body: corpo
    });

    return Response.json({ 
      success: true, 
      message: 'Email enviado com sucesso' 
    });
  } catch (error) {
    console.error('[enviarEmailNovoEvento] Error:', error);
    // Fallback: não bloquear frontend se email falhar
    return Response.json({
      success: true,
      message: 'Evento criado (email não enviado)',
      source: 'fallback'
    }, { status: 200 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const {
      nome,
      obra_id,
      tipo_relatorio,
      frequencia,
      dia_semana,
      dia_mes,
      hora_envio,
      stakeholders,
      incluir_progresso,
      incluir_custos,
      incluir_cronograma,
      incluir_alertas,
      formatos_exportacao
    } = payload;

    // Validar dados obrigatórios
    if (!nome || !obra_id || !tipo_relatorio || !frequencia || !hora_envio || !stakeholders?.length) {
      return Response.json(
        { error: 'Campos obrigatórios faltando' },
        { status: 400 }
      );
    }

    // Buscar obra para validar
    const obra = await base44.entities.Obra.read(obra_id);
    if (!obra) {
      return Response.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    // Calcular próximo envio
    const now = new Date();
    let proximoEnvio = new Date();
    const [hora, minuto] = hora_envio.split(':').map(Number);
    proximoEnvio.setHours(hora, minuto, 0, 0);

    if (frequencia === 'semanal' && dia_semana !== undefined) {
      const diaAtual = now.getDay();
      let diasAteEnvio = (dia_semana - diaAtual + 7) % 7;
      if (diasAteEnvio === 0 && proximoEnvio <= now) diasAteEnvio = 7;
      proximoEnvio.setDate(proximoEnvio.getDate() + diasAteEnvio);
    } else if (frequencia === 'mensal' && dia_mes !== undefined) {
      proximoEnvio.setDate(dia_mes);
      if (proximoEnvio <= now) {
        proximoEnvio.setMonth(proximoEnvio.getMonth() + 1);
      }
    }

    // Criar agendamento
    const relatorio = await base44.entities.RelatorioAgendado.create({
      nome,
      obra_id,
      obra_nome: obra.nome,
      tipo_relatorio,
      frequencia,
      dia_semana,
      dia_mes,
      hora_envio,
      stakeholders,
      incluir_progresso: incluir_progresso !== false,
      incluir_custos: incluir_custos !== false,
      incluir_cronograma: incluir_cronograma !== false,
      incluir_alertas: incluir_alertas !== false,
      formatos_exportacao: formatos_exportacao || ['pdf'],
      ativa: true,
      proximo_envio: proximoEnvio.toISOString(),
      criado_por: user.email
    });

    return Response.json({
      success: true,
      relatorio,
      mensagem: 'Relatório agendado com sucesso'
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});
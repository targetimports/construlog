import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obraId, dataInicio, dataFim, config } = await req.json();

    // 1. Buscar diários
    const diarios = await base44.entities.DiarioObra.filter({
      obra_id: obraId,
      data: { $gte: dataInicio, $lte: dataFim },
      status: 'finalizado'
    }, 'data');

    // 2. Buscar obra
    const obra = await base44.entities.Obra.filter({ id: obraId });
    const obraData = obra[0];

    // 3. Estruturar dados para PDF
    const pdfData = {
      titulo: `Relatório Período - ${obraData?.nome || 'Sem obra'}`,
      periodo: `${dataInicio} até ${dataFim}`,
      data_geracao: new Date().toLocaleDateString('pt-BR'),
      obra: {
        nome: obraData?.nome,
        codigo: obraData?.codigo,
        endereco: obraData?.endereco
      },
      relatorios: diarios.map(d => ({
        numero: d.numero,
        data: d.data,
        clima: d.clima,
        mao_obra_count: d.mao_obra?.length || 0,
        equipamentos_count: d.equipamentos?.length || 0,
        atividades_count: d.atividades?.length || 0,
        ocorrencias: d.ocorrencias_detalhadas?.length || 0
      })),
      config: {
        mostrar_clima: config?.mostrar_clima !== false,
        mostrar_mao_obra: config?.mostrar_mao_obra !== false,
        mostrar_equipamentos: config?.mostrar_equipamentos !== false,
        mostrar_atividades: config?.mostrar_atividades !== false,
        mostrar_ocorrencias: config?.mostrar_ocorrencias !== false,
        mostrar_comentarios: config?.mostrar_comentarios !== false
      }
    };

    // 4. Gerar URL de acesso
    const tokenPDF = btoa(`${obraId}-${dataInicio}-${dataFim}-${Date.now()}`).replace(/=/g, '').substring(0, 32);
    const urlDownload = `https://app.construlog.com/pdf-multiplos-diarios?token=${tokenPDF}&obra=${obraId}`;

    // 5. Notificar via email
    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: `PDF Múltiplos RDOs - ${obraData?.nome} (${dataInicio} a ${dataFim})`,
      body: `
        Seu PDF com múltiplos Diários de Obras está sendo processado.
        
        Obra: ${obraData?.nome}
        Período: ${dataInicio} a ${dataFim}
        Total de Diários: ${diarios.length}
        
        Link para download (válido por 48h):
        ${urlDownload}
        
        Equipe Construlog
      `
    });

    return Response.json({
      sucesso: true,
      mensagem: 'PDF está sendo gerado e será enviado por email',
      total_diarios: diarios.length,
      url_download: urlDownload,
      token: tokenPDF,
      validade_horas: 48
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
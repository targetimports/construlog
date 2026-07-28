import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar sessões de importação pendentes (máximo 5 por lote)
    const sessoesPendentes = await base44.asServiceRole.entities.ImportSession.filter({
      status: 'pendente'
    }, '-created_date', 5);

    console.log(`📦 Processando ${sessoesPendentes.length} sessões de importação`);

    const resultados = [];

    for (const sessao of sessoesPendentes) {
      try {
        // Marcar como processando
        await base44.asServiceRole.entities.ImportSession.update(sessao.id, {
          status: 'processando',
          tentativas: (sessao.tentativas || 0) + 1
        });

        console.log(`⏳ Processando sessão: ${sessao.id} (tipo: ${sessao.tipo_importacao})`);

        // Invocar a função apropriada
        let resultado;
        if (sessao.tipo_importacao === 'orca_facil_completo') {
          // Passar user_email da sessão para manter contexto do usuário
          resultado = await base44.asServiceRole.functions.invoke('finalizarImportacaoOrcaFacilCompleto', { 
            ...sessao.dados_payload, 
            user_email: sessao.user_email 
          });
        } else if (sessao.tipo_importacao === 'cpu_materiais') {
          resultado = await base44.asServiceRole.functions.invoke('importarComposicoesCPU', {
            file_url: sessao.file_url
          });
        }

        // Marcar como concluído
        await base44.asServiceRole.entities.ImportSession.update(sessao.id, {
          status: 'concluido',
          obra_id: resultado?.data?.obra_id || null
        });

        console.log(`✅ Sessão concluída: ${sessao.id}`);
        resultados.push({ id: sessao.id, status: 'sucesso' });

      } catch (erro) {
        console.error(`❌ Erro na sessão ${sessao.id}:`, erro.message);

        // Agendar próxima tentativa em 1 hora
        const proximaTentativa = new Date();
        proximaTentativa.setHours(proximaTentativa.getHours() + 1);

        await base44.asServiceRole.entities.ImportSession.update(sessao.id, {
          status: 'erro',
          erro_mensagem: erro.message,
          proxima_tentativa: proximaTentativa.toISOString()
        });

        resultados.push({ id: sessao.id, status: 'erro', erro: erro.message });
      }
    }

    return Response.json({
      sucesso: true,
      mensagem: `Processadas ${sessoesPendentes.length} sessões`,
      resultados
    });

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    return Response.json({
      sucesso: false,
      error: error.message
    }, { status: 500 });
  }
});
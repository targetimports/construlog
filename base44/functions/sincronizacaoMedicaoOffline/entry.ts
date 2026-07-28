import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { medicacoesPendentes = [], acao = 'sincronizar' } = await req.json();

    const resultados = {
      sucesso: [],
      erros: [],
      avisos: []
    };

    // 1. Processar cada medição pendente
    for (const med of medicacoesPendentes) {
      try {
        // Validar dados mínimos
        if (!med.obra_id || !med.numero || !med.itens) {
          resultados.erros.push({
            medicacao: med.numero,
            motivo: 'Dados incompletos'
          });
          continue;
        }

        // Criar/atualizar medição
        if (med.id) {
          await base44.entities.Medicao.update(med.id, {
            ...med,
            data_sincronizacao: new Date().toISOString(),
            sincronizado_offline: false
          });
          resultados.sucesso.push({
            medicacao: med.numero,
            acao: 'atualizada',
            id: med.id
          });
        } else {
          const criada = await base44.entities.Medicao.create({
            ...med,
            data_sincronizacao: new Date().toISOString(),
            status: 'rascunho'
          });
          resultados.sucesso.push({
            medicacao: med.numero,
            acao: 'criada',
            id: criada.id
          });
        }

      } catch (erro) {
        resultados.erros.push({
          medicacao: med.numero,
          motivo: erro.message
        });
      }
    }

    // 2. Log de sincronização
    const log = {
      usuario: user.email,
      data_sincronizacao: new Date().toISOString(),
      total_processadas: medicacoesPendentes.length,
      total_sucesso: resultados.sucesso.length,
      total_erros: resultados.erros.length
    };

    return Response.json({
      sucesso: resultados.sucesso.length === medicacoesPendentes.length,
      resultados,
      log
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
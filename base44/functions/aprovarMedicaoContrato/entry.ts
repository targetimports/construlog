import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const build_id = Math.random().toString(36).substr(2, 9);
  let tentativa = 0;
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { medicao_id } = await req.json();

    if (!medicao_id) return Response.json({ error: 'medicao_id obrigatório' }, { status: 400 });

    // RULE 1: Sempre usar get() para leitura de 1 registro
    const medicaoAtual = await base44.asServiceRole.entities.MedicaoContrato.get(medicao_id);
    if (!medicaoAtual) return Response.json({ error: 'Medição não encontrada' }, { status: 404 });

    const status_before = medicaoAtual.status;

    if (medicaoAtual.status !== 'rascunho') {
      return Response.json({ 
        error: `Medição deve estar em rascunho, mas está em ${medicaoAtual.status}`,
        build_id,
        expected: 'rascunho',
        got: medicaoAtual.status
      }, { status: 400 });
    }

    const dataAgora = new Date().toISOString();
    
    // RULE 2: Retry loop para garantir persistência
    let medicaoAtualizada = null;
    let status_after = null;
    
    for (tentativa = 1; tentativa <= 2; tentativa++) {
      medicaoAtualizada = await base44.asServiceRole.entities.MedicaoContrato.update(medicao_id, {
        status: 'aprovada',
        data_aprovacao: dataAgora,
        aprovado_por: user.email
      });

      // RULE 2: Confirmar persistência com get()
      const medicaoConfirm = await base44.asServiceRole.entities.MedicaoContrato.get(medicao_id);
      
      if (medicaoConfirm && medicaoConfirm.status === 'aprovada') {
        status_after = medicaoConfirm.status;
        medicaoAtualizada = medicaoConfirm;
        break;
      }
      
      if (tentativa === 2) {
        return Response.json({
          error: 'PERSISTENCE_FAILED',
          message: 'Falha na persistência do status após 2 tentativas',
          build_id,
          tentativa,
          status_before,
          status_after: medicaoConfirm?.status
        }, { status: 500 });
      }
    }

    // Auditoria
    await base44.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'aprovar',
      modulo: 'contratos',
      entidade: 'MedicaoContrato',
      entidade_id: medicao_id,
      dados_anteriores: medicaoAtual,
      dados_novos: medicaoAtualizada,
      detalhes: `Medição aprovada: ${medicaoAtualizada.titulo}`,
      sucesso: true
    });

    return Response.json({ 
      ok: true, 
      medicao: medicaoAtualizada,
      build_id,
      tentativa,
      status_before,
      status_after
    });
  } catch (error) {
    return Response.json({ error: error.message, build_id, tentativa }, { status: 500 });
  }
});
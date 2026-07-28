import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Gerenciador de membros de equipe (V2 - com EquipeMembro)
 * Source of truth: EquipeMembro (tabela de vínculo)
 * Operações:
 * - add: adicionar membro
 * - remove: remover membro
 * - replace: substituir membro
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, equipe_id, colaborador_id, colaborador_antigo_id } = body;

    if (!equipe_id || !colaborador_id) {
      return Response.json({
        ok: false,
        error: 'Missing equipe_id or colaborador_id'
      }, { status: 400 });
    }

    // ============ HELPERS ============
    const validarColaborador = async (colabId, exigirAtivo = true) => {
      const colaboradores = await base44.asServiceRole.entities.Colaborador.filter({ id: colabId });
      if (!colaboradores || colaboradores.length === 0) {
        throw new Error(`Colaborador ${colabId} not found`);
      }
      const colab = colaboradores[0];
      if (exigirAtivo && colab.status !== 'ativo') {
        throw new Error(`COLABORADOR_INACTIVE: status=${colab.status}`);
      }
      return colab;
    };

    const registrarAuditoria = async (acao, dados) => {
      const { logAuditoria } = await import('./_lib/logAuditoria.js');
      await logAuditoria(base44, {
        entidade_tipo: 'EquipeMembro',
        entidade_id: equipe_id,
        acao,
        resumo: `Gestão equipe: ${acao}`,
        dados_novos: dados,
        user_email: user.email,
        role: user.cargo,
        origem: 'ui',
        modulo: 'equipes'
      });
    };

    const recalcularColaboradores = async () => {
      try {
        await base44.functions.invoke('recalcularColaboradoresIdsEquipe', { equipe_id });
      } catch (err) {
        console.warn('[RECALC] Erro ao recalcular:', err.message);
      }
    };

    // ============ ACTION: ADD ============
    if (action === 'add') {
      console.log(`[ADD] Iniciando: equipe_id=${equipe_id}, colaborador_id=${colaborador_id}`);

      const colaborador = await validarColaborador(colaborador_id, true);
      const uniqueKey = `${equipe_id}:${colaborador_id}`;

      // Buscar vínculo existente
      const vinculos = await base44.asServiceRole.entities.EquipeMembro.filter({
        unique_key: uniqueKey
      });

      if (vinculos && vinculos.length > 0) {
        const vinculo = vinculos[0];

        if (vinculo.status === 'ativo') {
          // NOOP
          console.log(`[ADD] NOOP: ${colaborador.nome} já está ativo na equipe`);
          await registrarAuditoria('ADD_NOOP', {
            colaborador_id,
            motivo: 'já_ativo'
          });
          return Response.json({
            ok: true,
            noop: true,
            message: `${colaborador.nome} já está na equipe`,
            equipe_id,
            colaborador_id
          });
        } else if (vinculo.status === 'removido') {
          // Reativar
          console.log(`[ADD] Reativando ${colaborador.nome}`);
          await base44.asServiceRole.entities.EquipeMembro.update(vinculo.id, {
            status: 'ativo',
            removed_by: null,
            removed_date: null,
            removal_reason: null
          });

          await recalcularColaboradores();
          await registrarAuditoria('ADD_REATIVAR', { colaborador_id });

          return Response.json({
            ok: true,
            message: `${colaborador.nome} readicionado à equipe`,
            equipe_id,
            colaborador_id
          });
        }
      }

      // Criar novo vínculo
      console.log(`[ADD] Criando novo vínculo`);
      const novoVinculo = await base44.asServiceRole.entities.EquipeMembro.create({
        equipe_id,
        colaborador_id,
        unique_key: uniqueKey,
        status: 'ativo'
      });

      console.log(`[ADD] Vínculo criado: ${novoVinculo.id}`);

      await recalcularColaboradores();
      await registrarAuditoria('ADD', { colaborador_id });

      return Response.json({
        ok: true,
        message: `${colaborador.nome} adicionado à equipe`,
        equipe_id,
        colaborador_id,
        vinculo_id: novoVinculo.id
      });
    }

    // ============ ACTION: REMOVE ============
    else if (action === 'remove') {
      console.log(`[REMOVE] Iniciando: equipe_id=${equipe_id}, colaborador_id=${colaborador_id}`);

      const colaborador = await validarColaborador(colaborador_id, false);
      const uniqueKey = `${equipe_id}:${colaborador_id}`;

      const vinculos = await base44.asServiceRole.entities.EquipeMembro.filter({
        unique_key: uniqueKey
      });

      if (!vinculos || vinculos.length === 0 || vinculos[0].status === 'removido') {
        return Response.json({
          ok: false,
          error: 'COLABORADOR_NOT_IN_TEAM',
          message: 'Colaborador não está nessa equipe'
        }, { status: 422 });
      }

      const vinculo = vinculos[0];

      // Marcar como removido
      console.log(`[REMOVE] Marcando como removido`);
      await base44.asServiceRole.entities.EquipeMembro.update(vinculo.id, {
        status: 'removido',
        removed_by: user.email,
        removed_date: new Date().toISOString(),
        removal_reason: 'manual'
      });

      await recalcularColaboradores();
      await registrarAuditoria('REMOVE', { colaborador_id });

      return Response.json({
        ok: true,
        message: `${colaborador.nome} removido da equipe`,
        equipe_id,
        colaborador_id
      });
    }

    // ============ ACTION: REPLACE ============
    else if (action === 'replace') {
      console.log(`[REPLACE] Iniciando: old=${colaborador_antigo_id}, new=${colaborador_id}`);

      if (!colaborador_antigo_id) {
        return Response.json({
          ok: false,
          error: 'Missing colaborador_antigo_id'
        }, { status: 400 });
      }

      const novoColab = await validarColaborador(colaborador_id, true);
      const colabAntigo = await validarColaborador(colaborador_antigo_id, false);

      const uniqueKeyAntiga = `${equipe_id}:${colaborador_antigo_id}`;
      const vinculosAntigos = await base44.asServiceRole.entities.EquipeMembro.filter({
        unique_key: uniqueKeyAntiga
      });

      if (!vinculosAntigos || vinculosAntigos.length === 0 || vinculosAntigos[0].status === 'removido') {
        return Response.json({
          ok: false,
          error: 'COLABORADOR_ANTIGO_NOT_IN_TEAM',
          message: 'Colaborador antigo não está nessa equipe'
        }, { status: 422 });
      }

      const vinculoAntigo = vinculosAntigos[0];

      // 1. Remover antigo
      console.log(`[REPLACE] Removendo ${colabAntigo.nome}`);
      await base44.asServiceRole.entities.EquipeMembro.update(vinculoAntigo.id, {
        status: 'removido',
        removed_by: user.email,
        removed_date: new Date().toISOString(),
        removal_reason: 'manual'
      });

      // 2. Adicionar novo (ou reativar se existir)
      const uniqueKeyNova = `${equipe_id}:${colaborador_id}`;
      const vinculosNovos = await base44.asServiceRole.entities.EquipeMembro.filter({
        unique_key: uniqueKeyNova
      });

      if (vinculosNovos && vinculosNovos.length > 0 && vinculosNovos[0].status === 'removido') {
        console.log(`[REPLACE] Reativando ${novoColab.nome}`);
        await base44.asServiceRole.entities.EquipeMembro.update(vinculosNovos[0].id, {
          status: 'ativo',
          removed_by: null,
          removed_date: null,
          removal_reason: null
        });
      } else if (!vinculosNovos || vinculosNovos.length === 0) {
        console.log(`[REPLACE] Criando novo vínculo para ${novoColab.nome}`);
        await base44.asServiceRole.entities.EquipeMembro.create({
          equipe_id,
          colaborador_id,
          unique_key: uniqueKeyNova,
          status: 'ativo'
        });
      }

      await recalcularColaboradores();
      await registrarAuditoria('REPLACE', {
        colaborador_antigo_id,
        colaborador_novo_id: colaborador_id
      });

      return Response.json({
        ok: true,
        message: `${colabAntigo.nome} substituído por ${novoColab.nome}`,
        equipe_id,
        colaborador_id
      });
    }

    return Response.json({ ok: false, error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[ERROR] gerenciadorEquipesV2:', error);
    const errorMsg = error.message || error.toString();

    if (errorMsg.includes('COLABORADOR_INACTIVE')) {
      return Response.json({
        ok: false,
        error: 'COLABORADOR_INACTIVE',
        message: 'Colaborador não está ativo'
      }, { status: 422 });
    }

    if (errorMsg.includes('not found')) {
      return Response.json({
        ok: false,
        error: 'NOT_FOUND',
        message: errorMsg
      }, { status: 404 });
    }

    return Response.json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: errorMsg
    }, { status: 500 });
  }
});
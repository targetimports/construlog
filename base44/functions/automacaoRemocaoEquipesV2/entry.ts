import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Automação: ao mudar Colaborador.status para != "ativo", remover de todas equipes
 * Dispara quando Colaborador é atualizado
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { event } = body;

    if (!event || event.type !== 'update' || event.entity_name !== 'Colaborador') {
      return Response.json({ ok: true, message: 'Not a Colaborador update, skipping' });
    }

    const colaborador_id = event.entity_id;
    const { data, old_data } = body;

    // Verificar se status mudou para inativo
    const statusAnterior = old_data?.status;
    const statusNovo = data?.status;

    const estadosAtivos = ['ativo'];
    const eraAtivo = statusAnterior && estadosAtivos.includes(statusAnterior);
    const aguraInativo = statusNovo && !estadosAtivos.includes(statusNovo);

    console.log(`[AUTO] Colaborador ${colaborador_id}: ${statusAnterior} => ${statusNovo}`);

    if (!eraAtivo || !aguraInativo) {
      console.log(`[AUTO] Sem mudança relevante, saindo`);
      return Response.json({ ok: true, message: 'Status change not relevant' });
    }

    console.log(`[AUTO] Colaborador ficou inativo, removendo de equipes...`);

    // 1. Listar todos os EquipeMembro ativos desse colaborador
    const vinculos = await base44.asServiceRole.entities.EquipeMembro.filter({
      colaborador_id,
      status: 'ativo'
    });

    console.log(`[AUTO] Encontrados ${vinculos.length} vínculos ativos`);

    const equipesAfetadas = new Set();

    // 2. Marcar todos como removidos
    for (const vinculo of vinculos) {
      console.log(`[AUTO] Removendo vinculo ${vinculo.id} da equipe ${vinculo.equipe_id}`);

      await base44.asServiceRole.entities.EquipeMembro.update(vinculo.id, {
        status: 'removido',
        removed_by: 'SYSTEM',
        removed_date: new Date().toISOString(),
        removal_reason: 'auto_colaborador_inativo'
      });

      equipesAfetadas.add(vinculo.equipe_id);
    }

    console.log(`[AUTO] ${equipesAfetadas.size} equipes afetadas`);

    // 3. Recalcular colaboradores_ids para cada equipe
    for (const equipe_id of equipesAfetadas) {
      console.log(`[AUTO] Recalculando equipe ${equipe_id}`);
      try {
        await base44.functions.invoke('recalcularColaboradoresIdsEquipe', { equipe_id });
      } catch (err) {
        console.warn(`[AUTO] Erro ao recalcular ${equipe_id}:`, err.message);
      }
    }

    // 4. Registrar auditoria (util central)
    const { logAuditoria } = await import('./_lib/logAuditoria.js');
    await logAuditoria(base44, {
      entidade_tipo: 'Colaborador',
      entidade_id: colaborador_id,
      acao: 'AUTO',
      resumo: `Remoção automática de ${vinculos.length} equipes (colaborador inativo)`,
      dados_anteriores: { status: statusAnterior },
      dados_novos: { 
        status: statusNovo, 
        vinculos_removidos: vinculos.length,
        equipes_afetadas: Array.from(equipesAfetadas)
      },
      user_email: 'SYSTEM',
      role: 'system',
      origem: 'automacao',
      modulo: 'equipes'
    });

    return Response.json({
      ok: true,
      colaborador_id,
      vinculos_removidos: vinculos.length,
      equipes_afetadas: Array.from(equipesAfetadas)
    });

  } catch (error) {
    console.error('[ERROR] automacaoRemocaoEquipesV2:', error);
    return Response.json({
      ok: false,
      error: error.message
    }, { status: 500 });
  }
});
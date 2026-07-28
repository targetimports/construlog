import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Migração 1x: Equipe.colaboradores_ids => EquipeMembro
 * Executa uma única vez para popular EquipeMembro a partir dos arrays atuais
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({
        ok: false,
        error: 'Forbidden: Admin only'
      }, { status: 403 });
    }

    console.log('[MIGR] Iniciando migração...');

    // 1. Listar todas as equipes
    const equipes = await base44.asServiceRole.entities.Equipe.list();
    console.log(`[MIGR] Total de equipes: ${equipes.length}`);

    let totalVinculos = 0;
    let equipesProcessadas = 0;

    // 2. Para cada equipe
    for (const equipe of equipes) {
      console.log(`[MIGR] Processando equipe: ${equipe.nome} (${equipe.id})`);

      const idsNoArray = equipe.colaboradores_ids || [];
      console.log(`[MIGR]   - Membros no array: ${idsNoArray.length}`);

      if (idsNoArray.length === 0) {
        console.log(`[MIGR]   - Sem membros, pulando`);
        equipesProcessadas++;
        continue;
      }

      // 3. Para cada ID no array, criar EquipeMembro se não existir
      for (const colaborador_id of idsNoArray) {
        const uniqueKey = `${equipe.id}:${colaborador_id}`;

        // Verificar se já existe
        const existentes = await base44.asServiceRole.entities.EquipeMembro.filter({
          unique_key: uniqueKey
        });

        if (existentes && existentes.length > 0) {
          console.log(`[MIGR]     - Vínculo ${uniqueKey} já existe`);
          continue;
        }

        // Criar novo vínculo
        try {
          const novoVinculo = await base44.asServiceRole.entities.EquipeMembro.create({
            equipe_id: equipe.id,
            colaborador_id,
            unique_key: uniqueKey,
            status: 'ativo'
          });

          console.log(`[MIGR]     - Vínculo criado: ${novoVinculo.id}`);
          totalVinculos++;
        } catch (err) {
          console.error(`[MIGR] Erro ao criar vínculo ${uniqueKey}:`, err.message);
        }
      }

      equipesProcessadas++;
    }

    console.log(`[MIGR] Migração concluída: ${totalVinculos} vínculos criados para ${equipesProcessadas} equipes`);

    return Response.json({
      ok: true,
      equipes_processadas: equipesProcessadas,
      vinculos_criados: totalVinculos
    });

  } catch (error) {
    console.error('[ERROR] migrarEquipeArrayParaEquipeMembro:', error);
    return Response.json({
      ok: false,
      error: error.message
    }, { status: 500 });
  }
});
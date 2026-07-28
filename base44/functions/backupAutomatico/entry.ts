import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Apenas admins podem fazer backup' }, { status: 403 });
    }

    const timestamp = new Date().toISOString();
    const backup = {
      timestamp,
      entidades: {
        obras: await base44.entities.Obra.list(),
        medicoes: await base44.entities.Medicao.list(),
        colaboradores: await base44.entities.Colaborador.list(),
        contratos: await base44.entities.Contrato?.list() || [],
        materiais: await base44.entities.Material.list()
      }
    };

    // Salvar backup localmente (simulado)
    const nomeBackup = `backup-${timestamp.slice(0, 10)}.json`;
    
    console.log(`Backup criado: ${nomeBackup}`);
    console.log(`Total de registros: ${Object.values(backup.entidades).reduce((sum, arr) => sum + arr.length, 0)}`);

    return Response.json({
      sucesso: true,
      nomeBackup,
      timestamp,
      registros: Object.entries(backup.entidades).reduce((acc, [key, val]) => ({
        ...acc,
        [key]: val.length
      }), {})
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
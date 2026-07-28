import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Função para listar esquemas de entidades (útil para validação de estrutura)
const ENTIDADES_CRIADAS = [
  'Colaborador',
  'DiarioObra',
  'DiarioObraEquipe',
  'DiarioObraMidia',
  'DiarioObraMotivo',
  'MotivoCatalogo',
  'Veiculo',
  'Vistoria',
  'VistoriaItem',
  'VistoriaMidia',
  'MovimentacaoVeiculo',
  'MovimentacaoVeiculoMidia'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const schemas = {};

    for (const entidade of ENTIDADES_CRIADAS) {
      try {
        const entity = base44.entities[entidade];
        if (entity && entity.schema) {
          schemas[entidade] = await entity.schema();
        }
      } catch (err) {
        schemas[entidade] = { erro: err.message };
      }
    }

    return Response.json({
      message: 'Esquemas das entidades criadas',
      entidades: Object.keys(schemas),
      schemas
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
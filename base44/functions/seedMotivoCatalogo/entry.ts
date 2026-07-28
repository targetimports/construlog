import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const MOTIVOS_PADRAO = [
  'CHUVA',
  'FALTA_MATERIAL',
  'FALTA_FERRAMENTA',
  'EQUIPE_INCOMPLETA',
  'ATRASO',
  'RESSACA',
  'RETRABALHO',
  'QUEBRA_EQUIPAMENTO',
  'ACESSO_BLOQUEADO',
  'OUTROS'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas admin pode executar seed' }, { status: 403 });
    }

    // Verificar se já existem motivos
    const existentes = await base44.entities.MotivoCatalogo.list();
    if (existentes && existentes.length > 0) {
      return Response.json({ 
        message: 'Motivos já existem',
        total: existentes.length,
        motivos: existentes 
      });
    }

    // Criar motivos padrão
    const criados = await base44.entities.MotivoCatalogo.bulkCreate(
      MOTIVOS_PADRAO.map((nome, idx) => ({
        nome,
        ativo: true,
        ordem: idx + 1
      }))
    );

    return Response.json({
      message: 'Seed de motivos executado com sucesso',
      total: criados.length,
      motivos: criados
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
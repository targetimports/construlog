import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * DIAGNÓSTICO: Lista entidades críticas e sua cobertura de obraId
 */

const ENTIDADES_CRITICAS = [
  { nome: 'OrdemCompra', precisa_obra: true },
  { nome: 'RecebimentoMaterial', precisa_obra: true },
  { nome: 'MovimentacaoEstoque', precisa_obra: true },
  { nome: 'NotaFiscal', precisa_obra: true },
  { nome: 'ContaFinanceira', precisa_obra: true },
  { nome: 'Medicao', precisa_obra: true },
  { nome: 'ApontamentoHoras', precisa_obra: true },
  { nome: 'UsoEquipamento', precisa_obra: true },
  { nome: 'Insumo', precisa_obra: false },
  { nome: 'Composicao', precisa_obra: false }
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json(
        { erro: 'Admin required' },
        { status: 403 }
      );
    }

    const resultado = {
      timestamp: new Date().toISOString(),
      entidades: []
    };

    for (const entidade of ENTIDADES_CRITICAS) {
      try {
        const records = await base44.entities[entidade.nome].list();
        const comObra = records.filter(r => r.obra_id).length;
        const semObra = records.length - comObra;
        const cobertura = records.length > 0 ? Math.round((comObra / records.length) * 100) : 100;

        resultado.entidades.push({
          nome: entidade.nome,
          precisaObra: entidade.precisa_obra,
          totalRegistros: records.length,
          comObraId: comObra,
          semObraId: semObra,
          cobertura: `${cobertura}%`,
          orfaos: semObra > 0 ? records.filter(r => !r.obra_id).slice(0, 5).map(r => ({ id: r.id, created_by: r.created_by, created_date: r.created_date })) : []
        });
      } catch (error) {
        resultado.entidades.push({
          nome: entidade.nome,
          erro: error.message
        });
      }
    }

    const totalRegistros = resultado.entidades.reduce((sum, e) => sum + (e.totalRegistros || 0), 0);
    const totalOrfaos = resultado.entidades.reduce((sum, e) => sum + (e.semObraId || 0), 0);

    resultado.resumo = {
      totalRegistros,
      totalOrfaos,
      percentualCobertura: totalRegistros > 0 ? Math.round(((totalRegistros - totalOrfaos) / totalRegistros) * 100) : 100
    };

    return Response.json(resultado);
  } catch (error) {
    console.error('[diagnosticoEsquemaObraId] Erro:', error);
    return Response.json(
      { erro: error.message },
      { status: 500 }
    );
  }
});
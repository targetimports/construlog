import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const ENTIDADES_CRITICAS = [
  'SolicitacaoCompra', 'Cotacao', 'OrdemCompra', 'RecebimentoMaterial',
  'MovimentacaoEstoque', 'NotaFiscal', 'ContaFinanceira', 'Medicao',
  'ApontamentoHoras', 'UsoEquipamento'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ erro: 'Não autenticado' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ erro: 'Acesso restrito a admin' }, { status: 403 });
    }

    const resultados = [];

    for (const entidade of ENTIDADES_CRITICAS) {
      try {
        const registros = await base44.entities[entidade].list();
        const orfaos = registros.filter(r => !r.obra_id && !r.obraId);

        if (orfaos.length > 0) {
          resultados.push({
            entidade,
            total: registros.length,
            orfaos: orfaos.map(r => ({
              id: r.id,
              descricao: r.descricao || r.nome || r.titulo || `ID: ${r.id}`,
              dataCriacao: r.created_date,
              criadoPor: r.created_by
            }))
          });
        }
      } catch (error) {
        console.warn(`Entidade ${entidade} não encontrada ou erro:`, error.message);
      }
    }

    return Response.json({
      sucesso: true,
      totalEntidades: ENTIDADES_CRITICAS.length,
      entidadesComOrfaos: resultados.length,
      resultados
    });
  } catch (error) {
    console.error('[buscarRegistrosOrfaos] Erro:', error);
    return Response.json({
      erro: 'Erro ao buscar registros órfãos',
      detalhe: error.message
    }, { status: 500 });
  }
});
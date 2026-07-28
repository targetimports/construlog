import { withSecureHandler } from './_shared/secureHandler.ts';
import { successResponse } from './_shared/responseHandler.ts';

Deno.serve(async (req) => {
  return withSecureHandler(req, {
    requiredRole: 'admin',
    validateInput: (data) => ({ valid: true }),
    auditAction: 'CONCILIAR_DADOS_INSUMOS'
  }, async (ctx) => {
    const { base44 } = ctx;

    const insumos = await base44.entities.Insumo.list('', 500);
    const movimentacoes = await base44.entities.MovimentacaoEstoque.list('', 2000);
    const requisicoes = await base44.entities.RequisicaoCompra.list('', 500);

    const relatorio = {
      insumos_sem_vinculo_estoque: [],
      material_estoque_sem_insumo: [],
      requisicoes_sem_insumo: [],
      vinculacoes_propostas: [],
      data_analise: new Date().toISOString()
    };

    // Verificar movimentações sem insumo_id
    const movimentacoesSemInsumo = movimentacoes.filter(m => !m.insumo_id);
    
    for (const mov of movimentacoesSemInsumo) {
      const material_id = mov.material_id;
      if (!material_id) continue;

      // Procurar insumo correspondente por similaridade
      const candidatos = insumos.filter(i => {
        const match = i.descricao?.toLowerCase().includes(mov.observacoes?.toLowerCase() || '');
        return match;
      });

      relatorio.material_estoque_sem_insumo.push({
        material_id,
        movimentacao_id: mov.id,
        descricao_original: mov.observacoes,
        candidatos: candidatos.map(c => ({
          insumo_id: c.id,
          codigo: c.codigo,
          descricao: c.descricao,
          confianca: 75 // Estimativa básica
        }))
      });
    }

    // Verificar requisições com itens sem insumo_id
    for (const req_compra of requisicoes) {
      if (req_compra.itens) {
        for (const item of req_compra.itens) {
          if (!item.insumo_id && item.descricao) {
            const candidatos = insumos.filter(i => 
              i.descricao?.toLowerCase().includes(item.descricao.toLowerCase())
            );

            relatorio.requisicoes_sem_insumo.push({
              requisicao_id: req_compra.id,
              item_descricao: item.descricao,
              candidatos: candidatos.map(c => ({
                insumo_id: c.id,
                codigo: c.codigo,
                descricao: c.descricao,
                confianca: 80
              }))
            });
          }
        }
      }
    }

    // Criar propostas de vinculação com similaridade
    for (const sem_vinculo of relatorio.material_estoque_sem_insumo) {
      for (const candidato of sem_vinculo.candidatos) {
        const proposta = await base44.entities.VinculacaoConciliacao.create({
          tipo_origem: 'estoque',
          id_origem: sem_vinculo.material_id,
          insumo_id_destino: candidato.insumo_id,
          nome_origem: sem_vinculo.descricao_original,
          nome_destino: candidato.descricao,
          confianca_vinculacao: candidato.confianca,
          status: 'proposto'
        });
        
        relatorio.vinculacoes_propostas.push({
          vinculacao_id: proposta.id,
          status: 'criada'
        });
      }
    }

    return {
      status: 'conciliacao_concluida',
      totais: {
        material_sem_insumo: relatorio.material_estoque_sem_insumo.length,
        requisicoes_sem_insumo: relatorio.requisicoes_sem_insumo.length,
        propostas_criadas: relatorio.vinculacoes_propostas.length
      },
      relatorio
    };
  });
});
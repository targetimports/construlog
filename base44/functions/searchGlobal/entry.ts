import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * BUSCA GLOBAL: procura em múltiplas entidades por obra
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ ok: false, code: 'NAO_AUTORIZADO', message: 'Login necessário' }, { status: 401 });
    }
    
    const payload = await req.json();
    const { obra_id, termo, filtros = {} } = payload;
    
    if (!obra_id || !termo || termo.length < 2) {
      return Response.json({ ok: false, code: 'VALIDACAO', message: 'obra_id e termo (min 2 chars) obrigatórios' }, { status: 400 });
    }
    
    const termoLower = termo.toLowerCase();
    const resultados = { ordens_compra: [], notas_fiscais: [], medicoes: [], contas: [], movimentacoes: [], receitas: [] };
    
    const [ocs, nfs, medicoes, contas, movimentos, receitas] = await Promise.all([
      base44.entities.OrdemCompra.filter({ obra_id }).catch(() => []),
      base44.entities.NotaFiscal.filter({ obra_id }).catch(() => []),
      base44.entities.Medicao.filter({ obra_id }).catch(() => []),
      base44.entities.ContaFinanceira.filter({ obra_id }).catch(() => []),
      base44.entities.MovimentacaoEstoque.filter({ obra_id }).catch(() => []),
      base44.entities.ReceitaObra.filter({ obra_id }).catch(() => [])
    ]);
    
    resultados.ordens_compra = (ocs || []).filter(oc => (oc.numero || '').toLowerCase().includes(termoLower) || (oc.fornecedor_nome || '').toLowerCase().includes(termoLower)).slice(0, 5);
    resultados.notas_fiscais = (nfs || []).filter(nf => (nf.numero_nf || '').toLowerCase().includes(termoLower) || (nf.descricao || '').toLowerCase().includes(termoLower)).slice(0, 5);
    resultados.medicoes = (medicoes || []).filter(med => (med.numero || '').toLowerCase().includes(termoLower) || (med.observacoes || '').toLowerCase().includes(termoLower)).slice(0, 5);
    resultados.contas = (contas || []).filter(c => (c.descricao || '').toLowerCase().includes(termoLower) || (c.nota_fiscal || '').toLowerCase().includes(termoLower)).slice(0, 5);
    resultados.movimentacoes = (movimentos || []).filter(m => (m.descricao_insumo || '').toLowerCase().includes(termoLower) || (m.codigo_insumo || '').toLowerCase().includes(termoLower)).slice(0, 5);
    resultados.receitas = (receitas || []).filter(r => (r.descricao || '').toLowerCase().includes(termoLower)).slice(0, 5);
    
    const total = Object.values(resultados).reduce((sum, arr) => sum + arr.length, 0);
    
    return Response.json({ ok: true, data: { termo, obra_id, total, resultados } });
  } catch (error) {
    console.error('[searchGlobal] erro:', error?.message);
    return Response.json({ ok: false, code: 'ERRO_INTERNO', message: 'Erro ao buscar' }, { status: 500 });
  }
});
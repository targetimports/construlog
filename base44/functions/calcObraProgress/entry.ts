import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Decimal from 'npm:decimal.js@10.4.3';

function TRUNC2(x) {
  const d = new Decimal(x);
  const scaled = d.mul(100);
  const t = scaled.isNeg() ? scaled.ceil() : scaled.floor();
  return t.div(100);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const obraId = body?.obra_id;
    const persist = Boolean(body?.persist);
    if (!obraId) return Response.json({ error: 'obra_id é obrigatório' }, { status: 400 });

    // Obter versões ativas do contrato
    const versoes = await base44.asServiceRole.entities.ContratoVersao.filter({ obra_id: obraId, status: 'ATIVA' });
    if (!versoes || versoes.length === 0) {
      return Response.json({ obra_id: obraId, totals: { total_contrato: 0, total_acumulado: 0, percent_concluida: 0 } });
    }

    // Escolher a com maior numero_versao
    const ativa = versoes.reduce((acc, v) => (acc == null || (v.numero_versao || 0) > (acc.numero_versao || 0) ? v : acc), null);

    // Total do contrato (somatório de itens)
    const contratoItems = await base44.asServiceRole.entities.ContratoItem.filter({ contrato_versao_id: ativa.id });
    let sumContrato = new Decimal(0);
    for (const it of contratoItems) {
      const pt = it?.preco_total != null ? new Decimal(it.preco_total) : new Decimal(it.qtd_contrato || 0).mul(new Decimal(it.preco_unit_com_bdi || 0));
      sumContrato = sumContrato.add(pt);
    }

    // Último BM aprovado
    const bms = await base44.asServiceRole.entities.BM.filter({ obra_id: obraId, contrato_versao_id: ativa.id, status: 'APROVADA' });
    const ultimo = bms.reduce((acc, v) => (acc == null || (v.numero || 0) > (acc.numero || 0) ? v : acc), null);

    const total_acumulado = ultimo ? TRUNC2(new Decimal(ultimo.total_acumulado || 0)).toNumber() : 0;
    const total_contrato = TRUNC2(sumContrato).toNumber();

    const percent = sumContrato.gt(0) ? new Decimal(total_acumulado).div(total_contrato).mul(100) : new Decimal(0);
    const percent_concluida = TRUNC2(percent).toNumber();

    if (persist) {
      await base44.asServiceRole.entities.Obra.update(obraId, { percent_concluida_atual: percent_concluida });
    }

    return Response.json({
      obra_id: obraId,
      contrato_versao_id: ativa.id,
      totals: { total_contrato, total_acumulado, percent_concluida },
    });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});
/**
 * gerarContaReceberDeMedicao: Cria ContaReceber ao aprovar BM
 * 
 * Validações:
 * - BM status RASCUNHO only
 * - total_periodo > 0
 * - Contrato ativo
 * - ConfiguracaoMedicao habilitada
 * 
 * Retorna: ContaReceber criada ou null se desabilitado
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Decimal from 'npm:decimal.js@10.4.3';

function TRUNC2(x) {
  if (x === null || x === undefined) return 0;
  const d = new Decimal(x);
  if (d.isZero()) return 0;
  const scaled = d.mul(100);
  const truncated = scaled.isNeg() ? scaled.ceil() : scaled.floor();
  return truncated.div(100).toNumber();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bm_id } = await req.json();
    if (!bm_id) {
      return Response.json({ error: 'bm_id obrigatório' }, { status: 400 });
    }

    // Buscar BM
    const bms = await base44.asServiceRole.entities.BM.filter({ id: bm_id }) || [];
    const bm = bms[0];
    if (!bm) return Response.json({ error: 'BM não encontrada' }, { status: 404 });

    if (bm.status !== 'RASCUNHO') {
      return Response.json({ 
        error: 'Apenas BMs em RASCUNHO podem gerar ContaReceber' 
      }, { status: 400 });
    }

    if (!bm.total_periodo || bm.total_periodo <= 0) {
      return Response.json({
        success: true,
        conta_receber_id: null,
        motivo: 'Valor período = 0'
      });
    }

    // Buscar configuração
    const configs = await base44.asServiceRole.entities.ConfiguracaoMedicao.filter({
      obra_id: bm.obra_id,
      ativo: true
    }) || [];

    const config = configs.find(c => c.contrato_versao_id === bm.contrato_versao_id) 
      || configs.find(c => !c.contrato_versao_id);

    if (!config || !config.gerar_conta_receber_automaticamente) {
      return Response.json({
        success: true,
        conta_receber_id: null,
        motivo: 'Geração automática desabilitada na configuração'
      });
    }

    // Calcular valor com descontos/retenções
    let valorBruto = new Decimal(bm.total_periodo);
    let desconto = new Decimal(0);
    let retencao = new Decimal(0);

    if (config.percentual_desconto > 0) {
      desconto = valorBruto.mul(config.percentual_desconto).div(100);
      valorBruto = valorBruto.minus(desconto);
    }

    if (config.percentual_retencao > 0) {
      retencao = valorBruto.mul(config.percentual_retencao).div(100);
      valorBruto = valorBruto.minus(retencao);
    }

    const valorLiquido = TRUNC2(valorBruto.toNumber());

    // Criar ContaReceber
    const contaReceber = await base44.asServiceRole.entities.ContaReceber.create({
      obra_id: bm.obra_id,
      descricao: `Medição BM #${bm.numero}`,
      data_vencimento: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
      valor: valorLiquido,
      valor_original: TRUNC2(new Decimal(bm.total_periodo).toNumber()),
      desconto_aplicado: TRUNC2(desconto.toNumber()),
      retencao_aplicada: TRUNC2(retencao.toNumber()),
      status: 'em_aberto',
      bm_id: bm.id,
    });

    // Atualizar BM com vínculo
    await base44.asServiceRole.entities.BM.update(bm.id, {
      conta_receber_id: contaReceber.id
    });

    // Registrar auditoria
    await base44.asServiceRole.entities.AuditLog.create({
      obra_id: bm.obra_id,
      entidade: 'ContaReceber',
      entidade_id: contaReceber.id,
      acao: 'create',
      usuario_id: user.email,
      observacao: `ContaReceber gerada automaticamente a partir de BM #${bm.numero}`,
      dados_depois: {
        bm_id: bm.id,
        valor: valorLiquido,
        desconto: TRUNC2(desconto.toNumber()),
        retencao: TRUNC2(retencao.toNumber())
      }
    });

    return Response.json({
      success: true,
      bm_id,
      conta_receber_id: contaReceber.id,
      valor_bruto: TRUNC2(new Decimal(bm.total_periodo).toNumber()),
      desconto: TRUNC2(desconto.toNumber()),
      retencao: TRUNC2(retencao.toNumber()),
      valor_liquido: valorLiquido
    });

  } catch (error) {
    console.error('[gerarContaReceberDeMedicao]', error?.message);
    return Response.json({
      error: error?.message || 'Erro ao gerar ContaReceber'
    }, { status: 500 });
  }
});
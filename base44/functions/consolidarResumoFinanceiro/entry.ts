import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    let periodo = payload.periodo;
    
    // Se for chamado pela automação entity, extrai o período do lançamento
    if (payload.event && payload.data) {
      const dataLancamento = payload.data.data || payload.data.data_pagamento || payload.data.saida_real;
      if (dataLancamento) {
        periodo = dataLancamento.substring(0, 7); // YYYY-MM
      }
    }
    
    // Fallback: usar mês atual se não houver período (ex: automação de Material)
    if (!periodo) {
      const hoje = new Date();
      periodo = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    }

    // Extrair ano e mês
    const ano = periodo.substring(0, 4);
    const mes = periodo.substring(5, 7);
    
    // Calcular totais apenas dos registros do período (limite 500 por tipo)
    const [
      materials,
      maoDeObra,
      alimentacao,
      aluguel,
      investimentos,
      fretes,
      estadias,
      impostos,
      retiradas,
      empreitas,
      generico,
      nfs
    ] = await Promise.all([
      base44.asServiceRole.entities.Material.list('created_date', 500),
      base44.asServiceRole.entities.MaoDeObra.list('created_date', 500),
      base44.asServiceRole.entities.Alimentacao.list('created_date', 500),
      base44.asServiceRole.entities.AluguelEquipamento.list('created_date', 500),
      base44.asServiceRole.entities.Investimento.list('created_date', 500),
      base44.asServiceRole.entities.Frete.list('created_date', 500),
      base44.asServiceRole.entities.Estadia.list('created_date', 500),
      base44.asServiceRole.entities.Imposto.list('created_date', 500),
      base44.asServiceRole.entities.Retirada.list('created_date', 500),
      base44.asServiceRole.entities.Empreita.list('created_date', 500),
      base44.asServiceRole.entities.LancamentoGenerico.list('created_date', 500),
      base44.asServiceRole.entities.NotaFiscal.list('created_date', 500)
    ]);

    // Função helper para filtrar por período
    const filtrarPorPeriodo = (registros, dataField) => {
      return registros.filter(r => {
        const data = r[dataField];
        if (!data) return false;
        return data.substring(0, 7) === periodo;
      });
    };

    // Calcular totais
    const totaisPorPeriodo = {
      material: filtrarPorPeriodo(materials, 'data').reduce((sum, m) => sum + (m.valor_total || 0), 0),
      maoDeObra: filtrarPorPeriodo(maoDeObra, 'data').reduce((sum, m) => sum + (m.valor || 0), 0),
      alimentacao: filtrarPorPeriodo(alimentacao, 'data').reduce((sum, a) => sum + (a.valor || 0), 0),
      aluguel: filtrarPorPeriodo(aluguel, 'data').reduce((sum, a) => sum + (a.valor || 0), 0),
      investimento: filtrarPorPeriodo(investimentos, 'data').reduce((sum, i) => sum + (i.valor || 0), 0),
      frete: filtrarPorPeriodo(fretes, 'data').reduce((sum, f) => sum + (f.valor || 0), 0),
      estadia: filtrarPorPeriodo(estadias, 'data').reduce((sum, e) => sum + (e.valor || 0), 0),
      imposto: filtrarPorPeriodo(impostos, 'data_pagamento').reduce((sum, i) => sum + (i.valor || 0), 0),
      retirada: filtrarPorPeriodo(retiradas, 'data').reduce((sum, r) => sum + (r.valor || 0), 0),
      empreita: filtrarPorPeriodo(empreitas, 'data').reduce((sum, e) => sum + (e.valor || 0), 0),
      generico: filtrarPorPeriodo(generico, 'data').reduce((sum, g) => sum + (g.valor || 0), 0),
      nf: filtrarPorPeriodo(nfs, 'data').reduce((sum, n) => sum + (n.valor_bruto || n.valor_liquido || 0), 0)
    };

    const total = Object.values(totaisPorPeriodo).reduce((sum, v) => sum + v, 0);

    // Buscar ou criar resumo
    const resumosExistentes = await base44.asServiceRole.entities.ResumoFinanceiro.filter({ periodo });
    let resumoId;

    if (resumosExistentes && resumosExistentes.length > 0) {
      resumoId = resumosExistentes[0].id;
      await base44.asServiceRole.entities.ResumoFinanceiro.update(resumoId, {
        total_material: totaisPorPeriodo.material,
        total_mao_de_obra: totaisPorPeriodo.maoDeObra,
        total_alimentacao: totaisPorPeriodo.alimentacao,
        total_aluguel_equipamento: totaisPorPeriodo.aluguel,
        total_investimento: totaisPorPeriodo.investimento,
        total_frete: totaisPorPeriodo.frete,
        total_estadia: totaisPorPeriodo.estadia,
        total_imposto: totaisPorPeriodo.imposto,
        total_retirada: totaisPorPeriodo.retirada,
        total_empreita: totaisPorPeriodo.empreita,
        total_generico: totaisPorPeriodo.generico,
        nf_total: totaisPorPeriodo.nf,
        total_geral: total,
        data_atualizacao: new Date().toISOString()
      });
    } else {
      const novoResumo = await base44.asServiceRole.entities.ResumoFinanceiro.create({
        periodo,
        total_material: totaisPorPeriodo.material,
        total_mao_de_obra: totaisPorPeriodo.maoDeObra,
        total_alimentacao: totaisPorPeriodo.alimentacao,
        total_aluguel_equipamento: totaisPorPeriodo.aluguel,
        total_investimento: totaisPorPeriodo.investimento,
        total_frete: totaisPorPeriodo.frete,
        total_estadia: totaisPorPeriodo.estadia,
        total_imposto: totaisPorPeriodo.imposto,
        total_retirada: totaisPorPeriodo.retirada,
        total_empreita: totaisPorPeriodo.empreita,
        total_generico: totaisPorPeriodo.generico,
        nf_total: totaisPorPeriodo.nf,
        total_geral: total,
        data_atualizacao: new Date().toISOString()
      });
      resumoId = novoResumo.id;
    }

    return Response.json({
      success: true,
      resumo_id: resumoId,
      periodo,
      totais: totaisPorPeriodo,
      total_geral: total
    });
  } catch (error) {
    console.error('Erro ao consolidar resumo:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
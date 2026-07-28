import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { FunctionLogger } from './_shared/logger.ts';

/**
 * Gerar Relatório Avançado de Estoque
 * Calcula: histórico movimentações, curva ABC, previsão demanda, baixa rotatividade
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const logger = new FunctionLogger('gerarRelatorioEstoqueAvancado', base44);

  try {
    const user = await base44.auth.me().catch(() => null);
    const { tipo, material_id, deposito_id, dias = 90 } = await req.json();

    console.log(`[gerarRelatorioEstoqueAvancado] Gerando relatório tipo: ${tipo}`);

    let resultado = {};

    // 1. HISTÓRICO DE MOVIMENTAÇÕES
    if (tipo === 'historico' || !tipo) {
      const movimentacoes = await base44.asServiceRole.entities.MovimentacaoEstoque
        .filter({ insumo_id: material_id })
        .catch(() => []);

      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - dias);

      const historicoFiltrado = movimentacoes
        .filter(m => new Date(m.data_movimentacao) >= dataLimite)
        .sort((a, b) => new Date(b.data_movimentacao) - new Date(a.data_movimentacao));

      resultado.historico = {
        total: historicoFiltrado.length,
        movimentacoes: historicoFiltrado.map(m => ({
          data: m.data_movimentacao,
          tipo: m.tipo,
          quantidade: m.quantidade,
          descricao: m.descricao,
          usuario: m.created_by
        }))
      };
    }

    // 2. CURVA ABC
    if (tipo === 'curva_abc' || !tipo) {
      const movimentacoes = await base44.asServiceRole.entities.MovimentacaoEstoque.list().catch(() => []);
      const insumos = await base44.asServiceRole.entities.Insumo.list().catch(() => []);

      const consumoPorMaterial = {};

      movimentacoes.forEach(m => {
        if (m.tipo === 'saida') {
          if (!consumoPorMaterial[m.insumo_id]) {
            consumoPorMaterial[m.insumo_id] = { quantidade: 0, valor: 0, nome: '' };
          }
          consumoPorMaterial[m.insumo_id].quantidade += m.quantidade || 0;
        }
      });

      // Associar valores unitários
      insumos.forEach(ins => {
        if (consumoPorMaterial[ins.id]) {
          consumoPorMaterial[ins.id].nome = ins.nome;
          consumoPorMaterial[ins.id].valor = (consumoPorMaterial[ins.id].quantidade * (ins.preco_unitario || 0));
        }
      });

      const materiais = Object.entries(consumoPorMaterial)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.valor - a.valor);

      const totalValor = materiais.reduce((sum, m) => sum + m.valor, 0);
      let valorAcumulado = 0;

      const curvaAbc = materiais.map(m => {
        valorAcumulado += m.valor;
        const percentual = (valorAcumulado / totalValor) * 100;
        let classe = 'C';
        if (percentual <= 80) classe = 'A';
        else if (percentual <= 95) classe = 'B';

        return { ...m, classe, percentualAcumulado: percentual };
      });

      resultado.curva_abc = curvaAbc.slice(0, 50); // Top 50
    }

    // 3. PREVISÃO DE DEMANDA
    if (tipo === 'previsao_demanda' || !tipo) {
      const movimentacoes = await base44.asServiceRole.entities.MovimentacaoEstoque
        .filter({ insumo_id: material_id })
        .catch(() => []);

      const ordensCompra = await base44.asServiceRole.entities.OrdemCompra
        .filter({ insumo_id: material_id })
        .catch(() => []);

      // Calcular média de consumo mensal
      const consumoMensal = {};
      movimentacoes
        .filter(m => m.tipo === 'saida')
        .forEach(m => {
          const mes = new Date(m.data_movimentacao).toISOString().slice(0, 7);
          consumoMensal[mes] = (consumoMensal[mes] || 0) + (m.quantidade || 0);
        });

      const meses = Object.keys(consumoMensal).sort();
      const consumos = meses.map(m => consumoMensal[m]);
      const mediaConsumo = consumos.reduce((a, b) => a + b, 0) / consumos.length || 0;

      // Ordens pendentes
      const ordensPendentes = ordensCompra
        .filter(o => o.status !== 'recebida' && o.status !== 'cancelada')
        .reduce((sum, o) => sum + (o.quantidade || 0), 0);

      resultado.previsao_demanda = {
        media_mensal: Math.round(mediaConsumo),
        tendencia: consumos.length > 1 && consumos[consumos.length - 1] > mediaConsumo ? 'crescente' : 'estável',
        ordens_pendentes: ordensPendentes,
        mes_proximo_estimado: Math.round(mediaConsumo * 1.1),
        historico_consumo: meses.map((m, i) => ({ mes: m, consumo: consumos[i] }))
      };
    }

    // 4. BAIXA ROTATIVIDADE
    if (tipo === 'baixa_rotatividade' || !tipo) {
      const movimentacoes = await base44.asServiceRole.entities.MovimentacaoEstoque.list().catch(() => []);
      const insumos = await base44.asServiceRole.entities.Insumo.list().catch(() => []);

      const ultimaMovimentacao = {};
      movimentacoes.forEach(m => {
        const data = new Date(m.data_movimentacao).getTime();
        if (!ultimaMovimentacao[m.insumo_id] || data > ultimaMovimentacao[m.insumo_id]) {
          ultimaMovimentacao[m.insumo_id] = data;
        }
      });

      const agora = new Date().getTime();
      const dias90 = 90 * 24 * 60 * 60 * 1000;

      const baixaRotatividade = insumos
        .filter(ins => {
          const ultimaDia = ultimaMovimentacao[ins.id];
          return !ultimaDia || (agora - ultimaDia) > dias90;
        })
        .map(ins => ({
          id: ins.id,
          nome: ins.nome,
          diasInativo: ultimaMovimentacao[ins.id] 
            ? Math.round((agora - ultimaMovimentacao[ins.id]) / (24 * 60 * 60 * 1000))
            : 999,
          status: 'inativo'
        }))
        .sort((a, b) => b.diasInativo - a.diasInativo);

      resultado.baixa_rotatividade = baixaRotatividade.slice(0, 30);
    }

    await logger.success(user, { tipo, material_id }, resultado);

    return Response.json({ ok: true, data: resultado });
  } catch (error) {
    const user = await base44.auth.me().catch(() => null);
    await logger.error(user, {}, error, 'RELATORIO_ERROR');
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});
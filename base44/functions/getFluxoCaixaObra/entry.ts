import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const normalizarValor = (val) => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^\d.,\-]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }
  return 0;
};

const obterMesPeriodo = (data) => {
  if (!data) return null;
  const d = new Date(data);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const obterDataInicioMes = (periodo) => {
  const [ano, mes] = periodo.split('-');
  return `${ano}-${mes}-01`;
};

const obterDataFimMes = (periodo) => {
  const [ano, mes] = periodo.split('-');
  const numMes = parseInt(mes);
  const numAno = parseInt(ano);
  const proximoMes = numMes === 12 ? 1 : numMes + 1;
  const proximoAno = numMes === 12 ? numAno + 1 : numAno;
  const dataProxima = new Date(proximoAno, proximoMes - 1, 1);
  const ultimoDia = new Date(dataProxima.getTime() - 86400000);
  return ultimoDia.toISOString().split('T')[0];
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { obra_id, de, ate, granularidade = 'mes' } = await req.json();
    if (!obra_id) {
      return Response.json({ error: 'Field obra_id is required' }, { status: 400 });
    }

    const obra = await base44.entities.Obra.get(obra_id);
    if (!obra) {
      return Response.json({ error: 'Obra not found' }, { status: 404 });
    }

    const alertas = [];
    const periodos = new Map();
    const serie = [];

    // Gerar períodos (meses)
    const dataInicio = de ? new Date(de) : new Date(2026, 0, 1);
    const dataFim = ate ? new Date(ate) : new Date(2026, 11, 31);
    
    let mesAtual = new Date(dataInicio);
    while (mesAtual <= dataFim) {
      const periodo = `${mesAtual.getFullYear()}-${String(mesAtual.getMonth() + 1).padStart(2, '0')}`;
      periodos.set(periodo, {
        periodo,
        de: obterDataInicioMes(periodo),
        ate: obterDataFimMes(periodo),
        entradas: 0,
        saidas: 0,
        saldo_mes: 0,
        saldo_acumulado: 0
      });
      mesAtual.setMonth(mesAtual.getMonth() + 1);
    }

    // Ler categorias
    const categorias = await base44.entities.CategoriaFinanceira.list();
    const mapCat = {};
    categorias.forEach(c => {
      mapCat[c.id] = { nome: c.nome, grupo: c.grupo };
    });

    // ENTRADAS: Contas Receber com valor_recebido
    const contas = await base44.entities.ContaFinanceira.filter({
      obra_id: obra_id
    });
    
    contas.forEach(c => {
      // Entradas (receber)
      if (c.tipo === 'receber' && c.valor_recebido > 0) {
        const periodo = obterMesPeriodo(c.updated_date);
        if (periodo && periodos.has(periodo)) {
          const valor = normalizarValor(c.valor_recebido);
          periodos.get(periodo).entradas += valor;
        }
      }

      // Saídas (pagar confirmado)
      if (c.tipo === 'pagar' && ['pago', 'parcial'].includes(c.status)) {
        const periodo = obterMesPeriodo(c.data_pagamento);
        if (periodo && periodos.has(periodo)) {
          const valor = normalizarValor(c.valor);
          periodos.get(periodo).saidas += valor;
        }
      }
    });

    // SAÍDAS adicionais: Movimentações de Estoque (custo de saída)
    const movimentacoes = await base44.entities.MovimentacaoEstoque.filter({
      obra_destino_id: obra_id
    });
    
    movimentacoes
      .filter(m => ['saida_consumo', 'saida'].includes(m.tipo))
      .forEach(m => {
        const periodo = obterMesPeriodo(m.data_movimentacao);
        if (periodo && periodos.has(periodo)) {
          const valor = normalizarValor(m.valor_total);
          periodos.get(periodo).saidas += valor;
        }
      });

    // Calcular saldos
    let saldoAcumulado = 0;
    periodos.forEach(p => {
      p.saldo_mes = p.entradas - p.saidas;
      saldoAcumulado += p.saldo_mes;
      p.saldo_acumulado = saldoAcumulado;

      // Alerta de saldo negativo
      if (p.saldo_acumulado < 0) {
        alertas.push({
          tipo: 'saldo_negativo',
          periodo: p.periodo,
          severidade: 'alto',
          valor: p.saldo_acumulado
        });
      }
    });

    // Converter para array ordenado
    Array.from(periodos.values())
      .sort((a, b) => a.periodo.localeCompare(b.periodo))
      .forEach(p => serie.push(p));

    return Response.json({
      ok: true,
      build_id: `fluxoCaixa_${obra_id}_${Date.now()}`,
      obra_id,
      granularidade,
      serie,
      alertas
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
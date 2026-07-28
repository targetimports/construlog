import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Assistente de consulta - responde perguntas sobre gastos, receitas, etc
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { pergunta, contexto } = await req.json();

    if (!pergunta || typeof pergunta !== 'string') {
      return Response.json({ error: 'Pergunta inválida' }, { status: 400 });
    }

    // Buscar dados financeiros recentes
    const [contasPagar, contasReceber, materiais, fretes, maoObra] = await Promise.all([
      base44.entities.ContaFinanceira.filter({ tipo: 'pagar' }, '-created_date', 50).catch(() => []),
      base44.entities.ContaFinanceira.filter({ tipo: 'receber' }, '-created_date', 50).catch(() => []),
      base44.entities.Material.list('-created_date', 50).catch(() => []),
      base44.entities.Frete.list('-created_date', 50).catch(() => []),
      base44.entities.MaoDeObra.list('-created_date', 50).catch(() => [])
    ]);

    // Filtrar por obra se contexto tiver
    const filtrarPorObra = (lista) => {
      if (!contexto?.obraId) return lista;
      return lista.filter(item => item.obra_id === contexto.obraId);
    };

    const contasPagarFiltradas = filtrarPorObra(contasPagar);
    const contasReceberFiltradas = filtrarPorObra(contasReceber);
    const materiaisFiltrados = filtrarPorObra(materiais);
    const fretesFiltrados = filtrarPorObra(fretes);
    const maoObraFiltrada = filtrarPorObra(maoObra);

    // Calcular totais
    const totalPagar = contasPagarFiltradas.reduce((sum, c) => sum + (c.valor || 0), 0);
    const totalReceber = contasReceberFiltradas.reduce((sum, c) => sum + (c.valor || 0), 0);
    const totalMateriais = materiaisFiltrados.reduce((sum, m) => sum + (m.valor_total || 0), 0);
    const totalFretes = fretesFiltrados.reduce((sum, f) => sum + (f.valor_total || 0), 0);
    const totalMaoObra = maoObraFiltrada.reduce((sum, mo) => sum + (mo.valor_total || 0), 0);

    const totalGastos = totalPagar + totalMateriais + totalFretes + totalMaoObra;

    // Resumo de gastos recentes
    const gastosRecentes = [
      ...contasPagarFiltradas.slice(0, 10).map(c => ({
        tipo: 'Conta a Pagar',
        descricao: c.descricao,
        valor: c.valor,
        data: c.created_date
      })),
      ...materiaisFiltrados.slice(0, 10).map(m => ({
        tipo: 'Material',
        descricao: m.descricao_material,
        valor: m.valor_total,
        data: m.created_date
      })),
      ...fretesFiltrados.slice(0, 10).map(f => ({
        tipo: 'Frete',
        descricao: f.descricao,
        valor: f.valor_total,
        data: f.created_date
      }))
    ].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 15);

    // Consultar IA com contexto
    const resposta = await base44.integrations.Core.InvokeLLM({
      prompt: `Você é um assistente financeiro de obras. Responda de forma concisa e objetiva.

PERGUNTA DO USUÁRIO: "${pergunta}"

DADOS FINANCEIROS DISPONÍVEIS:
- Total de contas a pagar: R$ ${totalPagar.toFixed(2)}
- Total de contas a receber: R$ ${totalReceber.toFixed(2)}
- Total de materiais: R$ ${totalMateriais.toFixed(2)}
- Total de fretes: R$ ${totalFretes.toFixed(2)}
- Total de mão de obra: R$ ${totalMaoObra.toFixed(2)}
- TOTAL GASTOS: R$ ${totalGastos.toFixed(2)}

GASTOS RECENTES (últimos 15):
${gastosRecentes.map((g, i) => `${i + 1}. ${g.tipo}: ${g.descricao} - R$ ${g.valor?.toFixed(2) || 0} (${new Date(g.data).toLocaleDateString('pt-BR')})`).join('\n')}

INSTRUÇÕES:
- Se perguntarem "quanto gastei" ou "o que gastei", use os dados acima
- Se perguntarem sobre algo específico, filtre os gastos relevantes
- Seja direto e use valores reais dos dados
- Formate valores como R$ X.XXX,XX
- Se não houver dados, diga claramente

Responda de forma natural e útil:`,
      add_context_from_internet: false
    });

    return Response.json({
      success: true,
      resposta: resposta,
      dados_usados: {
        total_gastos: totalGastos,
        total_pagar: totalPagar,
        total_receber: totalReceber,
        qtd_registros: gastosRecentes.length
      }
    });

  } catch (error) {
    console.error('Erro na consulta:', error);
    return Response.json({ 
      error: error.message || 'Erro ao processar consulta',
      hint: 'Tente reformular a pergunta'
    }, { status: 500 });
  }
});
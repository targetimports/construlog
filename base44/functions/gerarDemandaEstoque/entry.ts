import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { orcamento_id, obra_id } = body;

    if (!orcamento_id || !obra_id) {
      return Response.json({ error: 'orcamento_id e obra_id são obrigatórios' }, { status: 400 });
    }

    // Buscar itens do orçamento
    const orcamentoItems = await base44.entities.OrcamentoItem.filter({ orcamento_id });
    const composicaoInsumos = await base44.entities.ComposicaoInsumo.list('', 1000);
    const insumos = await base44.entities.Insumo.list('', 500);
    const movimentacoes = await base44.entities.MovimentacaoEstoque.filter({ obra_id });

    // Agregar insumos e quantidades
    const demandasMap = {};
    
    for (const item of orcamentoItems) {
      const insumosDoItem = composicaoInsumos.filter(ci => ci.composicao_id === item.composicao_id);
      
      for (const ic of insumosDoItem) {
        const quantidade_total = ic.coeficiente * item.quantidade;
        const chave = ic.insumo_id;
        
        if (!demandasMap[chave]) {
          const insumo = insumos.find(i => i.id === ic.insumo_id);
          demandasMap[chave] = {
            insumo_id: ic.insumo_id,
            codigo: insumo?.codigo || '',
            descricao: insumo?.descricao || '',
            unidade: insumo?.unidade || '',
            quantidade_orçada: 0,
            quantidade_disponivel: 0,
            quantidade_reservada: 0,
            quantidade_a_comprar: 0,
            status_item: 'pendente'
          };
        }
        
        demandasMap[chave].quantidade_orçada += quantidade_total;
      }
    }

    // Verificar estoque disponível
    const itens = [];
    for (const [insumo_id, demanda] of Object.entries(demandasMap)) {
      // Calcular disponível em estoque
      const entradas = movimentacoes
        .filter(m => m.insumo_id === insumo_id && ['entrada', 'devolucao'].includes(m.tipo))
        .reduce((sum, m) => sum + m.quantidade, 0);
      
      const saidas = movimentacoes
        .filter(m => m.insumo_id === insumo_id && ['saida', 'consumo'].includes(m.tipo))
        .reduce((sum, m) => sum + m.quantidade, 0);
      
      const disponivel = entradas - saidas;
      
      demanda.quantidade_disponivel = Math.max(0, disponivel);
      demanda.quantidade_reservada = Math.min(disponivel, demanda.quantidade_orçada);
      demanda.quantidade_a_comprar = Math.max(0, demanda.quantidade_orçada - disponivel);
      
      if (demanda.quantidade_disponivel >= demanda.quantidade_orçada) {
        demanda.status_item = 'completo';
      } else if (demanda.quantidade_disponivel > 0) {
        demanda.status_item = 'parcial';
      }
      
      itens.push(demanda);
    }

    // Criar demanda de estoque
    const demanda = await base44.entities.DemandaEstoqueObra.create({
      obra_id,
      orcamento_id,
      status: itens.every(i => i.status_item === 'completo') ? 'atendida' : 'planejada',
      itens,
      data_criacao: new Date().toISOString()
    });

    return Response.json({
      demanda_id: demanda.id,
      total_itens: itens.length,
      itens_completos: itens.filter(i => i.status_item === 'completo').length,
      itens_parciais: itens.filter(i => i.status_item === 'parcial').length,
      itens_pendentes: itens.filter(i => i.status_item === 'pendente').length,
      total_quantidade_orçada: itens.reduce((sum, i) => sum + i.quantidade_orçada, 0),
      total_a_comprar: itens.reduce((sum, i) => sum + i.quantidade_a_comprar, 0)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
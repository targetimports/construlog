import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_id, item_orcamento_id, quantidade_medida } = await req.json();

    const erros = [];
    const avisos = [];

    // ❌ BLOQUEIO 1: Item obrigatório
    if (!item_orcamento_id) {
      erros.push('Medição sem vínculo ao item do orçamento. OBRIGATÓRIO vincular.');
      return Response.json({ valido: false, erros, avisos }, { status: 400 });
    }

    // ❌ BLOQUEIO 2: Buscar item
    const items = await base44.entities.OrcamentoItem.filter({ id: item_orcamento_id, obra_id });
    if (!items || items.length === 0) {
      erros.push('Item do orçamento não encontrado.');
      return Response.json({ valido: false, erros, avisos }, { status: 404 });
    }

    const item = items[0];

    // ❌ BLOQUEIO 3: Composição obrigatória
    if (!item.composicao_id) {
      erros.push('Item sem composição vinculada. Impossível processar medição automática.');
      return Response.json({ valido: false, erros, avisos }, { status: 400 });
    }

    // ❌ BLOQUEIO 4: Composição congelada
    const composicoes = await base44.entities.Composicao.filter({ id: item.composicao_id });
    const composicao = composicoes?.[0];

    if (composicao && composicao.congelada) {
      avisos.push('Composição está congelada após medição anterior confirmada. Não pode ser alterada.');
    }

    // ❌ BLOQUEIO 5: Composição completa (material + mão obra + equipamento)
    const temMaterial = composicao?.insumos?.some(i => i.tipo === 'material');
    const temMaoObra = composicao?.insumos?.some(i => i.tipo === 'mao_obra');
    const temEquipamento = composicao?.insumos?.some(i => i.tipo === 'equipamento');

    if (!temMaterial && !temMaoObra && !temEquipamento) {
      erros.push('Composição vazia. Adicione insumos (material, mão de obra e/ou equipamento).');
      return Response.json({ valido: false, erros, avisos }, { status: 400 });
    }

    // ⚠️ AVISO: Faltam tipos de insumo
    if (!temMaterial) avisos.push('Composição sem material.');
    if (!temMaoObra) avisos.push('Composição sem mão de obra.');
    if (!temEquipamento) avisos.push('Composição sem equipamento/hora-máquina.');

    // ❌ BLOQUEIO 6: Não exceder saldo
    const medicoesBuscadas = await base44.entities.Medicao.filter({ 
      item_orcamento_id,
      status: 'processada'
    });
    const totalMedido = medicoesBuscadas.reduce((sum, m) => sum + (m.quantidade || 0), 0);
    const saldoDisponivel = item.quantidade_prevista - totalMedido;

    if (quantidade_medida > saldoDisponivel) {
      erros.push(`Medição de ${quantidade_medida} excede saldo de ${saldoDisponivel}.`);
      return Response.json({ valido: false, erros, avisos }, { status: 400 });
    }

    // ✅ VALIDAÇÃO PASSOU
    return Response.json({
      valido: true,
      erros: [],
      avisos,
      resumo: {
        item_descricao: item.descricao,
        quantidade_prevista: item.quantidade_prevista,
        quantidade_medida_total: totalMedido,
        saldo_disponivel: saldoDisponivel,
        composicao_id: item.composicao_id,
        tipos_insumo: {
          material: temMaterial,
          mao_obra: temMaoObra,
          equipamento: temEquipamento
        }
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
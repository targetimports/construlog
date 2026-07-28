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

const aplicarFiltroDataIntervalo = (data_obj, dataInicio, dataFim) => {
  if (!data_obj) return true;
  const data = new Date(data_obj).getTime();
  const inicio = dataInicio ? new Date(dataInicio).getTime() : 0;
  const fim = dataFim ? new Date(dataFim).getTime() + 86400000 : Infinity;
  return data >= inicio && data <= fim;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { obra_id, de, ate } = await req.json();
    if (!obra_id) {
      return Response.json({ error: 'Field obra_id is required' }, { status: 400 });
    }

    // Validar obra
    const obra = await base44.entities.Obra.get(obra_id);
    if (!obra) {
      return Response.json({ error: 'Obra not found' }, { status: 404 });
    }

    const custos = {
      materiais: 0,
      servicos: 0,
      mao_obra: 0,
      impostos: 0,
      administrativos: 0,
      outros: 0
    };
    let receita_prevista = 0;
    let receita_realizada = 0;
    const breakdown_por_categoria = [];
    const mapaCategorias = {};

    // Ler CategoriaFinanceira
    const categorias = await base44.entities.CategoriaFinanceira.list();
    const mapCat = {};
    categorias.forEach(c => {
      mapCat[c.id] = { nome: c.nome, grupo: c.grupo };
    });

    // MovimentacaoEstoque
    const movimentacoes = await base44.entities.MovimentacaoEstoque.filter({
      obra_destino_id: obra_id
    });
    let totalMateriais = 0;
    movimentacoes
      .filter(m => ['saida_consumo', 'saida'].includes(m.tipo))
      .forEach(m => {
        totalMateriais += normalizarValor(m.valor_total);
      });
    custos.materiais = totalMateriais;

    // ContaFinanceira
    const contas = await base44.entities.ContaFinanceira.filter({
      obra_id: obra_id
    });
    
    contas.forEach(c => {
      if (c.tipo === 'receber' && c.valor_recebido > 0) {
        if (aplicarFiltroDataIntervalo(c.updated_date, de, ate)) {
          receita_realizada += normalizarValor(c.valor_recebido);
        }
      }

      if (c.tipo === 'pagar' && ['pago', 'parcial'].includes(c.status)) {
        if (aplicarFiltroDataIntervalo(c.data_pagamento, de, ate)) {
          const catInfo = mapCat[c.categoria] || {};
          const grupo = catInfo.grupo || 'outros';
          
          if (grupo === 'material') return;

          const valor = normalizarValor(c.valor);
          custos[grupo === 'mao_obra' ? 'mao_obra' : 
                 grupo === 'servico' ? 'servicos' : 
                 grupo === 'imposto' ? 'impostos' : 
                 grupo === 'adm' ? 'administrativos' : 'outros'] += valor;

          const catId = c.categoria || 'sem_categoria';
          if (!mapaCategorias[catId]) {
            mapaCategorias[catId] = {
              categoria_id: catId,
              categoria_nome: catInfo.nome || 'Sem categoria',
              grupo: grupo,
              total: 0
            };
          }
          mapaCategorias[catId].total += valor;
        }
      }
    });

    // DiarioObra
    try {
      const diarios = await base44.entities.DiarioObra.filter({
        obra_id: obra_id
      });
      let totalDiario = 0;
      diarios.forEach(d => {
        if (aplicarFiltroDataIntervalo(d.data, de, ate)) {
          if (d.mao_obra && Array.isArray(d.mao_obra)) {
            d.mao_obra.forEach(mo => {
              totalDiario += normalizarValor(mo.valor_total || 0);
            });
          }
        }
      });
      if (totalDiario > 0) {
        custos.mao_obra += totalDiario;
      }
    } catch (e) {
      // Ignorar se não existir
    }

    // Orçamento
    try {
      const orcamentos = await base44.entities.Orcamento.filter({
        obra_id: obra_id
      });
      if (orcamentos.length > 0) {
        receita_prevista = normalizarValor(orcamentos[0].valor_proposta || 0);
      }
    } catch (e) {
      // Ignorar
    }

    const total_custos = Object.values(custos).reduce((a, b) => a + b, 0);
    const margem_bruta = receita_realizada - total_custos;
    const margem_percentual = receita_realizada > 0 
      ? (margem_bruta / receita_realizada) * 100 
      : 0;

    Object.values(mapaCategorias).forEach(cat => {
      breakdown_por_categoria.push(cat);
    });

    // Gerar CSV
    let csv = 'DRE - Demonstração de Resultado por Obra\n';
    csv += `Obra,${obra.nome}\n`;
    csv += `Período De,${de || 'Início'}\n`;
    csv += `Período Até,${ate || 'Fim'}\n`;
    csv += '\n';
    csv += 'RECEITAS\n';
    csv += `Receita Prevista,${receita_prevista.toFixed(2)}\n`;
    csv += `Receita Realizada,${receita_realizada.toFixed(2)}\n`;
    csv += '\n';
    csv += 'CUSTOS\n';
    csv += `Materiais,${custos.materiais.toFixed(2)}\n`;
    csv += `Serviços,${custos.servicos.toFixed(2)}\n`;
    csv += `Mão de Obra,${custos.mao_obra.toFixed(2)}\n`;
    csv += `Impostos,${custos.impostos.toFixed(2)}\n`;
    csv += `Administrativos,${custos.administrativos.toFixed(2)}\n`;
    csv += `Outros,${custos.outros.toFixed(2)}\n`;
    csv += `Total de Custos,${total_custos.toFixed(2)}\n`;
    csv += '\n';
    csv += 'RESULTADO\n';
    csv += `Margem Bruta,${margem_bruta.toFixed(2)}\n`;
    csv += `Margem %,${margem_percentual.toFixed(2)}%\n`;
    csv += '\n';
    csv += 'BREAKDOWN POR CATEGORIA\n';
    csv += 'Categoria,Grupo,Total\n';
    breakdown_por_categoria.forEach(cat => {
      csv += `${cat.categoria_nome},${cat.grupo},${cat.total.toFixed(2)}\n`;
    });

    const csv_base64 = btoa(csv);
    const filename = `DRE_${obra.codigo || obra_id}_${new Date().toISOString().split('T')[0]}.csv`;

    return Response.json({
      ok: true,
      build_id: `exportDre_${obra_id}_${Date.now()}`,
      csv_base64,
      filename
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
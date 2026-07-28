import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { composicoes, auto_create = false } = await req.json();

    if (!composicoes || !Array.isArray(composicoes)) {
      return Response.json({ error: 'composicoes obrigatórias' }, { status: 400 });
    }

    const validacao = {
      total_insumos: 0,
      insumos_existentes: 0,
      insumos_criados: 0,
      insumos_pendentes: [],
      composicoes_processadas: []
    };

    // Processar cada composição
    for (const comp of composicoes) {
      const comp_insumos = {
        comp_num: comp.comp_num,
        codigo: comp.codigo,
        descricao: comp.descricao,
        linhas_validadas: []
      };

      // Processar cada linha da composição
      for (const linha of (comp.linhas || [])) {
        validacao.total_insumos++;

        // Buscar insumo por código + unidade
        let insumo = null;
        
        if (linha.insumo_codigo) {
          const insumosExistentes = await base44.entities.Insumo.filter({
            codigo: linha.insumo_codigo,
            unidade: linha.insumo_unidade || 'un'
          });
          
          insumo = insumosExistentes?.[0];
        }

        // Se não encontrou e auto_create está ativo, criar insumo
        if (!insumo && auto_create) {
          const novoInsumo = await base44.entities.Insumo.create({
            codigo: linha.insumo_codigo || `AUTO_${Date.now()}_${Math.random()}`,
            descricao: linha.insumo_descricao || 'Insumo importado automaticamente',
            unidade: linha.insumo_unidade || 'un',
            valor_unitario: linha.valor_unitario || 0,
            status: 'ativo',
            origem: 'ORCA_FACIL'
          });

          validacao.insumos_criados++;
          comp_insumos.linhas_validadas.push({
            insumo_codigo: linha.insumo_codigo,
            insumo_descricao: linha.insumo_descricao,
            quantidade: linha.quantidade,
            valor_unitario: linha.valor_unitario,
            status: 'criado',
            insumo_id: novoInsumo.id
          });
        } else if (insumo) {
          validacao.insumos_existentes++;
          comp_insumos.linhas_validadas.push({
            insumo_codigo: linha.insumo_codigo,
            insumo_descricao: linha.insumo_descricao,
            quantidade: linha.quantidade,
            valor_unitario: linha.valor_unitario,
            status: 'existente',
            insumo_id: insumo.id
          });
        } else {
          // Não encontrou e não é para criar automaticamente
          validacao.insumos_pendentes.push({
            comp_num: comp.comp_num,
            comp_codigo: comp.codigo,
            insumo_codigo: linha.insumo_codigo,
            insumo_descricao: linha.insumo_descricao,
            insumo_unidade: linha.insumo_unidade,
            quantidade: linha.quantidade,
            valor_unitario: linha.valor_unitario,
            motivo: 'Insumo não encontrado no banco de dados'
          });

          comp_insumos.linhas_validadas.push({
            insumo_codigo: linha.insumo_codigo,
            insumo_descricao: linha.insumo_descricao,
            quantidade: linha.quantidade,
            valor_unitario: linha.valor_unitario,
            status: 'pendente_revisao',
            insumo_id: null
          });
        }
      }

      validacao.composicoes_processadas.push(comp_insumos);
    }

    // Calcular taxa de validação
    const taxa_validacao = validacao.total_insumos > 0
      ? Math.round(((validacao.insumos_existentes + validacao.insumos_criados) / validacao.total_insumos) * 100)
      : 100;

    return Response.json({
      sucesso: true,
      validacao: {
        taxa_validacao,
        total_insumos: validacao.total_insumos,
        insumos_existentes: validacao.insumos_existentes,
        insumos_criados: validacao.insumos_criados,
        insumos_pendentes_revisao: validacao.insumos_pendentes.length,
        auto_create_aplicado: auto_create
      },
      detalhes: validacao
    });

  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});
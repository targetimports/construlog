import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      insumo_id,
      material_estoque_id,
      composicao_id,
      orcamento_item_id,
      tipo_vinculo = 'manual',
      confianca = 100
    } = body;

    if (!insumo_id) {
      return Response.json({ error: 'insumo_id é obrigatório' }, { status: 400 });
    }

    // Validar que o insumo existe
    const insumo = await base44.entities.Insumo.get(insumo_id);
    if (!insumo) {
      return Response.json({ error: 'Insumo não encontrado' }, { status: 404 });
    }

    // Criar ou atualizar vínculo
    const vinculos_existentes = await base44.entities.VinculacaoOrcamentoEstoque.filter({
      insumo_id
    });

    let vinculo_id;

    if (vinculos_existentes.length > 0 && vinculos_existentes[0].status === 'confirmado') {
      // Atualizar histórico se já existe
      const vinculo = vinculos_existentes[0];
      const novo_historico = (vinculo.historico_mudancas || []);
      novo_historico.push({
        data: new Date().toISOString(),
        acao: 'vinculo_confirmado',
        usuario: user.email,
        detalhes: `Material: ${material_estoque_id}, Composição: ${composicao_id}, Item OC: ${orcamento_item_id}`
      });

      await base44.entities.VinculacaoOrcamentoEstoque.update(vinculo.id, {
        material_estoque_id: material_estoque_id || vinculo.material_estoque_id,
        composicao_id: composicao_id || vinculo.composicao_id,
        orcamento_item_id: orcamento_item_id || vinculo.orcamento_item_id,
        status: 'confirmado',
        confirmado_por: user.email,
        data_vinculacao: new Date().toISOString(),
        confianca,
        historico_mudancas: novo_historico
      });
      vinculo_id = vinculo.id;
    } else {
      // Criar novo vínculo
      const novo_vinculo = await base44.entities.VinculacaoOrcamentoEstoque.create({
        insumo_id,
        material_estoque_id,
        composicao_id,
        orcamento_item_id,
        tipo_vinculo,
        confianca,
        status: 'confirmado',
        confirmado_por: user.email,
        data_vinculacao: new Date().toISOString(),
        historico_mudancas: [
          {
            data: new Date().toISOString(),
            acao: 'vinculo_criado',
            usuario: user.email,
            detalhes: `Tipo: ${tipo_vinculo}`
          }
        ]
      });
      vinculo_id = novo_vinculo.id;
    }

    // Se for material de estoque, atualizar para referenciar insumo
    if (material_estoque_id) {
      await base44.entities.Material.update(material_estoque_id, {
        insumo_id // Adicionar referência do insumo no material
      });
    }

    return Response.json({
      vinculo_id,
      insumo_id,
      status: 'confirmado',
      mensagem: 'Vínculo estabelecido com sucesso'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
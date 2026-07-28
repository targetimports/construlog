import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { obra_id, arquivo_nome, preview, somaValores } = body;

    if (!obra_id || !preview || !Array.isArray(preview)) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verificar se obra existe
    const obra = await base44.entities.Obra.filter({ id: obra_id });
    if (!obra || obra.length === 0) {
      return Response.json({ error: 'Obra not found' }, { status: 404 });
    }

    // Criar orçamento
    const novoOrcamento = await base44.entities.Orcamento.create({
      obra_id: obra_id,
      versao: '1.0',
      titulo: `Importação - ${arquivo_nome}`,
      status: 'rascunho',
      valor_total: somaValores || 0,
      valor_total_materiais: 0,
      valor_total_mao_obra: 0,
      valor_total_equipamentos: 0,
      valor_total_transporte: 0
    });

    // Criar itens válidos
    const itensInseridos = [];
    for (const item of preview) {
      // Processar item mesmo que não tenha flag "valida" (pode vir da IA)
      if (item.descricao && (item.quantidade || item.valor_unitario || item.valor_total)) {
        try {
          const novoItem = await base44.entities.ItemOrcamento.create({
            orcamento_id: novoOrcamento.id,
            etapa: item.etapa || 'Geral',
            codigo: item.codigo || item.item_numero ? `ITEM-${item.item_numero || item.codigo}` : '',
            descricao: item.descricao,
            unidade: item.unidade || 'un',
            quantidade: typeof item.quantidade === 'number' ? item.quantidade : 0,
            categoria: 'materiais',
            custo_unitario: typeof item.custo_unitario === 'number' ? item.custo_unitario : 0,
            custo_total: typeof item.valor_total === 'number' ? item.valor_total : 0,
            valor_unitario: typeof item.valor_unitario === 'number' ? item.valor_unitario : 0,
            valor_total: typeof item.valor_total === 'number' ? item.valor_total : 0,
            bdi: typeof item.bdi === 'number' ? item.bdi : 0,
            percentual_executado: 0,
            observacoes: `Importado de ${arquivo_nome}`
          });
          itensInseridos.push(novoItem.id);
        } catch (itemError) {
          console.error(`Erro ao criar item: ${item.descricao}`, itemError.message);
          // Continua com próximo item mesmo se falhar
        }
      }
    }

    // Registrar importação
    const importacao = await base44.entities.ImportacaoOrcamento.create({
      orcamento_id: novoOrcamento.id,
      arquivo_nome: arquivo_nome,
      arquivo_url: '',
      data_importacao: new Date().toISOString(),
      usuario_importacao: user.email,
      status: itensInseridos.length > 0 ? 'sucesso' : 'erro',
      observacoes: `Importação com IA - ${itensInseridos.length} itens criados`
    });

    return Response.json({
      ok: true,
      orcamento_id: novoOrcamento.id,
      itens_criados: itensInseridos.length,
      importacao_id: importacao.id
    });

  } catch (error) {
    console.error('Import confirm error:', error);
    return Response.json({ 
      error: error.message || 'Confirm failed' 
    }, { status: 500 });
  }
});
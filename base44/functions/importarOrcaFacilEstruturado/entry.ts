import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      nome_obra,
      cliente,
      tipo = 'privada',
      status = 'orcamento',
      responsavel_user_id,
      cidade = '',
      estado = '',
      data_inicio = null,
      data_fim = null,
      materiais = []
    } = await req.json();

    // ============ VALIDAÇÕES OBRIGATÓRIAS ============
    if (!nome_obra?.trim()) {
      return Response.json({ error: 'Nome da obra é obrigatório' }, { status: 400 });
    }
    if (!cliente?.trim()) {
      return Response.json({ error: 'Cliente é obrigatório' }, { status: 400 });
    }
    if (!responsavel_user_id) {
      return Response.json({ error: 'Responsável é obrigatório' }, { status: 400 });
    }
    if (!materiais?.length) {
      return Response.json({ error: 'Selecione pelo menos um material' }, { status: 400 });
    }

    // ============ FASE 1: GARANTIR CLIENTE (NUNCA NULO) ============
    let clienteId;
    const clientesExistentes = await base44.asServiceRole.entities.Cliente.list();
    const clienteExistente = clientesExistentes.find(c => 
      c.nome?.toLowerCase().trim() === cliente.toLowerCase().trim()
    );

    if (clienteExistente) {
      clienteId = clienteExistente.id;
    } else {
      const novoCliente = await base44.asServiceRole.entities.Cliente.create({
        nome: cliente,
        email: 'contato@importadoorcafacil.com',
        telefone: ''
      });
      clienteId = novoCliente.id;
    }

    if (!clienteId) {
      throw new Error('Falha ao vincular cliente. Tente novamente.');
    }

    // ============ FASE 2: CRIAR OBRA (PERSISTÊNCIA OBRIGATÓRIA) ============
    const valorTotal = materiais.reduce((sum, m) => sum + (m.quantidade * (m.valorUnitario || 0)), 0);

    const obra = await base44.asServiceRole.entities.Obra.create({
      nome: nome_obra.trim(),
      cliente: cliente.trim(),
      cliente_id: clienteId,
      tipo: tipo,
      status: status,
      fase: 'orcamento',
      cidade: cidade.trim(),
      estado: estado.trim(),
      data_inicio: data_inicio,
      data_prevista_fim: data_fim,
      total_orcamento: valorTotal,
      total_final_orcamento: valorTotal,
      responsavel_obra: responsavel_user_id,
      import_source: 'ORCA_FACIL',
      import_status: 'DONE',
      imported_at: new Date().toISOString(),
      imported_by_user_id: user.email
    });

    if (!obra?.id) {
      throw new Error('Falha ao criar obra. Tente novamente.');
    }

    // ============ FASE 3: PROCESSAR MATERIAIS E INSUMOS ============
    const insumosProcessados = [];

    for (const material of materiais) {
      let insumoId;

      // Buscar insumo por nome normalizado
      try {
        const todosInsumos = await base44.asServiceRole.entities.Insumo.list();
        const insumoExistente = todosInsumos.find(ins => 
          ins.descricao?.toLowerCase().trim() === material.descricao?.toLowerCase().trim() &&
          ins.unidade === (material.unidade || 'un')
        );

        if (insumoExistente) {
          insumoId = insumoExistente.id;
        } else {
          const novoInsumo = await base44.asServiceRole.entities.Insumo.create({
            descricao: material.descricao,
            unidade: material.unidade || 'un',
            preco_unitario: material.valorUnitario || 0,
            import_source: 'ORCA_FACIL'
          });
          insumoId = novoInsumo.id;
        }
      } catch (e) {
        console.warn('Erro ao processar insumo:', e.message);
        continue;
      }

      // ============ REGISTRAR NECESSIDADE (NÃO MOVIMENTA ESTOQUE) ============
      try {
        const valorTotalPrevisto = material.quantidade * (material.valorUnitario || 0);
        
        await base44.asServiceRole.entities.NecessidadeMaterialObra.create({
          obra_id: obra.id,
          insumo_id: insumoId,
          quantidade_prevista: material.quantidade,
          unidade: material.unidade || 'un',
          valor_unitario_previsto: material.valorUnitario || 0,
          valor_total_previsto: valorTotalPrevisto,
          quantidade_comprada: 0,
          quantidade_utilizada: 0,
          saldo_necessario: material.quantidade,
          status: 'planejado',
          origem: 'ORCA_FACIL',
          import_session_id: import_session_id
        });

        insumosProcessados.push({
          descricao: material.descricao,
          quantidade: material.quantidade,
          unidade: material.unidade,
          insumo_id: insumoId
        });
      } catch (e) {
        console.warn('Erro ao criar necessidade:', e.message);
      }
    }

    // ============ LOG DE AUDITORIA ============
    try {
      await base44.asServiceRole.entities.LogAuditoria.create({
        user_email: user.email,
        acao: 'importar',
        modulo: 'obras',
        entidade: 'Obra',
        entidade_id: obra.id,
        dados_novos: {
          nome: obra.nome,
          cliente: obra.cliente,
          cliente_id: clienteId,
          responsavel: responsavel_user_id,
          total_materiais: materiais.length,
          valor_total: valorTotal,
          import_source: 'ORCA_FACIL'
        },
        sucesso: true,
        detalhes: `Obra '${obra.nome}' importada com ${materiais.length} materiais planejados`
      }).catch(() => null);
    } catch (e) {
      console.warn('Erro ao registrar auditoria:', e.message);
    }

    // ============ RESPOSTA FINAL (CONFIRMAÇÃO DE PERSISTÊNCIA) ============
    return Response.json({
      sucesso: true,
      mensagem: `Obra '${obra.nome}' criada com sucesso permanentemente no sistema.`,
      obra: {
        id: obra.id,
        nome: obra.nome,
        cliente: obra.cliente,
        cliente_id: clienteId,
        responsavel_obra: responsavel_user_id,
        total_materiais: insumosProcessados.length,
        valor_total: valorTotal,
        import_source: 'ORCA_FACIL',
        import_status: 'DONE',
        created_date: obra.created_date,
        data_inicio: obra.data_inicio,
        data_prevista_fim: obra.data_prevista_fim
      }
    });

  } catch (error) {
    console.error('Erro ao importar Orça Fácil:', error);
    return Response.json({
      error: 'Erro ao processar importação',
      details: error.message
    }, { status: 500 });
  }
});
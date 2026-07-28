import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload;
    try {
      payload = await req.json();
    } catch (parseErr) {
      console.error('[importarOrcaFacilCompleto] JSON parse error:', parseErr.message);
      return Response.json({
        error: 'Payload JSON inválido',
        details: parseErr.message
      }, { status: 400 });
    }

    const {
      import_run_id,
      file_url,
      nome_obra,
      cliente,
      tipo,
      status: obraStatus,
      responsavel_user_id,
      cidade,
      estado,
      data_inicio,
      data_fim,
      materiais
    } = payload;

    console.log('[importarOrcaFacilCompleto] Payload:', {
      file_url: !!file_url,
      nome_obra: !!nome_obra,
      responsavel_user_id: !!responsavel_user_id,
      materiais_count: Array.isArray(materiais) ? materiais.length : 'N/A',
      materiais_type: typeof materiais
    });

    // Validações
    if (!file_url || !nome_obra || !responsavel_user_id) {
      return Response.json({
        error: 'file_url, nome_obra e responsavel_user_id são obrigatórios',
        received: { file_url: !!file_url, nome_obra: !!nome_obra, responsavel_user_id: !!responsavel_user_id }
      }, { status: 400 });
    }

    if (!Array.isArray(materiais) || materiais.length === 0) {
      return Response.json({
        error: 'materiais deve ser um array não-vazio',
        received: { type: typeof materiais, isArray: Array.isArray(materiais), length: materiais?.length }
      }, { status: 422 });
    }

    // Validar cada material
    for (let i = 0; i < materiais.length; i++) {
      const m = materiais[i];
      if (!m.descricao || m.quantidade === undefined || m.quantidade === null) {
        return Response.json({
          error: `Material #${i} inválido: descricao e quantidade são obrigatórios`,
          material: m
        }, { status: 422 });
      }
    }

    // ============ CRIAR OBRA COM PERSISTÊNCIA ============
    const valorTotal = materiais.reduce((sum, m) => sum + (m.quantidade * (m.valorUnitario || 0)), 0);
    
    const obra = await base44.asServiceRole.entities.Obra.create({
      nome: nome_obra,
      cliente: cliente || 'Importado do Orça Fácil',
      tipo: tipo || 'privada',
      status: obraStatus || 'orcamento',
      fase: 'orcamento',
      cidade: cidade || '',
      estado: estado || '',
      data_inicio: data_inicio || null,
      data_prevista_fim: data_fim || null,
      total_orcamento: valorTotal,
      total_final_orcamento: valorTotal,
      import_source: 'ORCA_FACIL',
      import_status: 'DONE',
      imported_at: new Date().toISOString(),
      imported_by_user_id: user.email,
      import_session_id: import_run_id,
      responsavel_obra: responsavel_user_id
    });

    // ============ CRIAR ITENS DO ORÇAMENTO ============
    const itensOrcamento = [];
    
    for (let i = 0; i < materiais.length; i++) {
      const material = materiais[i];
      const valorItemTotal = material.quantidade * (material.valorUnitario || 0);
      
      const item = await base44.asServiceRole.entities.ItemOrcamento.create({
        orcamento_id: obra.id,
        descricao: material.descricao,
        unidade: material.unidade || 'un',
        quantidade: material.quantidade,
        categoria: 'materiais',
        valor_unitario: material.valorUnitario || 0,
        valor_total: valorItemTotal,
        import_source: 'ORCA_FACIL',
        import_session_id: import_run_id
      });
      
      itensOrcamento.push(item);

      // Criar insumo se não existir
      try {
        // Buscar por descrição normalizada (case-insensitive)
        const todosInsumos = await base44.asServiceRole.entities.Insumo.list();
        const insumosExistentes = todosInsumos.filter(ins => 
          ins.descricao?.toLowerCase().trim() === material.descricao?.toLowerCase().trim() &&
          ins.unidade === (material.unidade || 'un')
        );

        let insumoId;
        if (insumosExistentes.length > 0) {
          insumoId = insumosExistentes[0].id;
        } else {
          const novoInsumo = await base44.asServiceRole.entities.Insumo.create({
            descricao: material.descricao,
            unidade: material.unidade || 'un',
            preco_unitario: material.valorUnitario || 0,
            import_source: 'ORCA_FACIL',
            is_from_import: true
          });
          insumoId = novoInsumo.id;
        }

        // Vincular insumo ao item
        await base44.asServiceRole.entities.ItemOrcamento.update(item.id, {
          insumo_id: insumoId
        });
      } catch (e) {
        console.warn('Aviso ao criar insumo para', material.descricao, ':', e.message);
      }
    }

    // ============ CRIAR DEMANDAS DE ESTOQUE ============
    try {
      for (const material of materiais) {
        if (['m', 'm2', 'm3', 'kg', 'l', 'un', 'sc'].includes(material.unidade?.toLowerCase())) {
          await base44.asServiceRole.entities.DemandaEstoqueObra.create({
            obra_id: obra.id,
            descricao_insumo: material.descricao,
            quantidade: material.quantidade,
            unidade: material.unidade,
            valor_unitario: material.valorUnitario || 0,
            status: 'planejado',
            import_source: 'ORCA_FACIL'
          }).catch(() => null);
        }
      }
    } catch (e) {
      console.warn('Aviso ao criar demandas:', e.message);
    }

    // ============ REGISTRAR LOG DE AUDITORIA ============
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
          total_itens: itensOrcamento.length,
          valor_total: valorTotal,
          import_source: 'ORCA_FACIL'
        },
        sucesso: true,
        detalhes: `Obra importada do Orça Fácil com ${itensOrcamento.length} itens`
      }).catch(() => null);
    } catch (e) {
      console.warn('Aviso ao registrar log:', e.message);
    }

    // ============ RESPOSTA FINAL ============
    return Response.json({
      sucesso: true,
      mensagem: `Obra '${obra.nome}' importada com sucesso com ${itensOrcamento.length} itens.`,
      obra: {
        id: obra.id,
        nome: obra.nome,
        cliente: obra.cliente,
        total_itens: itensOrcamento.length,
        valor_total: valorTotal,
        import_source: 'ORCA_FACIL',
        import_status: 'DONE',
        responsavel: responsavel_user_id
      }
    });

  } catch (error) {
    console.error('Erro ao importar Orça Fácil completo:', error);
    return Response.json({
      error: 'Erro ao processar importação',
      details: error.message
    }, { status: 500 });
  }
});
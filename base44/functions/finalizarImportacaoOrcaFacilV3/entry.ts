import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function err400(code, message, details = {}) {
  console.error('IMPORT_ERROR', JSON.stringify({ code, message, details }));
  return Response.json({ message, code, details }, { status: 400 });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ message: 'Não autenticado', code: 'UNAUTHORIZED' }, { status: 401 });

    let payload;
    try { payload = await req.json(); } catch (_) {
      return err400('PAYLOAD_INVALID', 'Body inválido — não é JSON válido');
    }

    if (!payload?.obraData) {
      return err400('OBRA_DATA_MISSING', 'Campo obraData é obrigatório', { payloadKeys: Object.keys(payload || {}) });
    }

    const od = payload.obraData;

    // ── Validação de campos obrigatórios no backend ──
    const camposObrigatorios = [
      { campo: 'nome',                label: 'Nome da Obra' },
      { campo: 'responsavel_tecnico', label: 'Responsável Técnico' },
      { campo: 'responsavel_obra',    label: 'Responsável da Obra' },
      { campo: 'data_inicio',         label: 'Data de Início' },
      { campo: 'data_prevista_fim',   label: 'Data Prevista de Fim' },
      { campo: 'cidade',              label: 'Cidade' },
      { campo: 'estado',              label: 'Estado' },
    ];
    const faltando = camposObrigatorios
      .filter(({ campo }) => !od[campo]?.toString().trim())
      .map(({ label }) => label);

    const temCliente = od.cliente_id || od.cliente_nome || od.novo_cliente_nome;
    if (!temCliente) faltando.push('Cliente/Contratante');

    if (faltando.length > 0) {
      return err400('CAMPOS_OBRIGATORIOS_FALTANDO',
        `Campos obrigatórios ausentes: ${faltando.join(', ')}`,
        { faltando });
    }

    // ── Resolver nome do cliente ──
    // Prioridade: cliente_nome explícito > novo_cliente_nome > buscar por ID > campo legado "cliente"
    let clienteNome = null;
    if (od.cliente_nome && !/^[a-f0-9]{24,}$/.test(od.cliente_nome)) {
      clienteNome = od.cliente_nome;
    } else if (od.novo_cliente_nome) {
      clienteNome = od.novo_cliente_nome;
    } else if (od.cliente_id) {
      try {
        const clienteEncontrado = await base44.asServiceRole.entities.Cliente.filter({ id: od.cliente_id });
        if (clienteEncontrado && clienteEncontrado.length > 0) {
          clienteNome = clienteEncontrado[0].nome;
        }
      } catch (_) { /* ignora */ }
    }
    // Fallback: campo "cliente" legado (só se não for ID hex)
    if (!clienteNome && od.cliente && !/^[a-f0-9]{24,}$/.test(od.cliente)) {
      clienteNome = od.cliente;
    }
    // Último recurso — sem nome real definido
    if (!clienteNome) clienteNome = 'Sem cliente definido';
    console.log(`📋 Cliente resolvido: "${clienteNome}" (cliente_id: ${od.cliente_id || 'N/A'})`);

    // ── Montar obraData (campo "cliente" é obrigatório no schema) ──
    const obraPayload = {
      nome: (od.nome || '').trim() || 'Obra sem nome',
      status: od.status || 'orcamento',
      cliente: clienteNome,                   // campo obrigatório no schema Obra
      cliente_nome: clienteNome,
      ...(od.cliente_id        && { cliente_id: od.cliente_id }),
      ...(od.tipo              && { tipo: od.tipo }),
      ...(od.cidade            && { cidade: od.cidade }),
      ...(od.estado            && { estado: od.estado }),
      ...(od.endereco_rua      && { endereco: od.endereco_rua }),
      ...(od.endereco_cep      && { cep: od.endereco_cep }),
      ...(od.responsavel_tecnico && { responsavel_tecnico: od.responsavel_tecnico }),
      ...(od.responsavel_obra  && { responsavel_obra: od.responsavel_obra }),
      ...(od.data_inicio       && { data_inicio: od.data_inicio }),
      ...(od.data_prevista_fim && { data_prevista_fim: od.data_prevista_fim }),
      ...(od.categoria_dre     && { categoria_dre: od.categoria_dre }),
      ...(od.tipo_estrutural   && { tipo_estrutural: od.tipo_estrutural }),
      ...(od.tipo_intervencao  && { tipo_intervencao: od.tipo_intervencao }),
      ...(od.centro_custo_codigo && { centro_custo_codigo: od.centro_custo_codigo }),
      ...(od.centro_custo_nome   && { centro_custo_nome: od.centro_custo_nome }),
      importada_orca_facil: true,
      importada_orca_facil_em: new Date().toISOString(),
      import_source: 'ORCA_FACIL',
      import_status: 'DONE',
    };

    // ── 1) Criar Obra ──
    let obra;
    try {
      obra = await base44.entities.Obra.create(obraPayload);
    } catch (e) {
      return err400('OBRA_CREATE_FAILED', `Falha ao criar a obra: ${e.message}`, { obraData: obraPayload });
    }
    const obraId = obra.id;
    console.log('✅ Obra criada:', obraId, obra.nome);

    // ── 2) Criar Orçamento + ItemOrcamento (entidade correta) ──
    let totalOrcamento = 0;
    let orcamentoId = null;
    let orcamentoItensCount = 0;

    const sintetico = payload.sintetico || payload.orcamento || payload.orcamentoDados;
    if (sintetico) {
      const arrayItens = sintetico.itens || sintetico.items || [];
      const totalGeral = sintetico.meta?.total_geral
        || arrayItens.filter(i => i.is_grupo).reduce((s, i) => s + (i.total || 0), 0)
        || 0;

      try {
        const orcamento = await base44.entities.Orcamento.create({
          obra_id: obraId,
          versao: '1',
          titulo: 'Orçamento Importado - Orça Fácil',
          status: 'vigente',
          valor_total: totalGeral,
          valor_total_materiais: totalGeral,
          margem_lucro_percentual: sintetico.meta?.bdi_percent || 0,
          observacoes: `Importado via Orça Fácil em ${new Date().toLocaleDateString('pt-BR')}`,
          data_criacao: new Date().toISOString().split('T')[0],
        });
        orcamentoId = orcamento.id;
        totalOrcamento = totalGeral;
        console.log('✅ Orçamento criado:', orcamentoId, '| Total:', totalGeral);

        // Criar ItemOrcamento + NecessidadeMaterialObra para cada linha
        const necessidadesMap = new Map(); // Rastreio para evitar duplicatas
        
        for (let idx = 0; idx < arrayItens.length; idx++) {
          const it = arrayItens[idx];
          if (it.is_grupo) continue; // Pular grupos
          
          try {
            await base44.entities.ItemOrcamento.create({
              orcamento_id: orcamentoId,
              etapa: arrayItens.find(g => g.is_grupo && it.item?.startsWith(g.item + '.'))?.descricao || '',
              codigo: it.codigo || it.item || String(idx + 1),
              descricao: it.descricao || 'Item importado',
              unidade: it.und || it.unidade || 'vb',
              quantidade: it.quantidade || 1,
              categoria: 'materiais',
              custo_unitario: it.valor_unit || 0,
              custo_total: it.total || 0,
              valor_unitario: it.valor_unit_bdi || it.valor_unit || 0,
              valor_total: it.total || 0,
              percentual_executado: 0,
            });
            orcamentoItensCount++;
            
            // Criar NecessidadeMaterialObra para este item
            // Agrupar por descrição para evitar necessidades duplicadas
            const chave = (it.descricao || '').toLowerCase().trim();
            if (!necessidadesMap.has(chave)) {
              necessidadesMap.set(chave, {
                quantidade: 0,
                valor_unitario: it.valor_unit || 0,
                unidade: it.und || it.unidade || 'un',
                descricao: it.descricao || 'Item importado'
              });
            }
            const item_existente = necessidadesMap.get(chave);
            item_existente.quantidade += (it.quantidade || 1);
          } catch (err) {
            console.warn('⚠️ ItemOrcamento:', it.descricao, '-', err.message);
          }
        }
        console.log('✅ ItemOrcamento criados:', orcamentoItensCount, '/', arrayItens.length);

        // Agora criar NecessidadeMaterialObra para cada material único
        let necessidadesCount = 0;
        for (const [chave, material] of necessidadesMap.entries()) {
          try {
            await base44.entities.NecessidadeMaterialObra.create({
              obra_id: obraId,
              quantidade_prevista: material.quantidade,
              unidade: material.unidade,
              valor_unitario_previsto: material.valor_unitario,
              valor_total_previsto: material.quantidade * material.valor_unitario,
              quantidade_comprada: 0,
              quantidade_utilizada: 0,
              saldo_necessario: material.quantidade,
              origem: 'ORCA_FACIL',
              import_session_id: orcamentoId,
              status: 'planejado',
            });
            necessidadesCount++;
          } catch (err) {
            console.error('❌ NecessidadeMaterialObra falha para:', chave, '-', err.message);
          }
        }
        console.log('✅ NecessidadeMaterialObra criadas:', necessidadesCount, 'materiais planejados');

        // Atualizar Obra com total orçado
        await base44.asServiceRole.entities.Obra.update(obraId, {
          orcamento_id: orcamentoId,
          total_orcamento: totalGeral,
          total_final_orcamento: totalGeral,
          bdi_percent: sintetico.meta?.bdi_percent || 0,
        });
      } catch (err) {
        console.warn('⚠️ Erro ao processar orçamento:', err.message);
      }
    }

    // ── 3) Inicializar Financeiro (conta base de previsão orçamentária) ──
    if (totalOrcamento > 0) {
      try {
        const dataVenc = od.data_prevista_fim || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        await base44.entities.ContaFinanceira.create({
          obra_id: obraId,
          tipo: 'pagar',
          descricao: 'Previsão Orçamentária - Orça Fácil',
          valor: totalOrcamento,
          valor_pago: 0,
          data_vencimento: dataVenc,
          status: 'pendente',
          categoria: 'outros',
          observacao: `Previsão gerada automaticamente na importação. Orçamento: ${orcamentoId || 'N/A'}`,
          referencia_tipo: 'contrato',
          fornecedor_cliente: clienteNome,
        });
        console.log('✅ Conta financeira base criada');
      } catch (err) {
        console.warn('⚠️ Financeiro base não criado:', err.message);
      }
    }

    // ── 4) Cronograma ──
    const atividadesRaw = (() => {
      if (!payload.cronograma) return [];
      if (Array.isArray(payload.cronograma?.atividades)) return payload.cronograma.atividades;
      if (Array.isArray(payload.cronograma)) return payload.cronograma;
      return [];
    })();

    // Limpar cronograma anterior (preservar manuais)
    const [cronosAntigos, marcosAntigos] = await Promise.all([
      base44.asServiceRole.entities.CronogramaItem.filter({ obraId }) || [],
      base44.asServiceRole.entities.MarcoObra.filter({ obra_id: obraId }) || [],
    ]);
    const cronosParaApagar = (cronosAntigos || []).filter(i => i.origem !== 'MANUAL' && !i.manual);
    await Promise.all([
      ...cronosParaApagar.map(i => base44.asServiceRole.entities.CronogramaItem.delete(i.id)),
      ...(marcosAntigos || []).map(m => base44.asServiceRole.entities.MarcoObra.delete(m.id)),
    ]);

    const dataBase = od.data_inicio ? new Date(od.data_inicio) : new Date();
    const addDias = (base, dias) => {
      const d = new Date(base); d.setDate(d.getDate() + dias);
      return d.toISOString().split('T')[0];
    };

    let criadosCount = 0;
    for (let ai = 0; ai < atividadesRaw.length; ai++) {
      const a = atividadesRaw[ai];
      try {
        const nome = (a.nomeAtividade || a.nome || a.descricao || 'Sem nome').substring(0, 255);
        let dataInicio = a.dataInicioPlanejada || a.inicio || a.data_inicio;
        let dataFim = a.dataFimPlanejada || a.fim || a.data_fim;

        if (!dataInicio || !dataFim) {
          const periodos = a.periodos || {};
          const keysNum = Object.keys(periodos).map(k => parseInt(k) || 0).filter(n => n > 0).sort((x, y) => x - y);
          const minDias = keysNum[0] || (ai * 30);
          const maxDias = keysNum[keysNum.length - 1] || (ai * 30 + 30);
          dataInicio = addDias(dataBase, minDias > 30 ? minDias - 30 : 0);
          dataFim = addDias(dataBase, maxDias);
        }
        if (dataInicio && dataFim && new Date(dataFim) < new Date(dataInicio)) {
          dataFim = addDias(new Date(dataInicio), 30);
        }

        await base44.entities.CronogramaItem.create({
          obraId,
          nomeAtividade: nome,
          dataInicioPlanejada: dataInicio,
          dataFimPlanejada: dataFim,
          quantidadePlanejada: a.quantidadePlanejada || a.quantidade || 1,
          status: 'Não iniciado',
          percentualConcluido: 0,
          und: a.und || a.unidade || 'vb',
          origem: 'IMPORT',
        });

        await base44.entities.MarcoObra.create({
          obra_id: obraId,
          titulo: nome,
          descricao: `Item importado #${ai + 1}`,
          data_prevista: dataFim,
          status: 'pendente',
        });

        criadosCount++;
      } catch (err) {
        console.warn('⚠️ Cronograma item:', ai, '-', err.message);
      }
    }
    console.log(`✅ Cronograma: ${criadosCount}/${atividadesRaw.length}`);

    return Response.json({
      obraId,
      totalOrcamento,
      orcamentoId,
      orcamentoItems: orcamentoItensCount,
      cronogramaSalvo: criadosCount,
      message: `✅ Importação finalizada! Obra "${obraPayload.nome}" criada com ${orcamentoItensCount} itens de orçamento e ${criadosCount} atividades.`,
    });

  } catch (error) {
    console.error('❌ Erro fatal:', error.message, error.stack);
    return Response.json({
      message: error.message || 'Erro interno',
      code: 'INTERNAL_ERROR',
    }, { status: 400 });
  }
});
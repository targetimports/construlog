import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const isMongoId = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v.trim());

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado — apenas admin' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const { dry_run = false, obra_ids = null } = payload;

    console.log(`🔧 [backfillObrasImportadas] dry_run=${dry_run} | obra_ids=${obra_ids?.join(',') || 'TODAS'}`);

    // ── 1) Buscar obras importadas via Orça Fácil ──
    let obras = [];
    if (obra_ids && obra_ids.length > 0) {
      // IDs específicos
      for (const id of obra_ids) {
        try {
          const r = await base44.asServiceRole.entities.Obra.filter({ id });
          if (r && r.length > 0) obras.push(r[0]);
        } catch (_) {}
      }
    } else {
      // Todas as importadas via Orça Fácil
      obras = await base44.asServiceRole.entities.Obra.filter({ importada_orca_facil: true }) || [];
      // Também incluir obras com import_source = ORCA_FACIL
      const porImportSource = await base44.asServiceRole.entities.Obra.filter({ import_source: 'ORCA_FACIL' }) || [];
      // Merge sem duplicatas
      const ids = new Set(obras.map(o => o.id));
      for (const o of porImportSource) {
        if (!ids.has(o.id)) { obras.push(o); ids.add(o.id); }
      }
    }

    console.log(`📋 Total de obras para análise: ${obras.length}`);

    const relatorio = {
      total: obras.length,
      corrigidas: 0,
      sem_alteracao: 0,
      erros: 0,
      obras: []
    };

    for (const obra of obras) {
      const item = {
        id: obra.id,
        nome: obra.nome,
        acoes: [],
        pendencias: [],
        erro: null
      };

      const updates = {};

      try {
        // ── A) RECONCILIAR CLIENTE ──
        const clienteEhFallback =
          obra.cliente === 'Cliente Importação' ||
          obra.cliente_nome === 'Cliente Importação' ||
          !obra.cliente ||
          isMongoId(obra.cliente);

        if (clienteEhFallback && obra.cliente_id) {
          // Tentar buscar nome real pelo ID
          try {
            const clientes = await base44.asServiceRole.entities.Cliente.filter({ id: obra.cliente_id });
            if (clientes && clientes.length > 0) {
              const nomeReal = clientes[0].nome || clientes[0].razao_social;
              if (nomeReal) {
                updates.cliente = nomeReal;
                updates.cliente_nome = nomeReal;
                item.acoes.push(`cliente: "${obra.cliente}" → "${nomeReal}"`);
              }
            }
          } catch (e) {
            item.pendencias.push(`Não foi possível buscar cliente_id=${obra.cliente_id}: ${e.message}`);
          }
        } else if (clienteEhFallback && !obra.cliente_id) {
          item.pendencias.push('cliente_id ausente — não é possível recuperar nome do cliente');
        }

        // Garantir que cliente_nome seja consistente com cliente (se não for ID)
        if (!updates.cliente_nome && obra.cliente && !isMongoId(obra.cliente) && obra.cliente !== obra.cliente_nome) {
          updates.cliente_nome = obra.cliente;
          item.acoes.push(`cliente_nome sincronizado com cliente: "${obra.cliente}"`);
        }

        // ── B) RECONCILIAR ENDEREÇO ──
        if (!obra.cep && obra.endereco_cep) {
          updates.cep = obra.endereco_cep;
          item.acoes.push(`cep recuperado de endereco_cep: "${obra.endereco_cep}"`);
        }
        if (!obra.endereco && obra.endereco_rua) {
          updates.endereco = obra.endereco_rua;
          item.acoes.push(`endereco recuperado de endereco_rua: "${obra.endereco_rua}"`);
        }
        if (!obra.cidade && obra.cidade_nome) {
          updates.cidade = obra.cidade_nome;
          item.acoes.push(`cidade recuperada de cidade_nome: "${obra.cidade_nome}"`);
        }
        if (!obra.estado && obra.uf) {
          updates.estado = obra.uf;
          item.acoes.push(`estado recuperado de uf: "${obra.uf}"`);
        }
        if (obra.cidade && !obra.estado) {
          item.pendencias.push('estado/UF ausente — não foi possível recuperar');
        }
        if (!obra.cidade && !obra.estado) {
          item.pendencias.push('cidade e estado ausentes — sem dados fonte para recuperar');
        }

        // ── C) RECONCILIAR ORÇAMENTO E MATERIAIS ──
        // Buscar orçamento associado
        if (obra.orcamento_id || obra.total_orcamento > 0) {
          const orcamento_id = obra.orcamento_id;
          if (orcamento_id) {
            // Verificar se itens existem
            const itens = await base44.asServiceRole.entities.ItemOrcamento.filter({ orcamento_id }) || [];
            item.acoes.push(`orçamento ${orcamento_id}: ${itens.length} itens encontrados`);

            // Recalcular total se divergente
            if (itens.length > 0) {
              const totalCalculado = itens.reduce((s, i) => s + (i.custo_total || i.valor_total || 0), 0);
              if (totalCalculado > 0 && Math.abs(totalCalculado - (obra.total_orcamento || 0)) > 1) {
                updates.total_orcamento = totalCalculado;
                updates.total_final_orcamento = totalCalculado;
                item.acoes.push(`total_orcamento recalculado: ${obra.total_orcamento || 0} → ${totalCalculado}`);
              }
            }
          }
        }

        // ── D) APLICAR UPDATES ──
        if (Object.keys(updates).length > 0) {
          if (!dry_run) {
            await base44.asServiceRole.entities.Obra.update(obra.id, updates);
          }
          item.status = dry_run ? 'simulado' : 'corrigido';
          relatorio.corrigidas++;
        } else {
          item.status = 'sem_alteracao';
          relatorio.sem_alteracao++;
        }

      } catch (e) {
        item.status = 'erro';
        item.erro = e.message;
        relatorio.erros++;
        console.error(`❌ Erro ao processar obra ${obra.id}:`, e.message);
      }

      relatorio.obras.push(item);
    }

    console.log(`✅ Backfill concluído: ${relatorio.corrigidas} corrigidas, ${relatorio.sem_alteracao} sem alteração, ${relatorio.erros} erros`);

    return Response.json({
      success: true,
      dry_run,
      relatorio
    });

  } catch (error) {
    console.error('❌ Erro fatal backfill:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
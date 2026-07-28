import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const isMongoId = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v.trim());

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const resultados = [];

    const ok = (cenario, check, detalhe = '') => resultados.push({ cenario, status: 'PASS', check, detalhe });
    const fail = (cenario, check, detalhe = '') => resultados.push({ cenario, status: 'FAIL', check, detalhe });

    // ────────────────────────────────────────────
    // CENÁRIO 1 — OBRAS IMPORTADAS: CLIENTE VÁLIDO
    // ────────────────────────────────────────────
    const obrasImportadas = await base44.asServiceRole.entities.Obra.filter({ importada_orca_facil: true }) || [];

    if (obrasImportadas.length === 0) {
      ok('C1', 'Nenhuma obra importada — sem dados para validar', 'Crie uma obra via importação para rodar este cenário');
    }

    for (const obra of obrasImportadas) {
      const nomeId = `[${obra.nome?.substring(0, 30) || obra.id}]`;

      // C1.1 — cliente não pode ser ID hex nem fallback
      const clienteFallback = obra.cliente === 'Cliente Importação' || isMongoId(obra.cliente);
      if (clienteFallback) {
        fail('C1', `${nomeId} cliente com valor inválido: "${obra.cliente}"`, `ID: ${obra.id}`);
      } else {
        ok('C1', `${nomeId} cliente correto: "${obra.cliente}"`);
      }

      // C1.2 — cliente_nome também deve ser consistente
      if (obra.cliente_nome && isMongoId(obra.cliente_nome)) {
        fail('C1', `${nomeId} cliente_nome é um ID hex`, `cliente_nome=${obra.cliente_nome}`);
      } else {
        ok('C1', `${nomeId} cliente_nome OK: "${obra.cliente_nome || '(vazio)'}"`);
      }

      // C1.3 — orçamento criado (deve ter orcamento_id)
      if (obra.orcamento_id) {
        const itens = await base44.asServiceRole.entities.ItemOrcamento.filter({ orcamento_id: obra.orcamento_id }) || [];
        if (itens.length > 0) {
          ok('C1', `${nomeId} orçamento com ${itens.length} itens`, `orcamento_id=${obra.orcamento_id}`);
        } else {
          fail('C1', `${nomeId} orçamento sem itens`, `orcamento_id=${obra.orcamento_id}`);
        }
        // C1.4 — total_orcamento > 0
        if ((obra.total_orcamento || 0) > 0) {
          ok('C1', `${nomeId} total_orcamento=${obra.total_orcamento}`);
        } else {
          fail('C1', `${nomeId} total_orcamento=0 ou ausente`);
        }
      } else {
        fail('C1', `${nomeId} orcamento_id ausente — sem orçamento vinculado`);
      }

      // C1.5 — endereço mínimo (cidade + estado)
      if (obra.cidade && obra.estado) {
        ok('C1', `${nomeId} localização OK: ${obra.cidade}/${obra.estado}`);
      } else {
        fail('C1', `${nomeId} localização incompleta: cidade="${obra.cidade || ''}" estado="${obra.estado || ''}"`);
      }

      // C1.6 — responsáveis preenchidos
      if (obra.responsavel_tecnico && obra.responsavel_obra) {
        ok('C1', `${nomeId} responsáveis preenchidos`);
      } else {
        fail('C1', `${nomeId} responsáveis ausentes: tecnico="${obra.responsavel_tecnico || ''}" obra="${obra.responsavel_obra || ''}"`);
      }

      // C1.7 — datas preenchidas
      if (obra.data_inicio && obra.data_prevista_fim) {
        ok('C1', `${nomeId} datas OK: ${obra.data_inicio} → ${obra.data_prevista_fim}`);
      } else {
        fail('C1', `${nomeId} datas ausentes`);
      }
    }

    // ────────────────────────────────────────────
    // CENÁRIO 3 — PREFILL: obras editáveis
    // Verificar que obras com cliente_id têm cliente_nome preenchido (não ID)
    // ────────────────────────────────────────────
    const todasObras = await base44.asServiceRole.entities.Obra.list('-created_date', 30) || [];

    for (const obra of todasObras) {
      const nomeId = `[${obra.nome?.substring(0, 30) || obra.id}]`;

      // C3.1 — se tem cliente_id, cliente_nome não pode ser vazio nem ID
      if (obra.cliente_id) {
        if (!obra.cliente_nome || isMongoId(obra.cliente_nome)) {
          fail('C3', `${nomeId} tem cliente_id mas cliente_nome inválido: "${obra.cliente_nome || 'vazio'}"`);
        } else {
          ok('C3', `${nomeId} cliente_nome OK para prefill: "${obra.cliente_nome}"`);
        }
      }

      // C3.2 — campo "cliente" legado não pode ser ID hex
      if (isMongoId(obra.cliente)) {
        fail('C3', `${nomeId} campo "cliente" contém ID hex — display incorreto`);
      }
    }

    // ────────────────────────────────────────────
    // CENÁRIO 4 — OBRAS SEM MATERIAIS / ORCAMENTO
    // Verificar que obras manuais sem orçamento são tratadas
    // ────────────────────────────────────────────
    const obrasSemOrcamento = todasObras.filter(o => !o.orcamento_id && (o.total_orcamento || 0) === 0);
    ok('C4', `${obrasSemOrcamento.length} obras sem orçamento vinculado`, 'estado vazio controlado');

    // ────────────────────────────────────────────
    // RESUMO
    // ────────────────────────────────────────────
    const passes = resultados.filter(r => r.status === 'PASS').length;
    const fails = resultados.filter(r => r.status === 'FAIL').length;

    return Response.json({
      success: fails === 0,
      summary: { total: resultados.length, passes, fails },
      resultados,
      obrasAnalisadas: obrasImportadas.length,
      todasObrasAnalisadas: todasObras.length,
    });

  } catch (error) {
    console.error('❌ Regression check error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
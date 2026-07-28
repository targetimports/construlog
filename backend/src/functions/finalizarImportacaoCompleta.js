import { store } from '../entityStore.js';

// Porte da function base44 `finalizarImportacaoCompleta` (Deno) para Node.
// Cria Obra + OrcamentoPlanejado + Cronograma + Itens do orçamento + status.

const MESES_PT = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };

// Converte o rótulo de um período do cronograma físico-financeiro em "YYYY-MM".
// Aceita "06/2026", "Jun/2026", "junho 2026"; se for "1º Período"/sem data,
// calcula a partir da data de início da obra + índice do período.
function labelParaMes(label, idx, obraStartISO) {
  const l = String(label || '').toLowerCase().trim();
  let m = l.match(/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const yy = m[2].length === 2 ? 2000 + parseInt(m[2], 10) : parseInt(m[2], 10);
    return `${yy}-${String(parseInt(m[1], 10)).padStart(2, '0')}`;
  }
  m = l.match(/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*[\s/-]*(\d{2,4})/);
  if (m) {
    const yy = m[2].length === 2 ? 2000 + parseInt(m[2], 10) : parseInt(m[2], 10);
    return `${yy}-${String(MESES_PT[m[1]] + 1).padStart(2, '0')}`;
  }
  const base = obraStartISO ? new Date(obraStartISO) : null;
  if (base && !isNaN(base.getTime())) {
    const d = new Date(base.getFullYear(), base.getMonth() + idx, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  return `P${idx + 1}`;
}

function normalizeOrcamentoPayload(payload = {}) {
  const raw = payload.versao ?? payload.version ?? payload.versao_orcamento ?? '1';
  let versao = '1';
  if (raw === null || raw === undefined) versao = '1';
  else if (typeof raw === 'object') versao = '1';
  else versao = String(raw).trim() || '1';
  return { ...payload, versao };
}

// Persiste os itens em ItemOrcamento (síncrono). Retorna estatísticas.
async function processarItensSync(obraId, dadosSintetico, createdBy) {
  const itensSrcRaw = dadosSintetico?.itens || dadosSintetico?.itensOrcamento || [];
  const itensSrc = itensSrcRaw.filter((it) => !it.is_grupo);
  const itens_parseados = itensSrc.length;

  // Mapa código-da-etapa -> nome (grupos de nível topo do sintético).
  // Permite preservar a etapa de cada item (base da evolução por etapa na medição).
  const mapaEtapa = {};
  for (const g of itensSrcRaw) {
    if (g.is_grupo && g.item) mapaEtapa[String(g.item).trim()] = g.descricao || g.nome || `Etapa ${g.item}`;
  }
  // Etapa de um item = grupo nomeado mais próximo na hierarquia (sobe a partir do
  // pai imediato). Ex.: item "1.1.1.1" -> etapa "1.1.1" (SERVIÇOS PRELIMINARES).
  // Mais granular e fiel à planilha do que usar só o primeiro nível.
  const etapaDoItem = (codigo) => {
    const c = String(codigo || '').trim();
    if (!c) return { etapa: 'Geral', etapa_codigo: '' };
    const partes = c.split('.');
    for (let n = partes.length - 1; n >= 1; n--) {
      const code = partes.slice(0, n).join('.');
      if (mapaEtapa[code]) return { etapa: mapaEtapa[code], etapa_codigo: code };
    }
    const topo = partes[0];
    return { etapa: mapaEtapa[topo] || 'Geral', etapa_codigo: topo };
  };

  if (itens_parseados === 0) {
    return { ok: false, itens_parseados: 0, itens_persistidos: 0, erro: 'Nenhum item encontrado na estrutura do orçamento' };
  }

  let [orc] = await store.filter('Orcamento', { obra_id: obraId }, '-created_date', 1);
  if (!orc) {
    const norm = normalizeOrcamentoPayload({ versao: '1' });
    orc = await store.create('Orcamento', {
      obra_id: obraId,
      titulo: 'Orçamento Principal',
      versao: norm.versao,
      data_criacao: new Date().toISOString().slice(0, 10),
    }, createdBy);
  } else if (typeof orc.versao !== 'string') {
    const coerced = String(orc.versao ?? '1').trim();
    await store.update('Orcamento', orc.id, { versao: coerced }).catch(() => {});
    orc.versao = coerced;
  }

  // Idempotência: limpa itens anteriores
  const existentes = await store.filter('ItemOrcamento', { orcamento_id: orc.id }, '-created_date', 100000).catch(() => []);
  for (const it of existentes) {
    await store.delete('ItemOrcamento', it.id).catch(() => {});
  }

  let ok = 0; let falha = 0; let totalOrcamento = 0;
  const seen = new Set();

  for (const it of itensSrc) {
    try {
      const qtd = Number(it.quantidade ?? it.qtd ?? 0) || 0;
      const vUnit = Number(it.custo_unitario ?? it.valor_unit ?? it.preco_unit ?? 0) || 0;
      let vTotal = Number(it.custo_total ?? it.total ?? it.preco_total ?? 0) || 0;
      if (!vTotal && qtd && vUnit) vTotal = Number((qtd * vUnit).toFixed(2));

      const desc = it.descricao || it.nome || it.item || 'Item do orçamento';
      const dedup = `${desc}|${qtd}|${vUnit}|${vTotal}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);

      const codigo = String(it.item || it.codigo || '').trim();
      const { etapa, etapa_codigo } = etapaDoItem(codigo);

      await store.create('ItemOrcamento', {
        orcamento_id: orc.id,
        obra_id: obraId,
        item_codigo: codigo,
        item_label: it.item_label || (codigo ? `${codigo} ${desc}`.slice(0, 60) : desc.slice(0, 60)),
        descricao: desc,
        unidade: it.und || it.unidade || it.UND || 'UN',
        quantidade: qtd,
        custo_unitario: vUnit,
        valor_unitario: vUnit,
        custo_total: vTotal,
        valor_total: vTotal,
        etapa,
        etapa_codigo,
        trecho: it.trecho || '',
        nivel: it.nivel || 0,
      }, createdBy);
      totalOrcamento += vTotal;
      ok++;
    } catch (e) {
      falha++;
    }
  }

  // Atualiza o total do orçamento (valor_total) para refletir a soma dos itens.
  // Sem isso a tela OrcamentoDetalhes mostra "Valor Total" R$ 0 e os % quebram.
  await store.update('Orcamento', orc.id, {
    valor_total: Number(totalOrcamento.toFixed(2)),
  }).catch(() => {});

  const confirmados = await store.filter('ItemOrcamento', { obra_id: obraId }, '-created_date', 50000).catch(() => []);
  const itens_persistidos = confirmados.length;

  if (itens_persistidos === 0) {
    return { ok: false, itens_parseados, itens_persistidos: 0, orcamento_id: orc.id, erro: `Nenhum item foi persistido. ok=${ok} falha=${falha}` };
  }
  return { ok: true, itens_parseados, itens_persistidos, orcamento_id: orc.id, totalOrcamento };
}

const erro = (message, status = 400, extra = {}) =>
  Object.assign(new Error(message), { status, detail: { error: message, ...extra } });

export default async function finalizarImportacaoCompleta({ body, user }) {
  const payload = body || {};
  const createdBy = user?.email || null;

  if (!payload || Object.keys(payload).length === 0) throw erro('Body obrigatório', 400);
  if (!payload.dados_sintetico) throw erro('Orçamento sintético obrigatório', 400);
  // Cronograma é OPCIONAL: normaliza para estrutura vazia se não vier.
  if (!payload.cronograma) payload.cronograma = {};
  if (!Array.isArray(payload.cronograma.atividades)) payload.cronograma.atividades = [];
  if (!payload.dados_obra) throw erro('Dados da obra obrigatórios', 400);

  // 1. CRIAR OBRA
  const obraDados = payload.dados_obra || {};
  const clienteNome = obraDados.cliente ?? obraDados.cliente_nome ?? obraDados.client ?? obraDados.client_name;
  let clienteId = obraDados.cliente_id ?? obraDados.client_id;
  if (!clienteNome) throw erro('Validação: cliente é obrigatório.', 400);

  // CLIENTE VIRA CADASTRO DE VERDADE. Antes o nome era gravado só como texto na
  // obra e o Cliente nunca era criado — o contratante sumia de /Clientes.
  // Deduplica pelo DOCUMENTO (só dígitos: 12.345.678/0001-99 == 12345678000199) e,
  // na falta dele, pelo nome normalizado. Nunca cria um segundo registro do mesmo.
  if (!clienteId) {
    const soDigitos = (v) => String(v || '').replace(/\D/g, '');
    const chaveNome = (v) => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const docNovo = soDigitos(obraDados.cliente_documento);
    const todos = await store.filter('Cliente', {}, undefined, 100000).catch(() => []);

    const existente = (docNovo && todos.find((c) => soDigitos(c.cnpj_cpf) === docNovo))
      || todos.find((c) => chaveNome(c.nome) === chaveNome(clienteNome));

    if (existente) {
      clienteId = existente.id;
      // Documento veio no arquivo e o cadastro estava sem: completa o que falta.
      if (docNovo && !soDigitos(existente.cnpj_cpf)) {
        await store.update('Cliente', existente.id, { cnpj_cpf: obraDados.cliente_documento }).catch(() => {});
      }
    } else {
      const novo = await store.create('Cliente', {
        nome: clienteNome,
        cnpj_cpf: obraDados.cliente_documento || undefined,
        tipo_documento: docNovo.length === 11 ? 'cpf' : (docNovo ? 'cnpj' : undefined),
        origem: 'importacao_orcamento',
        status: 'ativo',
      }, user?.email || null).catch(() => null);
      if (novo?.id) clienteId = novo.id;
    }
  }

  // Multi-empresa: a obra PRECISA pertencer a uma empresa-MEMBRO do grupo.
  // Global/Matriz escolhe no wizard (obraDados.empresa_id); membro herda a própria.
  const empresaId = obraDados.empresa_id || user?.empresa_id || null;
  if (empresaId) {
    // A Matriz é a consolidação do grupo — nunca pode ser dona de uma obra.
    const emp = (await store.filter('Empresa', { id: empresaId }))[0];
    if (emp && String(emp.tipo) === 'matriz') {
      throw erro('A Matriz não pode ser responsável por uma obra. Selecione uma empresa-membro.', 400);
    }
  }

  const obra = await store.create('Obra', {
    nome: obraDados.nome,
    empresa_id: empresaId,
    cliente: clienteNome,
    cliente_id: clienteId || undefined,
    endereco: obraDados.endereco || undefined,
    cidade: obraDados.cidade || undefined,
    estado: obraDados.estado || undefined,
    cep: obraDados.cep || undefined,
    data_inicio: obraDados.data_inicio || undefined,
    data_prevista_fim: obraDados.data_prevista_fim || obraDados.data_fim_prevista || undefined,
    tipo: obraDados.tipo || 'privada',
    tipo_obra: obraDados.tipo_obra || 'outros',
    categoria_dre: obraDados.categoria_dre || 'OUTRO',
    tipo_estrutural: obraDados.tipo_estrutural || 'OUTRO',
    tipo_intervencao: obraDados.tipo_intervencao || 'INDEFINIDA',
    status: 'a_iniciar',
    import_status: 'PROCESSING',
  }, createdBy);
  const obraId = obra.id;

  // 1b. EQUIPE DA OBRA (opcional) — vincula os funcionários escolhidos no wizard.
  // Antes, o campo "Funcionários da Obra" era decorativo: o wizard mostrava os
  // nomes escolhidos e o payload NÃO os enviava, então a obra nascia sem ninguém e
  // o Ponto/Presença abria vazio (a lista dele vem de ObraColaborador/equipe/alocação).
  // Só aceita quem existe de fato como Colaborador da empresa da obra — ID solto
  // viraria vínculo fantasma, com nome em branco no Ponto.
  const vinculados = [];
  const idsBrutos = [...new Set((obraDados.colaborador_ids || []).filter(Boolean).map(String))];
  if (idsBrutos.length) {
    const ids = idsBrutos.map((i) => i.replace(/^colab_/, ''));
    const colabs = (await store.filter('Colaborador', { id: { $in: ids } }, undefined, 500)) || [];
    const hoje = new Date().toISOString().split('T')[0];
    for (const c of colabs) {
      // Isolamento: não vincular gente de outra empresa por engano no wizard.
      if (empresaId && c.empresa_id && c.empresa_id !== empresaId) continue;
      const ja = (await store.filter('ObraColaborador', { obra_id: obraId, colaborador_id: c.id })) || [];
      if (ja.some((v) => (v.status || 'ativo') !== 'inativo')) continue;
      await store.create('ObraColaborador', {
        obra_id: obraId,
        colaborador_id: c.id,
        colaborador_nome: c.nome || null,
        funcao_na_obra: c.cargo || null,
        empresa_id: empresaId || c.empresa_id || null,
        status: 'ativo',
        data_inicio: hoje,
      }, createdBy);
      vinculados.push(c.id);
    }
  }

  // 2. ORÇAMENTO PLANEJADO
  const normOrc = normalizeOrcamentoPayload(payload.dados_sintetico || {});
  await store.create('OrcamentoPlanejado', {
    obra_id: obraId,
    total_geral: payload.dados_sintetico.totalGeral || 0,
    total_sem_bdi: payload.dados_sintetico.totalSemBDI || 0,
    total_bdi: payload.dados_sintetico.totalBDI || 0,
    bdi_percentual: payload.dados_sintetico.percentualBDI || 0,
    estrutura_json: JSON.stringify({ ...payload.dados_sintetico, versao: normOrc.versao }),
    status: 'Ativo',
  }, createdBy);

  // 3. CRONOGRAMA
  // Remove linhas que não são atividades (assinaturas "____", dados da empresa
  // com CNPJ/CREA, etc.) que aparecem no rodapé da planilha.
  const ehAtividadeInvalida = (nome) => {
    const d = String(nome || '');
    if (d.replace(/[_\-.\s]/g, '').length < 3) return true;
    return /\bCNPJ\b|\bC\.?P\.?F\b|\bCREA\b|\bSSP\b|\bRG\s*\d|S[ÓO]CIO|ADMINISTRADOR|ENGENHEIRO\s+CIVIL|RESPONS[ÁA]VEL\s+T[ÉE]CNICO|ASSINATURA/i.test(d);
  };
  payload.cronograma.atividades = (payload.cronograma.atividades || []).filter(
    (a) => !ehAtividadeInvalida(a.nome || a.atividade || a.nomeAtividade)
  );

  // Cronograma opcional: descarta atividades sem datas planejadas em vez de
  // cancelar a importação.
  payload.cronograma.atividades = (payload.cronograma.atividades || []).filter((a) => {
    const inicio = a.inicio || a.dataInicioPlanejada || a.data_inicio_planejada || a.data_inicio;
    const fim = a.fim || a.dataFimPlanejada || a.data_fim_planejada || a.data_fim;
    return inicio && fim;
  });

  for (const atividade of payload.cronograma.atividades) {
    const ini = atividade.inicio || atividade.dataInicioPlanejada || atividade.data_inicio_planejada || atividade.data_inicio;
    const fim = atividade.fim || atividade.dataFimPlanejada || atividade.data_fim_planejada || atividade.data_fim;
    await store.create('CronogramaItem', {
      obraId,
      nomeAtividade: atividade.nome || atividade.atividade || 'Atividade',
      dataInicioPlanejada: ini ? new Date(ini).toISOString().split('T')[0] : undefined,
      dataFimPlanejada: fim ? new Date(fim).toISOString().split('T')[0] : undefined,
      quantidadePlanejada: atividade.qtd || atividade.quantidade || 0,
      und: atividade.und || atividade.unidade || undefined,
      status: 'Não iniciado',
      percentualConcluido: 0,
    }, createdBy);
  }

  const cronogramaSalvo = await store.filter('CronogramaItem', { obraId }, '-created_date', 1000);
  // Só valida persistência quando havia atividades para salvar (cronograma opcional).
  if (payload.cronograma.atividades.length > 0 && (!cronogramaSalvo || cronogramaSalvo.length === 0)) {
    await store.delete('Obra', obraId).catch(() => {});
    throw erro('Falha crítica: Cronograma não foi persistido. Importação cancelada e obra deletada.', 500);
  }

  // 3b. DISTRIBUIÇÃO MENSAL (físico-financeiro) → CronogramaItemPeriodo.
  // Guarda, por atividade e por mês, o % e/ou valor planejado. O gráfico
  // "Cronograma Físico-Financeiro" lê daqui para espalhar pelos meses reais.
  try {
    const labels = payload.cronograma.periodos_labels || [];
    const fisfinan = payload.cronograma.itens_fisfinan || [];
    const obraStartISO = obraDados.data_inicio || null;
    if (labels.length > 0 && fisfinan.length > 0) {
      for (const it of fisfinan) {
        const periodos = it.periodos || {};
        for (let idx = 0; idx < labels.length; idx++) {
          const label = labels[idx];
          const p = periodos[label];
          if (!p) continue;
          const percent = Number(p.percent) || 0;
          const valor = Number(p.valor) || 0;
          if (percent <= 0 && valor <= 0) continue;
          await store.create('CronogramaItemPeriodo', {
            obra_id: obraId,
            atividade: it.descricao,
            label: String(label),
            ordem: idx,
            mes: labelParaMes(label, idx, obraStartISO),
            percent,
            valor,
          }, createdBy).catch(() => {});
        }
      }
    }
  } catch (_) { /* não bloqueia a importação */ }

  // 4. ITENS DO ORÇAMENTO
  const resultItens = await processarItensSync(obraId, payload.dados_sintetico, createdBy);

  if (!resultItens.ok) {
    await store.create('OrcamentoConsolidacaoStatus', {
      obra_id: obraId, status: 'ERROR', total_itens: 0, itens_consolidados: 0,
      itens_erro: resultItens.itens_parseados, last_error: resultItens.erro,
      started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
    }, createdBy).catch(() => {});
    await store.update('Obra', obraId, { import_status: 'ERROR' }).catch(() => {});
    return {
      ok: false, code: 'ZERO_ITEMS_IMPORTED',
      message: resultItens.erro || 'Nenhum item do orçamento foi persistido',
      debug: { obra_id: obraId, itens_parseados: resultItens.itens_parseados, itens_persistidos: 0 },
    };
  }

  const statusFinal = await store.create('OrcamentoConsolidacaoStatus', {
    obra_id: obraId, status: 'DONE',
    total_itens: resultItens.itens_persistidos, itens_consolidados: resultItens.itens_persistidos,
    itens_erro: 0, started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
  }, createdBy).catch(() => null);

  const atualizar = {
    import_status: 'DONE',
    importada_orca_facil: true,
    importada_orca_facil_em: new Date().toISOString(),
    total_orcamento: resultItens.totalOrcamento || 0,
  };
  if (payload.dados_obra?.responsavel_tecnico) atualizar.responsavel_tecnico = payload.dados_obra.responsavel_tecnico;
  if (payload.dados_obra?.responsavel_obra) atualizar.responsavel_obra = payload.dados_obra.responsavel_obra;
  if (payload.dados_obra?.centro_custo_codigo) atualizar.centro_custo_codigo = payload.dados_obra.centro_custo_codigo;
  if (payload.dados_obra?.centro_custo_nome) atualizar.centro_custo_nome = payload.dados_obra.centro_custo_nome;
  await store.update('Obra', obraId, atualizar).catch(() => {});

  return {
    ok: true,
    success: true,
    obra_id: obraId,
    total_orcamento_confirmado: resultItens.totalOrcamento || payload.dados_sintetico.totalGeral || 0,
    cronograma_items: cronogramaSalvo.length,
    import_run_id: payload.import_run_id,
    consolidado: true,
    total_itens: resultItens.itens_persistidos,
    processados: resultItens.itens_persistidos,
    consolidacao_status_id: statusFinal?.id || null,
  };
}

import { store } from '../entityStore.js';
import { can } from '../rbac.js';
import { ADICIONAL_HE_PADRAO } from './maoObraCore.js';

// Gera a folha mensal POR EMPRESA (isolamento multi-empresa): agrupa os colaboradores
// ativos por empresa_id e, para cada empresa, cria uma FolhaPagamento + itens e lança a
// despesa numa ContaFinanceira escopada à PRÓPRIA empresa (sem obra aleatória).
// Idempotente por (competência, empresa). Chamada sem empresa_id gera todas as empresas
// que têm colaborador ativo; com empresa_id, gera só aquela. Colaborador sem empresa_id
// cai em null (matriz/grupo).
const num = (v) => Number(v) || 0;
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100; // evita artefato de ponto flutuante nos totais

export default async function gerarFolhaPagamento({ body, user }) {
  // Pode rodar a folha: RH/Dep. Pessoal (RH_FOLHA) OU Financeiro/Admin/TI (FINANCEIRO_APPROVE).
  if (!can(user, 'RH_FOLHA') && !can(user, 'FINANCEIRO_APPROVE')) {
    const err = new Error('Sem permissão para gerar a folha de pagamento');
    err.status = 403;
    throw err;
  }

  const { competencia, empresa_id } = body || {};
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
    throw Object.assign(new Error('Competência inválida (use YYYY-MM)'), { status: 400 });
  }

  const filtroColab = { status: 'ativo' };
  if (empresa_id) filtroColab.empresa_id = empresa_id;
  const ativos = (await store.filter('Colaborador', filtroColab, '-created_date', 1000)) || [];
  // Só MENSALISTAS entram na folha. Diaristas (tipo_pagamento = 'DIARIA') são pagos
  // pelas diárias (apontamento aprovado → conta a pagar) — incluí-los aqui contaria
  // em dobro. tipo_pagamento vazio = mensalista (padrão do cadastro).
  const colaboradores = ativos.filter((c) => String(c.tipo_pagamento || 'SALARIO_FIXO') !== 'DIARIA');
  if (colaboradores.length === 0) {
    throw Object.assign(new Error('Nenhum colaborador mensalista ativo (todos são diaristas ou inativos)'), { status: 400 });
  }

  // Agrupa por empresa (sem empresa_id → null = matriz/grupo).
  const porEmpresa = {};
  for (const c of colaboradores) {
    const eid = c.empresa_id || null;
    (porEmpresa[eid] = porEmpresa[eid] || []).push(c);
  }

  // Nomes das empresas para deixar a descrição da conta específica (não genérica).
  const empresasAll = (await store.filter('Empresa', {}, null, 500)) || [];
  const empNome = Object.fromEntries(empresasAll.map((e) => [e.id, e.nome]));

  const hoje = new Date().toISOString().split('T')[0];
  const criadas = [];
  const puladas = [];
  const duplicados = [];

  // ANTI-DOBRA: quem JÁ tem item em outra folha desta competência não entra de novo.
  //
  // O buraco: a idempotência abaixo é por (competência, EMPRESA). Se o colaborador
  // muda de empresa no meio do mês (/Colaboradores → campo Empresa), a folha da
  // empresa nova ainda não existe — então ela é gerada e o cara entra OUTRA VEZ,
  // com nova conta a pagar. Dois pagamentos do mesmo salário, no mesmo mês, sem
  // nenhum aviso. A folha antiga não é tocada (é fato do mês) — quem sai é a
  // duplicata. Pendência de negócio em aberto: mudança de empresa no meio do mês
  // paga integral por quem? (hoje: a empresa vigente na 1ª folha gerada).
  const folhasComp = ((await store.filter('FolhaPagamento', { competencia }, '-created_date', 500)) || [])
    .filter((f) => f.status !== 'cancelada');
  const jaPago = {}; // colaborador_id -> { folha_id, empresa_id }
  for (const f of folhasComp) {
    const itens = (await store.filter('FolhaPagamentoItem', { folha_id: f.id }, undefined, 5000)) || [];
    for (const it of itens) {
      if (it.colaborador_id) jaPago[it.colaborador_id] = { folha_id: f.id, empresa_id: f.empresa_id || null };
    }
  }

  for (const [eidKey, colabs] of Object.entries(porEmpresa)) {
    const eid = eidKey === 'null' ? null : eidKey;

    // Idempotência por (competência, empresa): pula se já há folha não-cancelada.
    const existentes = (await store.filter('FolhaPagamento', { competencia }, '-created_date', 200)) || [];
    const ativa = existentes.find((f) => f.status !== 'cancelada' && (f.empresa_id || null) === eid);
    if (ativa) { puladas.push({ empresa_id: eid, folha_id: ativa.id }); continue; }

    // Horas extras do mês por colaborador — fonte: Ponto/Presença (ApontamentoMaoObra).
    // Mensalista tem hora extra PAGA (CLT): horas × valor da hora × (1 + adicional%).
    // O valor da hora é o custo_hora do cadastro (= salário ÷ 220, o divisor legal).
    const apsMes = ((await store.filter('ApontamentoMaoObra', {}, undefined, 100000)) || [])
      .filter((a) => String(a.data || '').startsWith(competencia))
      .filter((a) => !['REJEITADO', 'CANCELADO'].includes(String(a.status || '').toUpperCase()));
    const hePorColab = {};
    for (const a of apsMes) {
      const cid = a.profissional_id || a.colaborador_id;
      if (!cid) continue;
      hePorColab[cid] = (hePorColab[cid] || 0) + num(a.horas_extra);
    }

    // Tira da folha desta empresa quem já foi pago na folha de outra empresa no mês.
    const elegiveis = [];
    for (const c of colabs) {
      const pago = jaPago[c.id];
      if (pago) {
        duplicados.push({
          colaborador_id: c.id, colaborador_nome: c.nome || '',
          empresa_atual: empNome[eid] || 'Grupo',
          ja_pago_em: empNome[pago.empresa_id] || 'Grupo',
          folha_id: pago.folha_id,
        });
        continue;
      }
      elegiveis.push(c);
    }
    if (elegiveis.length === 0) { puladas.push({ empresa_id: eid, motivo: 'todos_ja_pagos_no_mes' }); continue; }

    // Calcular itens da empresa.
    let totalFolha = 0;
    const itens = [];
    for (const colab of elegiveis) {
      const beneficios = (await store.filter('ColaboradorBeneficio', { colaborador_id: colab.id, ativo: true }, '-created_date', 100)) || [];
      const custosExtras = (await store.filter('ColaboradorCustoExtra', { colaborador_id: colab.id, ativo: true }, '-created_date', 100)) || [];

      const r = colab.remuneracao || {};
      // O formulário ativo (/Colaboradores → FormIntegrado) grava `salario_base_mensal`;
      // registros antigos/seed usam `salario_base`. Aceita os dois — sem isto, colaborador
      // novo entrava na folha com salário 0 (e FGTS percentual zerado junto).
      const salario = num(r.salario_base ?? r.salario_base_mensal);
      const bonificacao = num(r.bonificacao_valor);

      // HORA EXTRA (CLT): horas apontadas no Ponto × valor da hora × (1 + adicional%).
      // Adicional configurável por colaborador; padrão 50%.
      const horasExtra = r2(hePorColab[colab.id] || 0);
      const adicional = num(r.adicional_hora_extra_percentual ?? ADICIONAL_HE_PADRAO);
      const valorHora = num(colab.custo_hora);
      const valorHorasExtra = r2(horasExtra * valorHora * (1 + adicional / 100));

      // FGTS percentual incide também sobre a hora extra (é remuneração).
      let fgts = 0;
      if (r.fgts_tipo === 'percentual') fgts = (salario + valorHorasExtra) * (num(r.fgts_percentual || 8) / 100);
      else if (r.fgts_tipo === 'valor_fixo') fgts = num(r.fgts_valor_fixo);

      const totalBeneficios = beneficios.reduce((s, b) => s + num(b.valor_mensal), 0);
      const totalExtras = custosExtras.reduce((s, c) => s + num(c.valor_mensal), 0);
      const totalItem = r2(salario + bonificacao + fgts + totalBeneficios + totalExtras + valorHorasExtra);
      totalFolha += totalItem;

      itens.push({
        colaborador_id: colab.id,
        salario_base: salario, bonificacao, fgts,
        beneficios: totalBeneficios, extras: totalExtras,
        // Hora extra: quantidade, o que foi pago e o adicional usado (rastreável).
        horas_extra: horasExtra,
        valor_horas_extra: valorHorasExtra,
        adicional_hora_extra_percentual: adicional,
        total_item: totalItem, referencia_unica: `${competencia}:${colab.id}`,
      });
    }

    // FolhaPagamento da empresa.
    totalFolha = r2(totalFolha);
    const folha = await store.create('FolhaPagamento', {
      competencia, empresa_id: eid, status: 'gerada',
      total: totalFolha, total_itens: itens.length,
      criado_por: user?.email || null,
      observacoes: 'Gerada automaticamente',
    }, user?.email || null);

    for (const item of itens) {
      await store.create('FolhaPagamentoItem', { ...item, folha_id: folha.id }, user?.email || null);
    }

    // Conta a pagar escopada à PRÓPRIA empresa (sem obra aleatória).
    const lancamento = await store.create('ContaFinanceira', {
      tipo: 'pagar', descricao: `Folha de Pagamento ${competencia}${eid ? ` — ${empNome[eid] || 'Empresa'}` : ' — Grupo'}`,
      valor: totalFolha, data_vencimento: hoje, data_emissao: hoje, status: 'pendente',
      empresa_id: eid, obra_id: null, categoria: 'mao_de_obra',
      referencia_tipo: 'folha_pagamento', referencia_id: folha.id,
      fornecedor_cliente: 'Folha de Pagamento',
      observacao: `Folha ${competencia} - ${itens.length} colaboradores`,
    }, user?.email || null);

    await store.update('FolhaPagamento', folha.id, { lancamento_id: lancamento.id, status: 'processada' });

    criadas.push({ empresa_id: eid, folha_id: folha.id, lancamento_id: lancamento.id, total: totalFolha, total_itens: itens.length });
  }

  if (criadas.length === 0) {
    const jaNoMes = duplicados.length
      ? ` ${duplicados.length} colaborador(es) já constam na folha de outra empresa neste mês: ${duplicados.map((d) => `${d.colaborador_nome} (${d.ja_pago_em})`).join(', ')}.`
      : '';
    throw Object.assign(new Error(`Folha já existe para esta competência.${jaNoMes}`), { status: 409, puladas, duplicados });
  }

  const totalGeral = criadas.reduce((s, f) => s + f.total, 0);
  const totalItens = criadas.reduce((s, f) => s + f.total_itens, 0);
  return {
    success: true,
    competencia,
    criadas: criadas.length,
    folhas: criadas,
    puladas,
    // Quem ficou de fora por já ter sido pago em outra empresa no mês (mudança de
    // empresa no meio do mês). A tela avisa — antes isso virava pagamento em dobro.
    duplicados,
    total: totalGeral,
    total_itens: totalItens,
    message: `Folha ${competencia}: ${criadas.length} empresa(s), ${totalItens} colaboradores`,
  };
}

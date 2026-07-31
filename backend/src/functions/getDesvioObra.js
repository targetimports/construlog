import { store } from '../entityStore.js';
import { podeAcessarObra } from '../escopoObra.js';
import { servicosDaObra, custoRealDaObra, r2 } from './custoServicoCore.js';

// DESVIO DE CUSTO POR SERVIÇO — o retorno das duas fases anteriores.
//
// A conta é curta e só existe porque as três metades agora existem:
//
//   quantidade medida × custo unitário previsto = o que ISTO DEVERIA ter custado
//   menos o custo real apontado                 = desvio
//
// Comparar custo real com o orçamento INTEIRO seria inútil no meio da obra:
// gastar 30% do orçamento não é bom nem ruim sem saber quanto foi executado. O
// que dá sentido ao número é medir contra o previsto DO QUE FOI FEITO.
//
// E O NÚMERO QUE VALE MAIS QUE O DESVIO DO MÊS
//
//   (quantidade contratada − medida) × custo previsto = custo pendente
//   custo real + custo pendente                       = custo final projetado
//
// Daí sai a margem com que a obra vai TERMINAR, e não a do mês. Para uma
// construtora isso costuma valer mais: dá tempo de reagir enquanto ainda há obra
// para executar. Margem projetada negativa dispara alerta — o manual manda
// provisionar a perda inteira no mês em que ela é reconhecida, e não diluí-la.
//
// TRÊS HONESTIDADES DELIBERADAS
//
//  1. Serviço sem apontamento NÃO tem desvio zero: tem desvio desconhecido.
//     Zero passaria por controlado sem nunca ter sido comparado.
//  2. A projeção da obra soma TODO o custo real (inclusive o não apontado), não
//     só o classificado. Senão a obra pareceria mais barata quanto pior fosse o
//     apontamento.
//  3. Quantidade medida acima da contratada aparece como excesso, em linha
//     própria — é o que o manual controla com teto de 5%.

const num = (v) => Number(v) || 0;

// Acima disto o serviço entra na lista de atenção do relatório.
const LIMITE_DESVIO_PCT = 10;
// Excesso de quantidade tolerado sobre o contrato (regra do manual).
const LIMITE_EXCESSO_PCT = 5;
// Piso em dinheiro para exigir justificativa. Sem ele a fila de análise encheria
// de centavos com percentual alto e o que importa afundaria no meio.
const PISO_DESVIO_VALOR = 1000;

export default async function getDesvioObra({ body, user }) {
  const { obra_id, ate_competencia = null } = body || {};
  if (!obra_id) throw Object.assign(new Error('obra_id é obrigatório'), { status: 400 });
  if (!(await podeAcessarObra(user, obra_id))) {
    throw Object.assign(new Error('Sem acesso a esta obra.'), { status: 403 });
  }

  const obra = (await store.filter('Obra', { id: obra_id }))[0] || {};
  const { versao, itens = [] } = await servicosDaObra(obra_id);
  if (!versao) return { ok: true, obra_id, sem_contrato: true, servicos: [], etapas: [], totais: null, alertas: [] };

  // ── Medido: a BM APROVADA mais recente manda ──────────────────────────
  // qtd_acumulada já é o acumulado da obra; somar as BMs contaria em dobro.
  const bms = (await store.filter('BM', { obra_id }, undefined, 500).catch(() => []))
    .filter((b) => String(b.status || '').toUpperCase() === 'APROVADA')
    .sort((a, b) => num(a.numero) - num(b.numero));

  const medidoPorItem = new Map();
  let overridesManuais = 0;
  for (const bm of bms) {
    const linhas = await store.filter('BMItem', { bm_id: bm.id }, undefined, 20000).catch(() => []);
    for (const l of linhas) {
      const k = String(l.contrato_item_id || '');
      if (!k) continue;
      // Percorrendo em ordem crescente de BM, a última gravação vence.
      medidoPorItem.set(k, { qtd: num(l.qtd_acumulada), valor: num(l.vl_acumulado), bm: bm.numero });
      if (l.override_manual) overridesManuais += 1;
    }
  }
  const ultimaBM = bms[bms.length - 1] || null;

  // COMPETÊNCIA DE ANÁLISE — o mês que está sendo justificado e fechado.
  // Vem da última medição aprovada (é ela que define o período apurado); sem
  // BM, o mês corrente. Quem chama pode fixar outra para reler um mês passado.
  const competenciaAnalise = String(body?.competencia || '').match(/^\d{4}-\d{2}$/)
    ? body.competencia
    : (String(ultimaBM?.data_fim || ultimaBM?.data_aprovacao || '').slice(0, 7)
      || new Date().toISOString().slice(0, 7));

  // Justificativas do mês em análise, por serviço.
  const justificativas = await store
    .filter('JustificativaDesvio', { obra_id, competencia: competenciaAnalise }, undefined, 20000)
    .catch(() => []);
  const justPorItem = new Map(justificativas.map((j) => [String(j.contrato_item_id), j]));

  // Mês já fechado? A tela avisa antes de deixar mexer.
  const fechamento = (await store.filter('FechamentoObra', { obra_id, competencia: competenciaAnalise }, undefined, 5)
    .catch(() => []))[0] || null;

  // ── Real: o que foi apontado a cada serviço ───────────────────────────
  let apontamentos = await store.filter('ApontamentoCustoServico', { obra_id }, undefined, 50000).catch(() => []);
  if (ate_competencia) apontamentos = apontamentos.filter((a) => !a.competencia || a.competencia <= ate_competencia);

  const realPorItem = new Map();
  for (const a of apontamentos) {
    const k = String(a.contrato_item_id);
    if (!realPorItem.has(k)) realPorItem.set(k, { realizado: 0, comprometido: 0 });
    const alvo = realPorItem.get(k);
    if (a.realizado) alvo.realizado = r2(alvo.realizado + num(a.valor));
    else alvo.comprometido = r2(alvo.comprometido + num(a.valor));
  }

  // ── Por serviço ───────────────────────────────────────────────────────
  const servicos = itens.map((it) => {
    const qtdContrato = num(it.qtd_contrato);
    const custoUnit = num(it.custo_unit_previsto);
    const vendaTotal = r2(num(it.total ?? it.preco_total));

    const med = medidoPorItem.get(String(it.id)) || { qtd: 0, valor: 0, bm: null };
    const real = realPorItem.get(String(it.id)) || { realizado: 0, comprometido: 0 };

    const qtdMedida = r2(med.qtd);
    const custoPrevistoExecutado = r2(qtdMedida * custoUnit);
    const custoReal = r2(real.realizado);

    // Só compara o que tem os dois lados. Sem medição não há o que comparar;
    // sem apontamento, o custo do serviço é desconhecido, não zero.
    const comparavel = qtdMedida > 0 && (custoReal > 0 || real.comprometido > 0) && custoUnit > 0;
    const desvio = comparavel ? r2(custoReal - custoPrevistoExecutado) : null;
    const desvioPct = comparavel && custoPrevistoExecutado > 0
      ? r2((desvio / custoPrevistoExecutado) * 100)
      : null;

    const qtdPendente = Math.max(0, r2(qtdContrato - qtdMedida));
    const excessoQtd = Math.max(0, r2(qtdMedida - qtdContrato));
    const excessoPct = qtdContrato > 0 && excessoQtd > 0 ? r2((excessoQtd / qtdContrato) * 100) : 0;

    // Desvio que exige explicação: relevante em percentual E com dinheiro em
    // jogo. Sem o piso em valor, um serviço de R$ 200 com 40% de desvio entraria
    // na fila de análise à frente de um de R$ 200 mil com 9%.
    const relevante = comparavel
      && (Math.abs(desvioPct ?? 0) >= LIMITE_DESVIO_PCT || excessoPct > LIMITE_EXCESSO_PCT)
      && Math.abs(desvio ?? 0) >= PISO_DESVIO_VALOR;

    const j = justPorItem.get(String(it.id)) || null;
    // Justificativa feita para outro número não vale para este: marcamos como
    // defasada em vez de deixá-la explicando um desvio que ninguém analisou.
    const justificativaDefasada = !!j && desvio != null
      && Math.abs(num(j.desvio_valor) - desvio) > Math.max(1, Math.abs(desvio) * 0.1);

    return {
      contrato_item_id: it.id,
      codigo: it.item_codigo || '',
      descricao: it.descricao || it.item_label || '',
      etapa: it.etapa || 'Geral',
      unidade: it.unidade || '',
      qtd_contrato: qtdContrato,
      qtd_medida: qtdMedida,
      avanco_pct: qtdContrato > 0 ? r2((qtdMedida / qtdContrato) * 100) : 0,
      custo_unit_previsto: custoUnit,
      custo_previsto_total: r2(num(it.custo_total_previsto)),
      custo_previsto_executado: custoPrevistoExecutado,
      custo_real: custoReal,
      custo_comprometido: r2(real.comprometido),
      custo_pendente: r2(qtdPendente * custoUnit),
      desvio,
      desvio_pct: desvioPct,
      comparavel,
      sem_custo_previsto: custoUnit <= 0,
      sem_apontamento: custoReal <= 0 && real.comprometido <= 0,
      venda_total: vendaTotal,
      receita_medida: r2(med.valor),
      excesso_qtd: excessoQtd,
      excesso_pct: excessoPct,
      excesso_acima_do_limite: excessoPct > LIMITE_EXCESSO_PCT,
      ultima_bm: med.bm,
      exige_justificativa: relevante,
      justificativa: j
        ? {
          id: j.id,
          recuperavel: j.recuperavel,
          natureza: j.natureza,
          motivo: j.motivo,
          acao: j.acao,
          plano_acao: j.plano_acao,
          responsavel: j.responsavel,
          prazo: j.prazo,
          status: j.status,
          desvio_valor: num(j.desvio_valor),
          justificado_por: j.justificado_por,
          justificado_em: j.justificado_em,
          defasada: justificativaDefasada,
        }
        : null,
      pendente_justificativa: relevante && (!j || justificativaDefasada),
    };
  });

  // ── Etapas ────────────────────────────────────────────────────────────
  const etapasMap = new Map();
  for (const s of servicos) {
    if (!etapasMap.has(s.etapa)) {
      etapasMap.set(s.etapa, {
        etapa: s.etapa, servicos: 0, venda_total: 0, custo_previsto_total: 0,
        custo_previsto_executado: 0, custo_real: 0, custo_pendente: 0, desvio: 0, comparaveis: 0,
      });
    }
    const e = etapasMap.get(s.etapa);
    e.servicos += 1;
    e.venda_total = r2(e.venda_total + s.venda_total);
    e.custo_previsto_total = r2(e.custo_previsto_total + s.custo_previsto_total);
    e.custo_previsto_executado = r2(e.custo_previsto_executado + s.custo_previsto_executado);
    e.custo_real = r2(e.custo_real + s.custo_real);
    e.custo_pendente = r2(e.custo_pendente + s.custo_pendente);
    if (s.comparavel) { e.desvio = r2(e.desvio + s.desvio); e.comparaveis += 1; }
  }
  const etapas = [...etapasMap.values()].map((e) => ({
    ...e,
    desvio_pct: e.custo_previsto_executado > 0 ? r2((e.desvio / e.custo_previsto_executado) * 100) : null,
  })).sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio));

  // ── Custo real da obra inteiro (fecha com o custo_total da DRE) ───────
  // Inclui o que não tem como ser apontado a um serviço hoje — mensalista,
  // frota e diárias. Deixá-los de fora encolheria o custo projetado e inflaria
  // a cobertura do apontamento: a obra pareceria melhor do que é.
  const real = await custoRealDaObra(obra_id);
  const custoRealObra = real.total_realizado;
  const custoComprometidoObra = real.origens_comprometido;

  // ── Totais e projeção ─────────────────────────────────────────────────
  const soma = (campo) => r2(servicos.reduce((s, x) => s + num(x[campo]), 0));
  const vendaContrato = soma('venda_total');
  const custoPrevistoTotal = soma('custo_previsto_total');
  const custoPrevistoExecutado = soma('custo_previsto_executado');
  const custoRealApontado = soma('custo_real');
  const custoPendente = soma('custo_pendente');
  const receitaMedida = num(ultimaBM?.total_acumulado) || soma('receita_medida');
  const custoNaoApontado = r2(custoRealObra - custoRealApontado);

  // A projeção soma TODO o custo real, não só o apontado: o que ainda não foi
  // classificado já saiu do caixa e vai estar lá no fim da obra do mesmo jeito.
  const custoFinalProjetado = r2(custoRealObra + custoPendente);
  const margemProjetada = vendaContrato > 0
    ? r2(((vendaContrato - custoFinalProjetado) / vendaContrato) * 100)
    : null;
  const margemPrevistaOriginal = vendaContrato > 0
    ? r2(((vendaContrato - custoPrevistoTotal) / vendaContrato) * 100)
    : null;

  const desvioTotal = r2(custoRealApontado - custoPrevistoExecutado);
  const desvioTotalPct = custoPrevistoExecutado > 0 ? r2((desvioTotal / custoPrevistoExecutado) * 100) : null;

  // ── Alertas ───────────────────────────────────────────────────────────
  const alertas = [];
  if (margemProjetada != null && margemProjetada < 0) {
    alertas.push({
      nivel: 'critico',
      titulo: 'Resultado projetado negativo',
      texto: `A obra caminha para fechar com prejuízo de ${Math.abs(r2(vendaContrato - custoFinalProjetado)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${margemProjetada.toFixed(1)}%). Perda projetada deve ser provisionada por inteiro no mês em que for reconhecida, não diluída pelo prazo restante.`,
    });
  } else if (margemProjetada != null && margemPrevistaOriginal != null && margemProjetada < margemPrevistaOriginal - 5) {
    alertas.push({
      nivel: 'atencao',
      titulo: 'Margem projetada abaixo da orçada',
      texto: `Orçada ${margemPrevistaOriginal.toFixed(1)}%, projetada ${margemProjetada.toFixed(1)}%.`,
    });
  }
  // Custo muito ABAIXO do previsto para o avanço quase nunca é eficiência: é
  // despesa que ainda não foi lançada. Sem este aviso, a obra exibe margem
  // melhor que a orçada e passa por saudável justamente quando o financeiro
  // está atrasado — o erro mais caro que este relatório pode induzir.
  if (desvioTotalPct != null && desvioTotalPct < -15 && custoPrevistoExecutado > 0) {
    alertas.push({
      nivel: 'atencao',
      titulo: 'Custo real muito abaixo do previsto para o avanço',
      texto: `Executou ${r2(custoPrevistoExecutado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de custo orçado e apontou ${r2(custoRealApontado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${desvioTotalPct.toFixed(1)}%). Antes de comemorar a margem, confira se há nota, folha ou medição de terceiro ainda não lançada.`,
    });
  }

  const cobertura = custoRealObra > 0 ? r2((custoRealApontado / custoRealObra) * 100) : 0;
  if (custoRealObra > 0 && cobertura < 80) {
    alertas.push({
      nivel: 'atencao',
      titulo: 'Apontamento incompleto',
      texto: `Só ${cobertura.toFixed(0)}% do custo real está apontado a serviços. O desvio por serviço abaixo cobre apenas essa parte.`,
    });
  }
  const comExcesso = servicos.filter((s) => s.excesso_acima_do_limite);
  if (comExcesso.length) {
    alertas.push({
      nivel: 'atencao',
      titulo: 'Quantidade medida acima do contrato',
      texto: `${comExcesso.length} serviço(s) passaram do contratado em mais de ${LIMITE_EXCESSO_PCT}%. Excesso precisa de justificativa.`,
    });
  }
  if (overridesManuais > 0) {
    alertas.push({
      nivel: 'atencao',
      titulo: 'Medição com quantidade alterada à mão',
      texto: `${overridesManuais} linha(s) de BM com quantidade sobrescrita manualmente.`,
    });
  }
  const pendentesJustificativa = servicos.filter((s) => s.pendente_justificativa);
  if (pendentesJustificativa.length) {
    alertas.push({
      nivel: 'atencao',
      titulo: 'Desvios sem justificativa',
      texto: `${pendentesJustificativa.length} serviço(s) com desvio relevante em ${competenciaAnalise} ainda sem explicação. O mês não fecha enquanto houver desvio relevante sem justificativa.`,
    });
  }

  const semPrevisto = servicos.filter((s) => s.sem_custo_previsto).length;
  if (semPrevisto > 0) {
    alertas.push({
      nivel: 'info',
      titulo: 'Serviços sem linha-base',
      texto: `${semPrevisto} serviço(s) sem custo previsto — o desvio deles não pode ser calculado.`,
    });
  }

  return {
    ok: true,
    obra_id,
    obra_nome: obra.nome || null,
    contrato_versao_id: versao.id,
    competencia: competenciaAnalise,
    fechamento: fechamento
      ? { competencia: fechamento.competencia, status: fechamento.status, fechado_por: fechamento.fechado_por, fechado_em: fechamento.fechado_em }
      : null,
    ultima_bm: ultimaBM ? { numero: ultimaBM.numero, total_acumulado: num(ultimaBM.total_acumulado), percent: num(ultimaBM.percent_concluida) } : null,
    servicos,
    etapas,
    // Onde olhar primeiro: maior desvio em VALOR, que é onde há dinheiro a
    // recuperar — percentual alto sobre base pequena engana.
    atencao: servicos
      .filter((s) => s.comparavel && (Math.abs(s.desvio_pct) >= LIMITE_DESVIO_PCT || s.excesso_acima_do_limite))
      .sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio))
      .slice(0, 20),
    totais: {
      venda_contrato: vendaContrato,
      receita_medida: r2(receitaMedida),
      avanco_pct: vendaContrato > 0 ? r2((receitaMedida / vendaContrato) * 100) : 0,
      custo_previsto_total: custoPrevistoTotal,
      custo_previsto_executado: custoPrevistoExecutado,
      custo_real_apontado: custoRealApontado,
      custo_real_obra: custoRealObra,
      custo_comprometido_obra: custoComprometidoObra,
      custo_nao_apontado: custoNaoApontado,
      // Parte do "não apontado" que NÃO tem como ser apontada hoje: mensalista,
      // frota e diárias não nascem de um documento apontável. Separar os dois é
      // o que impede a cobertura de parecer um desleixo da obra quando na
      // verdade é uma etapa do plano que ainda não foi construída.
      custo_nao_apontavel: real.nao_apontavel,
      detalhe_nao_apontavel: real.detalhe_nao_apontavel,
      cobertura_apontamento: cobertura,
      desvio: desvioTotal,
      desvio_pct: desvioTotalPct,
      custo_pendente: custoPendente,
      custo_final_projetado: custoFinalProjetado,
      margem_prevista_pct: margemPrevistaOriginal,
      margem_projetada_pct: margemProjetada,
      resultado_projetado: r2(vendaContrato - custoFinalProjetado),
      servicos_total: servicos.length,
      servicos_comparaveis: servicos.filter((s) => s.comparavel).length,
      overrides_manuais: overridesManuais,
      exigem_justificativa: servicos.filter((s) => s.exige_justificativa).length,
      pendentes_justificativa: pendentesJustificativa.length,
    },
    alertas,
  };
}

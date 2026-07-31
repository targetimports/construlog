import { store } from '../entityStore.js';

// Custo de MÃO DE OBRA dos MENSALISTAS numa obra.
//
// Por quê: o mensalista tem salário fixo lançado na FOLHA, que é uma conta a pagar
// no nível da EMPRESA (obra_id: null). Esse custo nunca chegava na DRE da obra —
// a obra mostrava material/equipamento mas quase nada de pessoal, inflando o lucro.
//
// Como: a obra absorve a parte proporcional às horas que o colaborador apontou nela
// no Ponto/Presença (Equipe & Diário → ApontamentoMaoObra):
//     custo = horas × custo REAL da hora
//     custo real da hora = custo total do colaborador na folha do mês ÷ HORAS ÚTEIS do mês
//
// Por que horas úteis do mês (dias úteis × 8h) e não o divisor legal de 220h:
// as 220h já embutem o descanso semanal remunerado, mas o ponto só registra os dias
// trabalhados (~176h/mês). Dividindo por 220 a obra absorveria só ~79% do custo e o
// lucro dela ficaria inflado — que é justamente o problema que queremos resolver.
// Com as horas úteis, quem trabalha o mês inteiro joga 100% do custo na obra; falta
// reduz e hora extra aumenta, proporcionalmente.
//
// O custo real da hora inclui os encargos (FGTS/benefícios/extras), porque usa o
// total da folha. Sem folha do mês, cai no salário do cadastro (mesmo divisor).
// Obs.: as horas úteis não descontam feriados (simplificação).
//
// DIARISTA fica FORA: o custo dele já vem da conta a pagar da diária, que tem
// obra_id e categoria mao_de_obra (contá-lo aqui duplicaria).
//
// Status: conta apontamento que não esteja rejeitado/cancelado (inclui RASCUNHO).
// Para mensalista não existe aprovação de valor — o Ponto registra presença/horas e
// o dinheiro está na folha. Mesma regra do getDetalheFolhaPagamento, para o
// detalhamento da folha e a DRE contarem a mesma história.
//
// Somente leitura.
const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;

const STATUS_FORA = new Set(['REJEITADO', 'CANCELADO', 'CANCELADA']);
export const ADICIONAL_HE_PADRAO = 50; // % de adicional de hora extra (padrão CLT)

// Horas úteis de uma competência 'YYYY-MM' = dias de semana (seg–sex) × 8h.
// Não desconta feriados (simplificação consciente).
export function horasUteisDoMes(competencia) {
  const [ano, mes] = String(competencia || '').split('-').map(Number);
  if (!ano || !mes) return 176; // fallback: mês típico
  const ultimoDia = new Date(ano, mes, 0).getDate();
  let dias = 0;
  for (let d = 1; d <= ultimoDia; d++) {
    const dow = new Date(ano, mes - 1, d).getDay();
    if (dow >= 1 && dow <= 5) dias++;
  }
  return dias * 8;
}

// Custos unitários do colaborador na competência, separando os dois tipos de hora:
//   • hora BASE  = custo do mês SEM as horas extras ÷ horas úteis do mês
//                  (salário + encargos + benefícios diluídos na jornada do mês)
//   • hora EXTRA = o que de fato foi PAGO por hora extra na folha
//                  (= valor_horas_extra ÷ horas_extra; fallback: custo_hora × 1,5)
// Separar é o que faz a soma FECHAR: mês cheio sem extra → 100% do custo base;
// com extra → soma exatamente o extra pago (não infla, como acontecia usando um
// custo/hora único para tudo).
export function custosHora(colab, itemFolha, competencia) {
  const totalMes = num(itemFolha?.total_item);
  const valorHE = num(itemFolha?.valor_horas_extra);
  const horasHE = num(itemFolha?.horas_extra);
  const horasUteis = horasUteisDoMes(competencia);

  const base = totalMes > 0
    ? (totalMes - valorHE)
    : num(colab?.remuneracao?.salario_base ?? colab?.remuneracao?.salario_base_mensal);
  const horaBase = (base > 0 && horasUteis > 0) ? (base / horasUteis) : num(colab?.custo_hora);

  const adic = num(itemFolha?.adicional_hora_extra_percentual
    ?? colab?.remuneracao?.adicional_hora_extra_percentual ?? ADICIONAL_HE_PADRAO);
  const horaExtra = (horasHE > 0 && valorHE > 0)
    ? (valorHE / horasHE)
    : num(colab?.custo_hora) * (1 + adic / 100);

  return { horaBase, horaExtra, horasUteis };
}

/**
 * Mesma conta, porém DEVOLVIDA POR APONTAMENTO em vez de somada.
 *
 * O total da obra não basta para o controle de desvio: para dizer que o
 * pedreiro custou tanto NA FUNDAÇÃO é preciso o valor de cada apontamento
 * isoladamente. Esta é a fonte; `custoMensalistaDaObra` passou a ser a soma
 * dela, para as duas nunca divergirem.
 */
export async function custoMensalistaPorApontamento(obra_id, { de, ate } = {}) {
  const mapa = new Map();
  if (!obra_id) return mapa;
  const dentro = (d) => (!de || (d && d >= de)) && (!ate || (d && d <= ate));

  const aps = ((await store.filter('ApontamentoMaoObra', { obra_id }, undefined, 100000)) || [])
    .filter((a) => !STATUS_FORA.has(String(a.status || '').toUpperCase()))
    .filter((a) => dentro(String(a.data || '').slice(0, 10)))
    .filter((a) => num(a.horas_normais) + num(a.horas_extra) > 0);
  if (aps.length === 0) return mapa;

  const ids = [...new Set(aps.map((a) => a.profissional_id || a.colaborador_id).filter(Boolean))];
  if (ids.length === 0) return mapa;
  const colabs = (await store.filter('Colaborador', { id: { $in: ids } }, undefined, 1000)) || [];
  const colabById = Object.fromEntries(colabs.map((c) => [c.id, c]));

  const comps = new Set(aps.map((a) => String(a.data || '').slice(0, 7)).filter(Boolean));
  const folhas = ((await store.filter('FolhaPagamento', {}, undefined, 2000)) || [])
    .filter((f) => f.status !== 'cancelada' && comps.has(String(f.competencia || '')));
  const itemMes = {};
  for (const f of folhas) {
    const itens = (await store.filter('FolhaPagamentoItem', { folha_id: f.id }, undefined, 5000)) || [];
    for (const it of itens) itemMes[`${f.competencia}:${it.colaborador_id}`] = it;
  }

  for (const a of aps) {
    const cid = a.profissional_id || a.colaborador_id;
    const colab = colabById[cid];
    if (!colab) continue;
    if (String(colab.tipo_pagamento || 'SALARIO_FIXO') === 'DIARIA') continue; // diarista fora

    const comp = String(a.data || '').slice(0, 7);
    const { horaBase, horaExtra } = custosHora(colab, itemMes[`${comp}:${cid}`], comp);
    const v = r2(num(a.horas_normais) * horaBase + num(a.horas_extra) * horaExtra);
    if (v > 0) mapa.set(String(a.id), v);
  }
  return mapa;
}

// Soma do mapa acima. Uma fonte só: se o detalhe por apontamento e o total da
// obra fossem calculados separadamente, um dia divergiriam — e a DRE deixaria de
// bater com o relatório de desvio sem que ninguém percebesse.
export async function custoMensalistaDaObra(obra_id, opts = {}) {
  if (!obra_id) return 0;
  const mapa = await custoMensalistaPorApontamento(obra_id, opts);
  let total = 0;
  for (const v of mapa.values()) total += v;
  return r2(total);
}

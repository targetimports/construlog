import { store } from '../entityStore.js';
import { custoMensalistaPorApontamento } from './maoObraCore.js';

// APONTAMENTO DO CUSTO REAL AO SERVIÇO DO CONTRATO.
//
// O sistema sabe quanto a obra gastou (a DRE soma ContaFinanceira paga por
// categoria) e, desde a Fase 1, quanto cada serviço DEVERIA custar. Falta o elo:
// dizer que esta nota de R$ 40 mil foi da fundação, e não da alvenaria. Sem ele
// não existe desvio por serviço — só um total que sobe sem explicar por quê.
//
// POR QUE RATEIO, E NÃO UM CAMPO NA CONTA
//
// Uma conta a pagar de compra nasce por RECEBIMENTO e cobre todos os itens da
// nota: cimento da fundação e bloco da alvenaria no mesmo documento. Um campo
// único obrigaria a escolher um serviço e mentir sobre o resto. Aqui uma origem
// pode ser dividida em N linhas, e o que sobrar simplesmente não é apontado —
// continua na DRE, aparecendo como "não apontado" no relatório.
//
// Isto também dá de graça a "redistribuição de saldos" do manual: corrigir uma
// atribuição é regravar o rateio, não estornar lançamento.
//
// O QUE NÃO É APONTADO NÃO SOME. A DRE continua lendo as origens; o apontamento
// é uma camada de LEITURA sobre o custo, nunca uma segunda contabilidade. Por
// isso nada aqui escreve na ContaFinanceira nem no LancamentoCustoObra.

const num = (v) => Number(v) || 0;
export const r2 = (n) => Math.round(num(n) * 100) / 100;

// Tolerância de centavo ao comparar a soma dos rateios com o total da origem:
// dividir R$ 100,00 em três partes iguais nunca fecha exato.
export const TOLERANCIA = 0.011;

// De onde um custo pode vir. Cada origem sabe dizer seu valor, sua data e sua
// categoria — é só isso que o apontamento precisa saber sobre ela.
//
// `somenteRealizado` marca o que a DRE efetivamente conta hoje: ContaFinanceira
// só entra como custo quando está paga. As pendentes continuam apontáveis de
// propósito — é o custo COMPROMETIDO (pedido assinado, ainda não pago), o aviso
// que chega antes do estrago. Os relatórios separam os dois.
export const ORIGENS = {
  ContaFinanceira: {
    entidade: 'ContaFinanceira',
    rotulo: 'Conta a pagar',
    valor: (o) => num(o.valor),
    data: (o) => o.data_pagamento || o.data_vencimento || o.data_emissao || null,
    categoria: (o) => o.categoria || '',
    descricao: (o) => o.descricao || o.fornecedor_cliente || 'Conta',
    realizado: (o) => String(o.status || '').toLowerCase() === 'pago',
    // Só despesa: conta a receber não é custo de serviço nenhum.
    aceita: (o) => String(o.tipo || '').toLowerCase() === 'pagar',
  },
  LancamentoCustoObra: {
    entidade: 'LancamentoCustoObra',
    rotulo: 'Lançamento de custo',
    valor: (o) => num(o.valor),
    data: (o) => o.data_lancamento || o.data || null,
    categoria: (o) => o.categoria || '',
    descricao: (o) => o.descricao || 'Lançamento de custo',
    realizado: () => true,
    aceita: () => true,
  },

  // MÃO DE OBRA — o apontamento do Ponto.
  //
  // Os dois regimes nascem do MESMO registro, mas o dinheiro vem de lugares
  // diferentes, e por isso o valor de cada um se calcula diferente:
  //
  //   • MENSALISTA: o salário está na folha, no nível da empresa. A obra absorve
  //     a parte proporcional às horas apontadas (horas × custo real da hora).
  //     Não existe documento financeiro com obra_id — o valor é derivado, e por
  //     isso esta origem precisa de contexto preparado (ver `preparar`).
  //
  //   • DIARISTA: a aprovação do apontamento gera uma conta a pagar de verdade.
  //     Quando essa conta existe, é ELA a origem do custo — contar o apontamento
  //     também dobraria a diária. O elo é exato: a conta guarda
  //     referencia_tipo='apontamento_mao_obra' apontando para o registro.
  ApontamentoMaoObra: {
    entidade: 'ApontamentoMaoObra',
    rotulo: 'Mão de obra (Ponto)',
    async preparar(obra_id) {
      const mensalista = await custoMensalistaPorApontamento(obra_id).catch(() => new Map());
      // Diárias que JÁ viraram conta a pagar: o custo delas entra pela conta.
      const contas = await store.filter('ContaFinanceira', { obra_id, referencia_tipo: 'apontamento_mao_obra' }, undefined, 20000)
        .catch(() => []);
      return { mensalista, jaTemConta: new Set(contas.map((c) => String(c.referencia_id))) };
    },
    valor: (o, ctx) => {
      // MENSALISTA: custo derivado da folha. Vale mesmo em rascunho — o Ponto
      // registra presença, e o salário do mês já está comprometido de qualquer
      // forma (mesma regra de maoObraCore, para os dois não divergirem).
      const derivado = ctx?.mensalista?.get(String(o.id));
      if (derivado != null) return derivado;

      // DIARISTA: só vira custo quando APROVADO. Em rascunho ninguém deve nada
      // ainda, e contá-lo infla o custo real da obra com uma despesa que pode
      // nem existir.
      if (String(o.status || '').toUpperCase() !== 'APROVADO') return 0;
      // Aprovado gera conta a pagar; quando ela existe, o custo entra por ela.
      if (ctx?.jaTemConta?.has(String(o.id))) return 0;
      return num(o.total ?? o.valor_diaria);
    },
    data: (o) => o.data || null,
    categoria: () => 'mao_de_obra',
    descricao: (o) => `Mão de obra · ${o.profissional_nome || o.colaborador_nome || 'colaborador'} · ${String(o.data || '').slice(0, 10)}`,
    // Hora apontada é custo incorrido: o salário do mês já está comprometido.
    realizado: () => true,
    aceita: (o) => !['REJEITADO', 'CANCELADO', 'CANCELADA'].includes(String(o.status || '').toUpperCase()),
  },

  // EQUIPAMENTO — empréstimo de ativo do grupo.
  //
  // Só o DEVOLVIDO entra: enquanto a máquina está na obra não se sabe o uso real,
  // que é lido no medidor durante a vistoria de devolução. E de propósito isto
  // não gera título financeiro — é rateio de custo de posse, não conta a pagar
  // (ver frotaCore.js).
  EmprestimoAtivo: {
    entidade: 'EmprestimoAtivo',
    rotulo: 'Frota / equipamento',
    valor: (o) => num(o.custo_total),
    data: (o) => o.data_retorno || o.data_devolucao || null,
    categoria: () => 'equipamento',
    descricao: (o) => `Uso de ${o.ativo_nome || 'ativo'}${o.data_retorno ? ` · devolvido em ${String(o.data_retorno).slice(0, 10)}` : ''}`,
    realizado: () => true,
    aceita: (o) => String(o.status || '') === 'devolvido',
  },
};

/**
 * Contexto que algumas origens precisam para calcular valor (o mensalista, cujo
 * custo é derivado da folha e das horas). Preparado uma vez por obra — fazer por
 * registro custaria uma varredura da folha inteira a cada linha.
 */
export async function prepararOrigens(obra_id) {
  const ctx = {};
  for (const [tipo, desc] of Object.entries(ORIGENS)) {
    if (desc.preparar) ctx[tipo] = await desc.preparar(obra_id);
  }
  return ctx;
}

export const ORIGENS_VALIDAS = Object.keys(ORIGENS);

/** Competência (YYYY-MM) de uma data ISO. Null quando a origem não tem data. */
export function competenciaDe(dataISO) {
  const s = String(dataISO || '');
  const m = s.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/**
 * Categoria normalizada, na mesma régua da DRE (ver calcularDREObra).
 * Sem isto "Material", "material" e "MATERIAIS" viram três linhas no relatório.
 */
export function normalizarCategoria(categoria) {
  const c = String(categoria || '').toLowerCase();
  if (c.includes('combust') || c.includes('diesel') || c.includes('gasolina') || c.includes('arla')) return 'combustivel';
  if (c.includes('material')) return 'material';
  if (c.includes('mao') || c.includes('mão')) return 'mao_de_obra';
  if (c.includes('equip') || c.includes('locac') || c.includes('aluguel')) return 'equipamento';
  return 'indireto';
}

/** Carrega uma origem e devolve seus dados já normalizados, ou null. */
export async function carregarOrigem(origem_tipo, origem_id) {
  const desc = ORIGENS[origem_tipo];
  if (!desc || !origem_id) return null;
  const reg = (await store.filter(desc.entidade, { id: origem_id }))[0];
  if (!reg) return null;
  if (!desc.aceita(reg)) return null;
  // Só o contexto DESTA origem: preparar todos custaria varreduras inúteis.
  const ctx = desc.preparar && reg.obra_id ? await desc.preparar(reg.obra_id) : null;
  const data = desc.data(reg);
  return {
    tipo: origem_tipo,
    id: reg.id,
    obra_id: reg.obra_id || null,
    valor: r2(desc.valor(reg, ctx)),
    data,
    competencia: competenciaDe(data),
    categoria: desc.categoria(reg),
    categoria_normalizada: normalizarCategoria(desc.categoria(reg)),
    descricao: desc.descricao(reg),
    realizado: !!desc.realizado(reg),
    registro: reg,
  };
}

/** Soma já apontada de uma origem (opcionalmente ignorando um conjunto de ids). */
export async function totalApontado(origem_tipo, origem_id, ignorarIds = []) {
  const linhas = await store.filter('ApontamentoCustoServico', { origem_tipo, origem_id }, undefined, 5000).catch(() => []);
  const ignora = new Set(ignorarIds.map(String));
  return {
    total: r2(linhas.filter((l) => !ignora.has(String(l.id))).reduce((s, l) => s + num(l.valor), 0)),
    linhas,
  };
}

/**
 * CUSTO REAL TOTAL DA OBRA — o universo contra o qual o apontamento se mede.
 *
 * Nem todo custo da obra nasce de um documento apontável. A DRE (ver
 * calcularDREObra) soma, além das origens acima:
 *
 *   • mão de obra MENSALISTA — o salário está na folha, no nível da empresa, e
 *     chega à obra rateado pelas horas do Ponto;
 *   • FROTA — uso de ativo do grupo, que entra por tarifa e de propósito NÃO
 *     gera título financeiro (ver frotaCore.js);
 *   • diárias aprovadas, quando ainda não viraram conta paga.
 *
 * Esses custos existem, pesam na margem e hoje não têm como ser apontados a um
 * serviço. Ignorá-los faria o total do relatório ficar ABAIXO do da DRE — a obra
 * pareceria mais barata do que é, e a cobertura do apontamento pareceria melhor
 * do que é, porque o denominador estaria menor. Por isso entram no total e são
 * devolvidos em campo próprio, para a tela poder dizer o que é o quê.
 */
export async function custoRealDaObra(obra_id, ctxExterno = null) {
  const ctx = ctxExterno || await prepararOrigens(obra_id);
  let realizado = 0;
  let comprometido = 0;
  const porCategoria = {};

  for (const [tipo, desc] of Object.entries(ORIGENS)) {
    const registros = await store.filter(desc.entidade, { obra_id }, '-created_date', 20000).catch(() => []);
    for (const reg of registros) {
      if (!desc.aceita(reg)) continue;
      const v = r2(desc.valor(reg, ctx[tipo]));
      if (v <= 0) continue;
      // Acumula SEM arredondar e arredonda uma vez no fim. Arredondar a cada
      // registro produzia diferença de centavos contra a DRE em obras com
      // centenas de lançamentos — pouco dinheiro, mas o bastante para alguém
      // achar que as duas telas discordam.
      if (desc.realizado(reg)) {
        realizado += v;
        const cat = normalizarCategoria(desc.categoria(reg));
        porCategoria[cat] = num(porCategoria[cat]) + v;
      } else {
        comprometido += v;
      }
    }
  }

  for (const k of Object.keys(porCategoria)) porCategoria[k] = r2(porCategoria[k]);
  realizado = r2(realizado);
  comprometido = r2(comprometido);

  return {
    origens_realizado: realizado,
    origens_comprometido: comprometido,
    // Todo custo da obra passou a ser apontável: mão de obra entra pelo Ponto e
    // equipamento pelo empréstimo devolvido. Mantido em zero para as telas que
    // já leem este campo continuarem funcionando sem mudança.
    nao_apontavel: 0,
    detalhe_nao_apontavel: { diarias: 0, mensalista: 0, frota: 0 },
    por_categoria: porCategoria,
    // Fecha com custo_total da DRE.
    total_realizado: realizado,
  };
}

/**
 * Serviços (itens do contrato ATIVO) de uma obra, indexados por id.
 * O apontamento só aceita serviço da própria obra: apontar custo de uma obra
 * num item de contrato de outra misturaria os desvios de duas obras.
 */
export async function servicosDaObra(obra_id) {
  const versoes = (await store.filter('ContratoVersao', { obra_id }, undefined, 100).catch(() => []))
    .filter((v) => String(v.status || '').toUpperCase() === 'ATIVA');
  if (!versoes.length) return { porId: new Map(), versao: null };

  // Mais de uma ativa não deveria existir; se existir, vale a de maior número —
  // é a linha-base mais recente.
  const versao = versoes.sort((a, b) => num(b.numero_versao) - num(a.numero_versao))[0];
  const itens = await store.filter('ContratoItem', { contrato_versao_id: versao.id }, undefined, 20000).catch(() => []);
  return { porId: new Map(itens.map((i) => [String(i.id), i])), versao, itens };
}

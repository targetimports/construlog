// Fonte única do REGIME DE PAGAMENTO do profissional terceirizado.
//
// Três regimes (cliente, 2026-07-16), e cada um paga por um caminho JÁ existente:
//   • DIÁRIA  → bate ponto; apontamento aprovado vira conta a pagar (mesmo trilho
//               do diarista próprio; meio período = meia diária).
//   • MENSAL  → bate ponto (as horas NÃO pagam — o valor é fixo), e o pagamento do
//               mês é gerado rateado por obra conforme as horas. O ponto é o que
//               diz ONDE o custo cai.
//   • EMPREITA→ NÃO bate ponto. É pago pelo SERVIÇO entregue, via Contrato tipo
//               "empreitada" (medição/saldo). Se ele também gerasse diária, o mesmo
//               trabalho viraria custo DUAS vezes na obra.
//
// Terceirizado NÃO entra na folha: não é CLT (sem FGTS/13º/hora extra legal). O
// custo dele é sempre ContaFinanceira (categoria mao_de_obra, com obra_id).

export const REGIME_TERCEIRIZADO = {
  DIARIA: {
    label: 'Diária',
    descricao: 'Paga por dia trabalhado. Bate ponto; a diária vira conta a pagar quando o apontamento é aprovado.',
    campoValor: 'valor_diaria',
    labelValor: 'Valor da diária (R$)',
    noPonto: true,
  },
  MENSAL: {
    label: 'Mensal',
    descricao: 'Valor fixo por mês. Bate ponto para controlar falta e ratear o custo entre as obras (as horas não alteram o valor).',
    campoValor: 'valor_mensal',
    labelValor: 'Valor mensal (R$)',
    noPonto: true,
  },
  EMPREITA: {
    label: 'Empreita',
    descricao: 'Serviço fechado por valor combinado. Não bate ponto — o pagamento sai da medição do contrato de empreitada.',
    campoValor: null,
    labelValor: null,
    noPonto: false,
  },
};

export const REGIMES = Object.entries(REGIME_TERCEIRIZADO).map(([value, r]) => ({ value, label: r.label }));

// Cadastro antigo (sem regime) = DIÁRIA, que é o que o cliente já usava.
export const regimeDe = (p) => (REGIME_TERCEIRIZADO[p?.tipo_pagamento] ? p.tipo_pagamento : 'DIARIA');
export const ehEmpreita = (p) => regimeDe(p) === 'EMPREITA';
export const entraNoPonto = (p) => !!REGIME_TERCEIRIZADO[regimeDe(p)].noPonto;
export const labelRegime = (p) => REGIME_TERCEIRIZADO[regimeDe(p)].label;

// Valor de referência do regime (para KPI/telas). Empreita não tem valor no
// cadastro: ele vive no contrato.
export const valorDoRegime = (p) => {
  const campo = REGIME_TERCEIRIZADO[regimeDe(p)].campoValor;
  return campo ? Number(p?.[campo]) || 0 : 0;
};

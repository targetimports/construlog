export const UFs = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
].map(u => ({ v: u, l: u }));

export const TIPOS_DOCUMENTO = [
  { v: '1', l: '1 – Saída' },
  { v: '0', l: '0 – Entrada' }
];

export const FINALIDADES = [
  { v: '1', l: '1 – Normal' },
  { v: '2', l: '2 – Complementar' },
  { v: '3', l: '3 – Ajuste' },
  { v: '4', l: '4 – Devolução' }
];

export const MODALIDADES_FRETE = [
  { v: '0', l: '0 – Emitente' },
  { v: '1', l: '1 – Destinatário' },
  { v: '9', l: '9 – Sem frete' }
];

export const REGIMES_TRIBUTARIOS = [
  { v: '1', l: '1 – Simples Nacional' },
  { v: '2', l: '2 – SN Excesso' },
  { v: '3', l: '3 – Regime Normal' }
];

export const INDICADORES_IE = [
  { v: '1', l: '1 – Contribuinte' },
  { v: '2', l: '2 – Isento' },
  { v: '9', l: '9 – Não contribuinte' }
];

export const SITUACOES_ICMS = [
  { v: '102', l: '102 – SN s/ crédito' },
  { v: '101', l: '101 – SN c/ crédito' },
  { v: '400', l: '400 – SN não tributado' },
  { v: '41', l: '41 – Não tributado' },
  { v: '00', l: '00 – Tributado' }
];

export const ORIGENS_ICMS = [
  { v: '0', l: '0 – Nacional' },
  { v: '1', l: '1 – Estrangeiro direto' },
  { v: '2', l: '2 – Estrangeiro interno' }
];
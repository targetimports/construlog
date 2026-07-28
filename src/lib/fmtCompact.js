// Formatação compacta de moeda para caber em cards estreitos (mobile / KPIs).
// Ex.: 13892640 -> "R$ 13,9 mi" | 850000 -> "R$ 850 mil" | 320 -> "R$ 320".
// Use o valor cheio (fmtBRL) no atributo title= para mostrar no hover.
const nf = (n, casas) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

export const fmtCompactBRL = (v) => {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  const sinal = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sinal}R$ ${nf(abs / 1_000_000, 1)} mi`;
  if (abs >= 10_000) return `${sinal}R$ ${nf(abs / 1_000, 0)} mil`;
  return `${sinal}R$ ${nf(abs, 0)}`;
};

// Versão compacta FIEL: trunca (não arredonda pra cima), pra não mostrar mais do
// que existe. Ex.: 1971776,95 -> "R$ 1,9 mi" (e não "2,0 mi").
const trunc = (x, casas) => { const f = 10 ** casas; return Math.floor(x * f) / f; };
export const fmtCompactBRLfiel = (v) => {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  const sinal = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sinal}R$ ${nf(trunc(abs / 1_000_000, 1), 1)} mi`;
  if (abs >= 10_000) return `${sinal}R$ ${nf(Math.floor(abs / 1_000), 0)} mil`;
  return `${sinal}R$ ${nf(Math.floor(abs), 0)}`;
};

// Versão sem símbolo (para eixos/gráficos): 13892640 -> "13,9 mi".
export const fmtCompactNum = (v) => {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  const sinal = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sinal}${nf(abs / 1_000_000, 1)} mi`;
  if (abs >= 10_000) return `${sinal}${nf(abs / 1_000, 0)} mil`;
  return `${sinal}${nf(abs, 0)}`;
};

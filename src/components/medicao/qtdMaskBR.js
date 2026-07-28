// Máscara de quantidade em pt-BR para os campos editáveis da planilha de BM.
// Formata enquanto o usuário digita: milhar com ".", decimal com "," (ex.: 1.502,01),
// até 3 casas decimais (precisão usada no resto da planilha).

// Formata um número para exibição (1502.01 -> "1.502,01", 3 -> "3").
export const fmtQtd = (n) =>
  (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

// Aplica a máscara ao texto digitado. Mantém só dígitos e a vírgula decimal;
// os pontos de milhar são recalculados a cada tecla (agrupamento automático).
export const maskQtdBR = (raw) => {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).replace(/[^\d,]/g, ''); // remove pontos de milhar e qualquer lixo
  if (s === '') return '';
  const i = s.indexOf(',');
  if (i === -1) {
    // ainda sem decimais → só agrupa o milhar
    return Number(s).toLocaleString('pt-BR');
  }
  const intRaw = s.slice(0, i).replace(/,/g, '');
  const decRaw = s.slice(i + 1).replace(/,/g, '').slice(0, 3); // até 3 casas
  const intFmt = intRaw === '' ? '0' : Number(intRaw).toLocaleString('pt-BR');
  return `${intFmt},${decRaw}`;
};

// Converte o texto mascarado ("1.502,01") de volta para número (1502.01).
export const parseQtdBR = (masked) => {
  if (!masked) return 0;
  const n = parseFloat(String(masked).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

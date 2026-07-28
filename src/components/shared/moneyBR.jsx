/**
 * Utilitários para conversão e formatação monetária BR
 * Evita NaN, strings inválidas e garante cálculos numéricos confiáveis
 */

/**
 * Converte qualquer valor para number (BRL)
 * @param {any} value - "1560", "1.560,00", "R$ 1.560,00", 1560, null, ""
 * @returns {number} - sempre retorna number >= 0, nunca NaN
 */
export function parseBRL(value) {
  // Se já é number válido, retorna
  if (typeof value === 'number' && !isNaN(value)) {
    return Math.max(0, value);
  }

  // Se vazio/null/undefined, retorna 0
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  // Converter para string e limpar
  let str = String(value).trim();

  // Remover "R$", espaços, pontos (milhares)
  str = str.replace(/R\$/g, '').replace(/\s/g, '').replace(/\./g, '');

  // Trocar vírgula (decimal BR) por ponto
  str = str.replace(',', '.');

  // Converter para number
  const num = parseFloat(str);

  // Garantir número válido >= 0
  if (isNaN(num)) {
    console.warn('[moneyBR] parseBRL retornou NaN para:', value);
    return 0;
  }

  return Math.max(0, num);
}

/**
 * Formata number para string BRL
 * @param {number} value
 * @returns {string} "R$ x.xxx,xx"
 */
export function formatBRL(value) {
  const num = parseBRL(value); // Garantir que é number válido

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

// Alias para compatibilidade
export const moneyBR = formatBRL;

/**
 * Formata number para string BRL compacta (ideal p/ cards no mobile)
 * @param {number} value
 * @returns {string} "R$ 1,2 mi" / "R$ 979,1 mil"
 */
export function formatBRLcompact(value) {
  const num = parseBRL(value);

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(num);
}

/**
 * Formata number para string numérica BR (sem R$)
 * @param {number} value
 * @returns {string} "x.xxx,xx"
 */
export function formatNumberBR(value) {
  const num = parseBRL(value);

  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}
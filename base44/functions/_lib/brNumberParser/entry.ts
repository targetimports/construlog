/**
 * Parser determinístico de números brasileiros
 * Aceita: "3,62", "2.831,74", "R$ 1.234,56", "-1.234,56", "(1.234,56)", "33,65%"
 */
export function parseBrNumber(valor) {
  if (!valor) return null;

  // Converter para string e limpar espaços
  let str = String(valor).trim();
  
  // Se vazio, retornar null
  if (!str || str === '') return null;

  // Remover "R$" e espaços
  str = str.replace(/R\$\s*/g, '').trim();

  // Detectar se é percentual
  const isPercentual = str.includes('%');
  str = str.replace(/%/g, '').trim();

  // Detectar negativo em parênteses
  const isNegativoParenteses = /^\(.*\)$/.test(str);
  if (isNegativoParenteses) {
    str = str.slice(1, -1);
  }

  // Detectar negativo normal
  const isNegativoMenos = str.startsWith('-');
  if (isNegativoMenos) {
    str = str.slice(1).trim();
  }

  // Padrão BR: ponto = milhar, vírgula = decimal
  // Contar pontos e vírgulas
  const countPonto = (str.match(/\./g) || []).length;
  const countVirgula = (str.match(/,/g) || []).length;

  let num = 0;

  if (countVirgula === 0 && countPonto === 0) {
    // Apenas dígitos
    num = parseFloat(str) || 0;
  } else if (countVirgula === 1 && countPonto === 0) {
    // Formato: "123,45" -> vírgula é decimal
    num = parseFloat(str.replace(',', '.')) || 0;
  } else if (countVirgula === 0 && countPonto > 0) {
    // Apenas pontos: podem ser milhares ou decimais
    // Se último ponto tem exatamente 3 dígitos depois, é milhar
    const ultimoPonto = str.lastIndexOf('.');
    const digitosAposUltimoPonto = str.length - ultimoPonto - 1;
    
    if (digitosAposUltimoPonto === 3 && countPonto > 1) {
      // Múltiplos pontos com 3 dígitos no final: "1.234.567" -> remover todos os pontos
      num = parseFloat(str.replace(/\./g, '')) || 0;
    } else if (digitosAposUltimoPonto <= 2 && countPonto === 1) {
      // Um único ponto com 1-2 dígitos: "123.45" -> ponto é decimal
      num = parseFloat(str) || 0;
    } else {
      // Fallback: assumir pontos são milhares
      num = parseFloat(str.replace(/\./g, '')) || 0;
    }
  } else if (countVirgula === 1 && countPonto > 0) {
    // Formato completo: "1.234,56" -> pontos são milhares, vírgula é decimal
    num = parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
  } else {
    // Fallback: remover pontos e substituir vírgula
    num = parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
  }

  // Aplicar sinal
  if (isNegativoMenos || isNegativoParenteses) {
    num = -num;
  }

  // Se era percentual, dividir por 100
  if (isPercentual) {
    num = num / 100;
  }

  // Garantir que nunca retorne NaN
  if (isNaN(num)) {
    console.warn(`[brNumberParser] Falha ao parsear: "${valor}"`);
    return 0;
  }

  return num;
}

/**
 * TESTES DE VALIDAÇÃO (comentados):
 * 
 * parseBrNumber("1.234,56")     -> 1234.56  ✓
 * parseBrNumber("1234,56")      -> 1234.56  ✓
 * parseBrNumber("1.234.567")    -> 1234567  ✓
 * parseBrNumber("1234")         -> 1234     ✓
 * parseBrNumber("(1.234,56)")   -> -1234.56 ✓
 * parseBrNumber("33,65%")       -> 0.3365   ✓
 * parseBrNumber("R$ 1.234,56")  -> 1234.56  ✓
 * parseBrNumber("-1.234,56")    -> -1234.56 ✓
 * parseBrNumber("123.45")       -> 123.45   ✓
 * parseBrNumber("")             -> null     ✓
 * parseBrNumber(null)           -> null     ✓
 * parseBrNumber("abc")          -> 0        ✓
 */

/**
 * Normalizar descricao para comparação (remover acentos, espaços múltiplos)
 */
export function normalizarDescricao(texto) {
  if (!texto) return '';
  
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remover acentos
    .replace(/\s+/g, ' '); // múltiplos espaços -> 1
}

/**
 * Calcular SHA-256 de um buffer
 */
export async function calcularHashArquivo(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
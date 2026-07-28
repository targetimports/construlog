/**
 * TRUNC2: Trunca para 2 casas decimais em direção a zero
 * Sem arredondamento (banker's rounding evitado)
 * 
 * Exemplos:
 * 10.239 -> 10.23
 * 10.235 -> 10.23 (trunca, não arredonda)
 * -10.239 -> -10.23
 * -10.235 -> -10.23 (trunca, não arredonda)
 */

import Decimal from 'npm:decimal.js@10.4.3';

export function TRUNC2(x) {
  if (x === null || x === undefined) return 0;
  
  const d = new Decimal(x);
  
  // Se zero, retornar zero
  if (d.isZero()) return 0;
  
  // Multiplicar por 100 para mover casas decimais
  const scaled = d.mul(100);
  
  // Truncar em direção a zero: positivos floor, negativos ceil
  let truncated;
  if (scaled.isNeg()) {
    truncated = scaled.ceil(); // -1023.5 -> -1023
  } else {
    truncated = scaled.floor(); // 1023.5 -> 1023
  }
  
  // Dividir por 100 para voltar
  return truncated.div(100).toNumber();
}

/**
 * TRUNC2_PRECISE: retorna Decimal ao invés de number
 * Para uso em cadeias de cálculos sem perda de precisão
 */
export function TRUNC2_PRECISE(x) {
  if (x === null || x === undefined) return new Decimal(0);
  
  const d = x instanceof Decimal ? x : new Decimal(x);
  
  if (d.isZero()) return new Decimal(0);
  
  const scaled = d.mul(100);
  let truncated;
  if (scaled.isNeg()) {
    truncated = scaled.ceil();
  } else {
    truncated = scaled.floor();
  }
  
  return truncated.div(100);
}

/**
 * Teste simples
 */
export function testTRUNC2() {
  const tests = [
    [10.239, 10.23],
    [10.235, 10.23],
    [-10.239, -10.23],
    [-10.235, -10.23],
    [0, 0],
    [100.999, 100.99],
  ];
  
  const failed = [];
  for (const [input, expected] of tests) {
    const result = TRUNC2(input);
    if (Math.abs(result - expected) > 0.001) {
      failed.push({ input, expected, got: result });
    }
  }
  
  return { passed: tests.length - failed.length, failed };
}
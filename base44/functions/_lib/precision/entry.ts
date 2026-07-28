/**
 * precision.js — Utilitário de precisão monetária
 * 
 * TRUNC2: Trunca para 2 casas decimais em direção a zero
 * Garante integridade em somas de valores monetários
 */

export function TRUNC2(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }

  const num = Number(value);
  if (num === 0) return 0;

  // Multiplicar por 100, truncar em direção a zero, depois dividir
  const scaled = num * 100;
  const truncated = num >= 0 ? Math.floor(scaled) : Math.ceil(scaled);
  return Math.round(truncated) / 100;
}

/**
 * Testes de validação embutidos
 */
export function validatePrecision() {
  const tests = [
    { input: 10.239, expected: 10.23, desc: '10.239 → 10.23' },
    { input: 10.235, expected: 10.23, desc: '10.235 → 10.23' },
    { input: 10.994, expected: 10.99, desc: '10.994 → 10.99' },
    { input: -10.239, expected: -10.23, desc: '-10.239 → -10.23' },
    { input: -10.235, expected: -10.23, desc: '-10.235 → -10.23' },
    { input: 0, expected: 0, desc: '0 → 0' },
    { input: null, expected: 0, desc: 'null → 0' },
  ];

  const failures = tests.filter(t => TRUNC2(t.input) !== t.expected);
  
  if (failures.length > 0) {
    console.error('❌ TRUNC2 validation FAILED:', failures);
    return false;
  }
  
  console.log('✅ TRUNC2 validation PASSED:', tests.length, 'tests');
  return true;
}

// Executar validação ao importar
if (typeof window === 'undefined') { // Deno/Node
  validatePrecision();
}
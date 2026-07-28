/**
 * Cálculo puro e reativo de remuneração
 * NUNCA retorna NaN - sempre números válidos
 */

import { parseBRL } from '@/components/shared/moneyBR';

/**
 * Calcula INSS Empregado usando tabela progressiva
 */
function calcINSSAuto(salarioBruto, tabelaINSS) {
  if (!tabelaINSS || tabelaINSS.length === 0) {
    console.warn('[RH] Tabela INSS vazia, retornando 0');
    return 0;
  }

  // Encontrar faixa aplicável
  for (const faixa of tabelaINSS) {
    if (salarioBruto <= (faixa.ate || 0)) {
      return salarioBruto * ((faixa.aliquota || 0) / 100);
    }
  }

  // Se passou de todas as faixas, usar última alíquota
  const ultimaFaixa = tabelaINSS[tabelaINSS.length - 1];
  return salarioBruto * ((ultimaFaixa.aliquota || 0) / 100);
}

/**
 * Calcula IRRF usando tabela progressiva
 */
function calcIRRFAuto(baseCalculo, tabelaIRRF) {
  if (!tabelaIRRF || tabelaIRRF.length === 0) {
    console.warn('[RH] Tabela IRRF vazia, retornando 0');
    return 0;
  }

  // Encontrar faixa aplicável
  for (const faixa of tabelaIRRF) {
    if (baseCalculo <= (faixa.ate || 0)) {
      const calc = (baseCalculo * ((faixa.aliquota || 0) / 100)) - (faixa.parcela_deduzir || 0);
      return Math.max(0, calc);
    }
  }

  // Se passou de todas as faixas, usar última faixa
  const ultimaFaixa = tabelaIRRF[tabelaIRRF.length - 1];
  const calc = (baseCalculo * ((ultimaFaixa.aliquota || 0) / 100)) - (ultimaFaixa.parcela_deduzir || 0);
  return Math.max(0, calc);
}

/**
 * Calcula resumo completo de remuneração
 * @param {object} remu - state numérico da remuneração
 * @param {object} paramsRH - ConfiguracaoRH (tabelas INSS/IRRF)
 * @param {object} beneficiosCalculados - {empresa: number, funcionario: number}
 * @returns {object} resumo calculado (todos numbers, nunca NaN)
 */
export function calcResumo(remu = {}, paramsRH = {}, beneficiosCalculados = {}) {
  // Garantir que todos os valores são numbers
  const salarioBase = parseBRL(remu.salario_base_mensal || 0);
  const bonificacao = parseBRL(remu.bonificacao_mensal || 0);
  const beneficiosEmpresa = parseBRL(beneficiosCalculados.empresa || 0);
  const beneficiosFuncionario = parseBRL(beneficiosCalculados.funcionario || 0);
  const custosExtras = parseBRL(remu.custos_extras_total_empresa || 0);

  // Bruto funcionário
  const brutoFuncionario = salarioBase + bonificacao;

  // ENCARGOS EMPRESA
  let fgtsCalc = 0;
  // Priorizar override manual se existir
  if (remu.fgts_calculado && remu.fgts_calculado > 0) {
    fgtsCalc = parseBRL(remu.fgts_calculado);
  } else {
    const fgtsTipo = remu.fgts_tipo || 'percentual';
    if (fgtsTipo === 'percentual') {
      const percent = parseBRL(remu.fgts_percentual || 8);
      fgtsCalc = salarioBase * (percent / 100);
    } else {
      fgtsCalc = parseBRL(remu.fgts_valor_fixo || 0);
    }
  }

  let inssPatCalc = 0;
  // Priorizar override manual se existir
  if (remu.inss_patronal_calculado && remu.inss_patronal_calculado > 0) {
    inssPatCalc = parseBRL(remu.inss_patronal_calculado);
  } else {
    const inssPatTipo = remu.inss_patronal_tipo || 'percentual';
    if (inssPatTipo === 'percentual') {
      const percent = parseBRL(remu.inss_patronal_percentual || 20);
      inssPatCalc = salarioBase * (percent / 100);
    } else {
      inssPatCalc = parseBRL(remu.inss_patronal_valor_fixo || 0);
    }
  }

  const encargosEmpresa = fgtsCalc + inssPatCalc;

  // DESCONTOS FUNCIONÁRIO
  let inssEmpCalc = 0;
  // Priorizar override manual se existir
  if (remu.inss_empregado_calculado && remu.inss_empregado_calculado > 0) {
    inssEmpCalc = parseBRL(remu.inss_empregado_calculado);
  } else {
    const inssEmpTipo = remu.inss_empregado_tipo || 'percentual';
    if (inssEmpTipo === 'valor_fixo') {
      inssEmpCalc = parseBRL(remu.inss_empregado_valor_fixo || 0);
    } else if (inssEmpTipo === 'percentual') {
      const percent = parseBRL(remu.inss_empregado_percentual || 0);
      inssEmpCalc = brutoFuncionario * (percent / 100);
    } else {
      // AUTO: usar tabela
      const tabela = paramsRH.tabela_inss_empregado;
      if (tabela && Array.isArray(tabela)) {
        inssEmpCalc = calcINSSAuto(brutoFuncionario, tabela);
      } else {
        inssEmpCalc = 0;
      }
    }
  }

  let irrfCalc = 0;
  // Priorizar override manual se existir
  if (remu.irrf_calculado && remu.irrf_calculado > 0) {
    irrfCalc = parseBRL(remu.irrf_calculado);
  } else {
    const irrfTipo = remu.irrf_tipo || 'valor_fixo';
    if (irrfTipo === 'valor_fixo') {
      irrfCalc = parseBRL(remu.irrf_valor_fixo || 0);
    } else if (irrfTipo === 'percentual') {
      const percent = parseBRL(remu.irrf_percentual || 0);
      irrfCalc = brutoFuncionario * (percent / 100);
    } else {
      // AUTO: usar tabela
      const baseCalculo = brutoFuncionario - inssEmpCalc;
      const tabela = paramsRH.tabela_irrf;
      if (tabela && Array.isArray(tabela)) {
        irrfCalc = calcIRRFAuto(baseCalculo, tabela);
      } else {
        irrfCalc = 0;
      }
    }
  }

  const outrosDescontos = parseBRL(remu.outros_descontos || 0);
  const descontosFuncionario = inssEmpCalc + irrfCalc + outrosDescontos + beneficiosFuncionario;

  // LÍQUIDO
  const liquido = brutoFuncionario - descontosFuncionario;

  // CUSTO TOTAL EMPRESA
  const custoTotalEmpresa = brutoFuncionario + encargosEmpresa + beneficiosEmpresa + custosExtras;

  // Validação anti-NaN
  const resultado = {
    salarioBase,
    bonificacao,
    brutoFuncionario,
    fgtsCalc,
    inssPatCalc,
    encargosEmpresa,
    inssEmpCalc,
    irrfCalc,
    outrosDescontos,
    beneficiosEmpresa,
    beneficiosFuncionario,
    descontosFuncionario,
    liquido,
    custosExtras,
    custoTotalEmpresa
  };

  // Logar se algum NaN escapou
  Object.entries(resultado).forEach(([key, val]) => {
    if (isNaN(val)) {
      console.error(`[RH] NaN detectado em ${key}:`, remu);
      resultado[key] = 0;
    }
  });

  return resultado;
}
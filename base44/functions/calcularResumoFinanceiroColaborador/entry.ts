/**
 * Calcula resumo financeiro completo do colaborador
 * Inclui salário, encargos, benefícios, jornada
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function parseBRL(value) {
  if (typeof value === 'number' && !isNaN(value)) return Math.max(0, value);
  if (!value) return 0;
  const str = String(value).replace(/R\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.max(0, num);
}

function calcDiasTrabalhadosMes(jornada, competenciaAAAAMM) {
  // Estimativa simples: 4.33 semanas/mês
  const diasSemana = jornada?.dias_trabalho_semana || 6;
  return Math.round(diasSemana * 4.33);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { colaborador_id, competencia } = await req.json();

    if (!colaborador_id) {
      return Response.json({ error: 'colaborador_id obrigatório' }, { status: 400 });
    }

    // Buscar colaborador
    const colab = await base44.asServiceRole.entities.Colaborador.get(colaborador_id);
    if (!colab) {
      return Response.json({ error: 'Colaborador não encontrado' }, { status: 404 });
    }

    const rem = colab.remuneracao || {};
    const jornada = colab.jornada || {};

    // Base salarial
    const salarioBase = parseBRL(rem.salario_base_mensal || 0);
    const bonificacao = parseBRL(rem.bonificacao_mensal || 0);
    const salarioBruto = salarioBase + bonificacao;

    // Encargos empresa
    const fgts = parseBRL(rem.fgts_calculado || 0);
    const inssPatronal = parseBRL(rem.inss_patronal_calculado || 0);
    const encargosEmpresaTotal = fgts + inssPatronal;

    // Descontos funcionário (INSS + IRRF + outros)
    const inssEmp = parseBRL(rem.inss_empregado_calculado || 0);
    const irrf = parseBRL(rem.irrf_calculado || 0);
    const outrosDescontos = parseBRL(rem.outros_descontos || 0);

    // Benefícios do colaborador
    const beneficios = await base44.asServiceRole.entities.ColaboradorBeneficio.filter({
      colaborador_id,
      ativo: true
    });

    const diasMes = calcDiasTrabalhadosMes(jornada, competencia);

    let beneficiosEmpresaTotal = 0;
    let beneficiosFuncionarioTotal = 0;
    const detalhamentoBeneficios = [];

    for (const ben of beneficios) {
      // Buscar catálogo
      const catalogo = await base44.asServiceRole.entities.BeneficioCatalogo.get(ben.beneficio_id);
      const nome = catalogo?.nome || 'Benefício';

      const tipoCalc = ben.tipo_calculo || catalogo?.tipo_calculo || 'FIXO';
      let valorBase = 0;

      switch (tipoCalc) {
        case 'FIXO':
          valorBase = parseBRL(ben.valor_mensal || catalogo?.valor_padrao || 0);
          break;
        case 'POR_DIA':
          const valorDia = parseBRL(ben.valor_por_dia || catalogo?.valor_por_dia_padrao || 0);
          valorBase = valorDia * diasMes;
          break;
        case 'PERCENTUAL':
          const percent = parseBRL(ben.percentual || catalogo?.percentual_padrao || 0);
          valorBase = salarioBase * (percent / 100);
          break;
        case 'MANUAL':
          valorBase = parseBRL(ben.valor_mensal || 0);
          break;
        default:
          valorBase = parseBRL(ben.valor_mensal || 0);
      }

      // Dividir conforme quem paga
      const quemPaga = ben.quem_paga || catalogo?.quem_paga_padrao || 'EMPRESA';
      let valorEmpresa = 0;
      let valorFuncionario = 0;

      if (quemPaga === 'EMPRESA') {
        valorEmpresa = valorBase;
      } else if (quemPaga === 'FUNCIONARIO') {
        valorFuncionario = valorBase;
      } else if (quemPaga === 'COMPARTILHADO') {
        const percEmp = parseBRL(ben.perc_empresa || catalogo?.percentual_empresa_padrao || 80);
        const percFunc = parseBRL(ben.perc_funcionario || catalogo?.percentual_funcionario_padrao || 20);
        valorEmpresa = valorBase * (percEmp / 100);
        valorFuncionario = valorBase * (percFunc / 100);
      }

      beneficiosEmpresaTotal += valorEmpresa;
      beneficiosFuncionarioTotal += valorFuncionario;

      detalhamentoBeneficios.push({
        nome,
        tipo_calculo: tipoCalc,
        valor_base: valorBase,
        valor_empresa: valorEmpresa,
        valor_funcionario: valorFuncionario
      });
    }

    // Totais finais
    const descontosFuncionarioTotal = inssEmp + irrf + outrosDescontos + beneficiosFuncionarioTotal;
    const custoTotalEmpresa = salarioBruto + encargosEmpresaTotal + beneficiosEmpresaTotal;
    const salarioLiquidoEstimado = salarioBruto - descontosFuncionarioTotal;

    const resultado = {
      colaborador_id,
      competencia,
      salarioBase,
      bonificacao,
      salarioBruto,
      encargosEmpresaTotal,
      beneficiosEmpresaTotal,
      beneficiosFuncionarioTotal,
      descontosFuncionarioTotal,
      custoTotalEmpresa,
      salarioLiquidoEstimado,
      diasTrabalhadosMes: diasMes,
      detalhamento: {
        encargos: { fgts, inss_patronal: inssPatronal },
        descontos: { inss_empregado: inssEmp, irrf, outros: outrosDescontos },
        beneficios: detalhamentoBeneficios
      }
    };

    return Response.json(resultado);
  } catch (error) {
    console.error('[RH] Erro ao calcular resumo:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
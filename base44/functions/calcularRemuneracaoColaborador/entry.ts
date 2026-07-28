/**
 * Calcula automaticamente remuneração completa do colaborador
 * Usa ConfiguracaoRH para defaults, mas permite override manual
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { colaborador_id, salario_base, bonificacao = 0, override = {} } = await req.json();

    if (!salario_base || salario_base <= 0) {
      return Response.json({ error: 'Salário base inválido' }, { status: 400 });
    }

    // Buscar configuração RH (defaults)
    let config = await base44.asServiceRole.entities.ConfiguracaoRH.filter({ ativo: true });
    config = config && config.length > 0 ? config[0] : null;

    // Defaults seguros se config não existe
    const fgts_percentual = config?.fgts_percentual_padrao || 8;
    const inss_patronal_percentual = config?.inss_patronal_percentual_padrao || 20;
    const tabela_inss = config?.tabela_inss_empregado || [
      { ate: 1412, aliquota: 7.5 },
      { ate: 2666.68, aliquota: 9 },
      { ate: 4000.03, aliquota: 12 },
      { ate: 7786.02, aliquota: 14 }
    ];
    const tabela_irrf = config?.tabela_irrf || [
      { ate: 2259.20, aliquota: 0, parcela_deduzir: 0 },
      { ate: 2826.65, aliquota: 7.5, parcela_deduzir: 169.44 },
      { ate: 3751.05, aliquota: 15, parcela_deduzir: 381.44 },
      { ate: 4664.68, aliquota: 22.5, parcela_deduzir: 662.77 },
      { ate: 999999, aliquota: 27.5, parcela_deduzir: 896.00 }
    ];

    // Cálculo base
    const salario_bruto = salario_base + bonificacao;

    // ENCARGOS EMPRESA
    const fgts_calculado = override.fgts_calculado !== undefined 
      ? override.fgts_calculado 
      : (salario_base * (fgts_percentual / 100));
    
    const inss_patronal_calculado = override.inss_patronal_calculado !== undefined
      ? override.inss_patronal_calculado
      : (salario_base * (inss_patronal_percentual / 100));

    const total_encargos_empresa = fgts_calculado + inss_patronal_calculado;

    // DESCONTOS FUNCIONÁRIO - INSS (progressivo por faixas)
    let inss_empregado_calculado = 0;
    if (override.inss_empregado_calculado !== undefined) {
      inss_empregado_calculado = override.inss_empregado_calculado;
    } else {
      for (const faixa of tabela_inss) {
        if (salario_bruto <= faixa.ate) {
          inss_empregado_calculado = salario_bruto * (faixa.aliquota / 100);
          break;
        }
      }
    }

    // DESCONTOS FUNCIONÁRIO - IRRF (progressivo)
    let irrf_calculado = 0;
    if (override.irrf_calculado !== undefined) {
      irrf_calculado = override.irrf_calculado;
    } else {
      const base_calculo = salario_bruto - inss_empregado_calculado;
      for (const faixa of tabela_irrf) {
        if (base_calculo <= faixa.ate) {
          irrf_calculado = Math.max(0, (base_calculo * (faixa.aliquota / 100)) - faixa.parcela_deduzir);
          break;
        }
      }
    }

    const outros_descontos = override.outros_descontos || 0;
    const total_descontos_funcionario = inss_empregado_calculado + irrf_calculado + outros_descontos;

    // Salário líquido
    const salario_liquido = salario_bruto - total_descontos_funcionario;

    // Custo total empresa (base + encargos + benefícios/extras)
    const beneficios_total = override.beneficios_total_empresa || 0;
    const custos_extras_total = override.custos_extras_total_empresa || 0;
    const custo_total_mensal_empresa = salario_bruto + total_encargos_empresa + beneficios_total + custos_extras_total;

    const remuneracao = {
      salario_base_mensal: salario_base,
      bonificacao_mensal: bonificacao,
      salario_bruto,
      fgts_tipo: 'percentual',
      fgts_percentual,
      fgts_calculado,
      inss_patronal_tipo: 'percentual',
      inss_patronal_percentual,
      inss_patronal_calculado,
      total_encargos_empresa,
      inss_empregado_tipo: 'percentual',
      inss_empregado_calculado,
      irrf_tipo: 'valor_fixo',
      irrf_calculado,
      outros_descontos,
      total_descontos_funcionario,
      beneficios_total_empresa: beneficios_total,
      custos_extras_total_empresa: custos_extras_total,
      custo_total_mensal_empresa,
      salario_liquido,
      data_ultima_atualizacao: new Date().toISOString()
    };

    // Se colaborador_id fornecido, atualizar no banco
    if (colaborador_id) {
      await base44.asServiceRole.entities.Colaborador.update(colaborador_id, {
        remuneracao,
        salario: salario_base // manter campo legado
      });

      console.log(`[RH] Remuneração calculada e salva: ${colaborador_id}`);
    }

    return Response.json({ remuneracao, success: true });
  } catch (error) {
    console.error('[RH] Erro ao calcular remuneração:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
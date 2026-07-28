/**
 * Popula catálogo de benefícios padrão
 * VR, VA, VT, Plano Saúde, etc.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !['admin', 'programador', 'admin_empresa'].includes(user.role || user.perfil_acesso)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const beneficiosPadrao = [
      {
        nome: 'Vale Refeição',
        tipo_calculo: 'POR_DIA',
        valor_por_dia_padrao: 30,
        quem_paga_padrao: 'EMPRESA',
        categoria: 'alimentacao',
        incide_dias_trabalhados: true,
        ativo: true
      },
      {
        nome: 'Vale Alimentação',
        tipo_calculo: 'FIXO',
        valor_padrao: 300,
        quem_paga_padrao: 'EMPRESA',
        categoria: 'alimentacao',
        ativo: true
      },
      {
        nome: 'Vale Transporte',
        tipo_calculo: 'POR_DIA',
        valor_por_dia_padrao: 10,
        quem_paga_padrao: 'COMPARTILHADO',
        percentual_empresa_padrao: 94,
        percentual_funcionario_padrao: 6,
        categoria: 'transporte',
        incide_dias_trabalhados: true,
        ativo: true
      },
      {
        nome: 'Plano de Saúde',
        tipo_calculo: 'FIXO',
        valor_padrao: 450,
        quem_paga_padrao: 'COMPARTILHADO',
        percentual_empresa_padrao: 70,
        percentual_funcionario_padrao: 30,
        categoria: 'saude',
        ativo: true
      },
      {
        nome: 'Plano Odontológico',
        tipo_calculo: 'FIXO',
        valor_padrao: 80,
        quem_paga_padrao: 'COMPARTILHADO',
        percentual_empresa_padrao: 50,
        percentual_funcionario_padrao: 50,
        categoria: 'saude',
        ativo: true
      },
      {
        nome: 'Seguro de Vida',
        tipo_calculo: 'FIXO',
        valor_padrao: 25,
        quem_paga_padrao: 'EMPRESA',
        categoria: 'seguro',
        ativo: true
      },
      {
        nome: 'Ajuda de Custo',
        tipo_calculo: 'MANUAL',
        valor_padrao: 0,
        quem_paga_padrao: 'EMPRESA',
        categoria: 'outros',
        ativo: true
      }
    ];

    const criados = [];
    for (const ben of beneficiosPadrao) {
      // Verificar se já existe
      const existente = await base44.asServiceRole.entities.BeneficioCatalogo.filter({ nome: ben.nome });
      if (!existente || existente.length === 0) {
        const novo = await base44.asServiceRole.entities.BeneficioCatalogo.create(ben);
        criados.push(novo.id);
      }
    }

    return Response.json({ 
      success: true, 
      criados: criados.length,
      message: `${criados.length} benefícios criados no catálogo` 
    });
  } catch (error) {
    console.error('[RH] Erro ao criar benefícios padrão:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
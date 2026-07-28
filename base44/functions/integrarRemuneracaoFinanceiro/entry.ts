/**
 * Integra remuneração com financeiro automaticamente
 * Cria/atualiza lançamento recorrente mensal em Mão de Obra
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { colaborador_id } = await req.json();

    if (!colaborador_id) {
      return Response.json({ error: 'colaborador_id obrigatório' }, { status: 400 });
    }

    // Buscar colaborador
    const colaborador = await base44.asServiceRole.entities.Colaborador.get(colaborador_id);
    if (!colaborador) {
      return Response.json({ error: 'Colaborador não encontrado' }, { status: 404 });
    }

    const custo_total = colaborador.remuneracao?.custo_total_mensal_empresa || 0;
    
    if (custo_total <= 0) {
      return Response.json({ 
        success: false, 
        message: 'Custo total é zero, nenhum lançamento criado' 
      });
    }

    // Verificar se já existe lançamento para este colaborador
    const existente = await base44.asServiceRole.entities.ContaFinanceira.filter({
      tipo: 'pagar',
      categoria: 'mao_de_obra',
      referencia_tipo: 'colaborador',
      referencia_id: colaborador_id
    });

    const hoje = new Date().toISOString().split('T')[0];
    const competencia = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Determinar obra_id (rateio básico)
    let obra_id = 'administrativo';
    if (colaborador.obra_atual_id) {
      obra_id = colaborador.obra_atual_id;
    } else if (colaborador.obras_vinculadas && colaborador.obras_vinculadas.length > 0) {
      obra_id = colaborador.obras_vinculadas[0].obra_id;
    }

    const descricao = `Salário - ${colaborador.nome} (${colaborador.cargo})`;

    if (existente && existente.length > 0) {
      // Atualizar existente
      const lancamento_id = existente[0].id;
      await base44.asServiceRole.entities.ContaFinanceira.update(lancamento_id, {
        descricao,
        valor: custo_total,
        obra_id,
        status: colaborador.status === 'ativo' ? 'pendente' : 'cancelado'
      });

      console.log(`[RH-FINANCEIRO] Lançamento atualizado: ${lancamento_id}`);
      
      return Response.json({ 
        success: true, 
        action: 'updated',
        lancamento_id 
      });
    } else {
      // Criar novo
      const novo = await base44.asServiceRole.entities.ContaFinanceira.create({
        tipo: 'pagar',
        categoria: 'mao_de_obra',
        descricao,
        valor: custo_total,
        data_vencimento: hoje,
        status: 'pendente',
        obra_id,
        referencia_tipo: 'colaborador',
        referencia_id: colaborador_id,
        observacao: `Custo mensal: R$ ${custo_total.toFixed(2)} | Competência: ${competencia}`
      });

      console.log(`[RH-FINANCEIRO] Lançamento criado: ${novo.id}`);

      return Response.json({ 
        success: true, 
        action: 'created',
        lancamento_id: novo.id 
      });
    }
  } catch (error) {
    console.error('[RH-FINANCEIRO] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
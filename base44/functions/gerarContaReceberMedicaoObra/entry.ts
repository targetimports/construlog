import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { validarIntegridadeObraCentroCusto } from './_lib/validadorIntegridade.js';
import { registrarAuditoria } from './_lib/auditoria.js';

/**
 * Gera Conta a Receber automaticamente após aprovação de medição
 * Com idempotência garantida
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { medicao_id } = await req.json();

    if (!medicao_id) {
      return Response.json({ 
        error: 'medicao_id é obrigatório' 
      }, { status: 400 });
    }

    // Buscar medição
    const medicao = await base44.entities.MedicaoObra.get(medicao_id);
    if (!medicao) {
      return Response.json({ error: 'Medição não encontrada' }, { status: 404 });
    }

    // ========================================
    // VALIDAÇÃO DE INTEGRIDADE
    // ========================================
    await validarIntegridadeObraCentroCusto(base44, {
      entidade: 'ContaFinanceira',
      funcao: 'gerarContaReceberMedicaoObra',
      obra_id: medicao.obra_id,
      tipo_impacto: 'receita',
      usuario_id: user.email,
      payload: { medicao_id, valor: medicao.valor_total }
    });

    // Buscar obra
    const obra = await base44.entities.Obra.get(medicao.obra_id);
    if (!obra) {
      return Response.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    // ========================================
    // IDEMPOTÊNCIA: Verificar se já foi faturado
    // ========================================
    
    const contasExistentes = await base44.entities.ContaFinanceira.filter({
      referencia_tipo: 'medicao',
      referencia_id: medicao_id
    });

    if (contasExistentes.length > 0) {
      // Já foi faturado, retornar existente
      return Response.json({
        success: true,
        mensagem: 'Medição já foi faturada anteriormente',
        duplicado: true,
        conta_financeira_id: contasExistentes[0].id,
        conta_existente: contasExistentes[0]
      });
    }

    // ========================================
    // Gerar Conta a Receber
    // ========================================

    const dataEmissao = new Date().toISOString().split('T')[0];
    const dataVencimento = new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];

    const contaReceber = await base44.asServiceRole.entities.ContaFinanceira.create({
      tipo: 'receber',
      descricao: `Faturamento Medição ${medicao.numero || medicao_id}`,
      valor: medicao.valor_total || 0,
      data_vencimento: dataVencimento,
      status: 'pendente',
      obra_id: medicao.obra_id,
      categoria: 'medicao',
      centro_custo: 'principal',
      fornecedor_cliente: obra.cliente || 'Cliente',
      cliente_id: obra.cliente_id,
      referencia_tipo: 'medicao',
      referencia_id: medicao_id,
      medicao_id: medicao_id,
      observacao: `Período: ${medicao.periodo_inicio || ''} a ${medicao.periodo_fim || ''}`
    });

    // ========================================
    // Marcar medição como FATURADA
    // ========================================

    await base44.asServiceRole.entities.MedicaoObra.update(medicao_id, {
      status: 'faturada',
      conta_financeira_id: contaReceber.id,
      data_faturamento: new Date().toISOString()
    });

    // AUDITORIA: Conta a Receber criada
    await registrarAuditoria(base44, {
      entidade: 'ContaFinanceira',
      entidade_id: contaReceber.id,
      operacao: 'criar',
      dados_antes: null,
      dados_depois: contaReceber,
      usuario_id: user.email,
      obra_id: medicao.obra_id,
      origem_funcao: 'gerarContaReceberMedicaoObra'
    });

    // AUDITORIA: Medição faturada
    await registrarAuditoria(base44, {
      entidade: 'MedicaoObra',
      entidade_id: medicao_id,
      operacao: 'atualizar',
      dados_antes: medicao,
      dados_depois: { ...medicao, status: 'faturada', conta_financeira_id: contaReceber.id },
      usuario_id: user.email,
      obra_id: medicao.obra_id,
      origem_funcao: 'gerarContaReceberMedicaoObra'
    });

    return Response.json({
      success: true,
      mensagem: 'Conta a receber gerada com sucesso',
      conta_financeira_id: contaReceber.id,
      medicao_id,
      valor: medicao.valor_total,
      obra_id: medicao.obra_id
    });

  } catch (error) {
    console.error('Erro ao gerar conta a receber:', error);
    return Response.json({ 
      error: error.message || 'Erro ao gerar conta a receber' 
    }, { status: 500 });
  }
});
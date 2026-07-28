import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { requireRole } from './_lib/requireRole.js';
import { logAuditoria, prepararDadosLog } from './_lib/logAuditoria.js';

/**
 * Editar Conta a Receber com Validação Obrigatória de Obra
 * 
 * REGRA DE NEGÓCIO: Não permitir remover obra_id de contas a receber
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // RBAC: apenas diretor e financeiro podem editar contas
    const { user } = await requireRole(base44, ['diretor', 'financeiro']);

    const { conta_id, ...dados } = await req.json();

    if (!conta_id) {
      return Response.json({
        error: 'conta_id é obrigatório'
      }, { status: 400 });
    }

    // Buscar conta existente
    const contas = await base44.asServiceRole.entities.ContaFinanceira.filter({ id: conta_id });
    const conta = contas[0];

    if (!conta) {
      return Response.json({ error: 'Conta não encontrada' }, { status: 404 });
    }

    if (conta.tipo !== 'receber') {
      return Response.json({
        error: 'Esta conta não é do tipo "receber"'
      }, { status: 422 });
    }

    // VALIDAÇÃO CRÍTICA: não permitir remover obra_id
    if (dados.obra_id === null || dados.obra_id === undefined || dados.obra_id === '') {
      return Response.json({
        error: 'obra_id é obrigatório e não pode ser removido',
        field: 'obra_id'
      }, { status: 400 });
    }

    // Se está mudando a obra, validar se a nova existe
    if (dados.obra_id && dados.obra_id !== conta.obra_id) {
      const obras = await base44.asServiceRole.entities.Obra.filter({ id: dados.obra_id });
      if (!obras || obras.length === 0) {
        return Response.json({
          error: 'Nova obra não encontrada',
          field: 'obra_id'
        }, { status: 404 });
      }
    }

    // Validar valor se fornecido
    if (dados.valor !== undefined && dados.valor <= 0) {
      return Response.json({
        error: 'Valor deve ser maior que zero'
      }, { status: 400 });
    }

    // Guardar dados anteriores para auditoria
    const dadosAnteriores = {
      descricao: conta.descricao,
      valor: conta.valor,
      data_vencimento: conta.data_vencimento,
      obra_id: conta.obra_id
    };

    // Atualizar apenas campos permitidos
    const camposPermitidos = [
      'descricao',
      'valor',
      'data_vencimento',
      'obra_id',
      'fornecedor_cliente',
      'cliente_id',
      'categoria',
      'referencia_tipo',
      'referencia_id',
      'observacao'
    ];

    const dadosAtualizacao = {};
    for (const campo of camposPermitidos) {
      if (dados[campo] !== undefined) {
        dadosAtualizacao[campo] = dados[campo];
      }
    }

    await base44.asServiceRole.entities.ContaFinanceira.update(conta_id, dadosAtualizacao);

    // Auditoria (util central)
    await logAuditoria(base44, {
      entidade_tipo: 'ContaFinanceira',
      entidade_id: conta_id,
      acao: 'UPDATE',
      resumo: `Conta a receber editada`,
      dados_anteriores: dadosAnteriores,
      dados_novos: dadosAtualizacao,
      user_email: user.email,
      role: user.cargo,
      origem: 'ui',
      modulo: 'financeiro'
    });

    return Response.json({
      ok: true,
      conta_id,
      message: 'Conta a receber atualizada com sucesso'
    });

  } catch (error) {
    console.error('[ERROR] editarContaReceber:', error);
    return Response.json({
      error: error.message || 'Erro ao editar conta'
    }, { status: 500 });
  }
});
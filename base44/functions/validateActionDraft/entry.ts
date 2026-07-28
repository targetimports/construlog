import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Valida ActionDraft antes de executar
 * Verifica campos obrigatórios, permissões e consistência
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { actionDraft } = await req.json();

    if (!actionDraft || !actionDraft.acao) {
      return Response.json({ 
        valid: false, 
        errors: ['ActionDraft inválido'] 
      }, { status: 400 });
    }

    const errors = [];
    const warnings = [];

    // Validar permissões RBAC
    const permissoes = verificarPermissoes(user, actionDraft.acao);
    if (!permissoes.allowed) {
      errors.push(`Sem permissão para: ${actionDraft.acao}`);
      return Response.json({ 
        valid: false, 
        errors,
        permissao_negada: true 
      });
    }

    // Validar campos obrigatórios por ação
    const camposObrigatorios = getCamposObrigatoriosV2(actionDraft.acao);
    for (const campo of camposObrigatorios) {
      if (!actionDraft.dados[campo] && campo !== 'obra_id') {
        errors.push(`Campo obrigatório ausente: ${campo}`);
      }
    }

    // Validar valor positivo
    if (actionDraft.dados.valor !== undefined && actionDraft.dados.valor <= 0) {
      errors.push('Valor deve ser positivo');
    }

    // Validar obra_id se contexto exigir
    const acoesQueExigemObra = ['CREATE_EXPENSE', 'CREATE_AP', 'CREATE_AR'];
    if (acoesQueExigemObra.includes(actionDraft.acao) && !actionDraft.dados.obra_id) {
      warnings.push('Obra não selecionada - pode gerar erro em alguns tipos de lançamento');
    }

    // Validar data_vencimento para contas
    if (['CREATE_AP', 'CREATE_AR'].includes(actionDraft.acao)) {
      if (!actionDraft.dados.data_vencimento) {
        errors.push('Data de vencimento obrigatória para contas a pagar/receber');
      }
    }

    // Validar fornecedor/cliente
    if (actionDraft.dados.fornecedor_cliente) {
      try {
        const pessoas = await base44.asServiceRole.entities.Pessoa.filter({
          nome: { $regex: actionDraft.dados.fornecedor_cliente, $options: 'i' }
        });
        
        if (pessoas.length === 0) {
          warnings.push(`Pessoa "${actionDraft.dados.fornecedor_cliente}" não encontrada - será criada`);
        } else {
          actionDraft.dados.pessoa_id = pessoas[0].id;
        }
      } catch (err) {
        warnings.push('Erro ao buscar pessoa');
      }
    }

    // Validar conta_id para pagamentos/recebimentos
    if (['PAY_AP', 'RECEIVE_AR'].includes(actionDraft.acao) && !actionDraft.dados.conta_id) {
      errors.push('ID da conta obrigatório para pagamento/recebimento');
    }

    // Validar recordRef para edição/exclusão
    if (['EDIT_RECORD', 'DELETE_RECORD'].includes(actionDraft.acao)) {
      if (!actionDraft.dados.recordRef && !actionDraft.dados.registro_id) {
        errors.push('Referência ao registro obrigatória (use "último" ou "id:123")');
      }
    }

    return Response.json({
      valid: errors.length === 0,
      errors,
      warnings,
      actionDraft // Retorna draft atualizado com pessoa_id se encontrada
    });

  } catch (error) {
    console.error('Erro na validação:', error);
    return Response.json({ 
      valid: false,
      errors: [error.message || 'Erro ao validar'],
      stack: error.stack?.substring(0, 200)
    }, { status: 500 });
  }
});

function verificarPermissoes(user, acao) {
  const role = user.role || 'user';
  const perfil = user.perfil_sistema || user.cargo || 'user';

  // Admin pode tudo
  if (role === 'admin' || perfil === 'admin') {
    return { allowed: true, permissoes: ['*'] };
  }

  // Perfis executivos
  if (['diretoria', 'executivo'].includes(perfil)) {
    return { allowed: true, permissoes: ['*'] };
  }

  // Financeiro
  if (perfil === 'financeiro') {
    return { 
      allowed: true, 
      permissoes: ['CREATE_EXPENSE', 'CREATE_INCOME', 'CREATE_AP', 
                   'CREATE_AR', 'PAY_AP', 'RECEIVE_AR'] 
    };
  }

  // Engenharia - apenas criar despesas
  if (perfil === 'engenharia') {
    if (acao === 'CREATE_EXPENSE') {
      return { allowed: true, permissoes: ['CREATE_EXPENSE'] };
    }
    return { allowed: false };
  }

  // Compras - criar despesas e contas a pagar
  if (perfil === 'compras') {
    if (['CREATE_EXPENSE', 'CREATE_AP'].includes(acao)) {
      return { allowed: true, permissoes: ['CREATE_EXPENSE', 'CREATE_AP'] };
    }
    return { allowed: false };
  }

  // Campo - apenas criar despesas simples
  if (perfil === 'campo') {
    if (acao === 'CREATE_EXPENSE') {
      return { allowed: true, permissoes: ['CREATE_EXPENSE'] };
    }
    return { allowed: false };
  }

  // Demais perfis - bloqueados
  return { allowed: false };
}

function getCamposObrigatoriosV2(acao) {
  const campos = {
    'CREATE_EXPENSE': ['valor', 'categoria', 'descricao'],
    'CREATE_INCOME': ['valor', 'descricao'],
    'CREATE_AP': ['valor', 'descricao', 'data_vencimento', 'fornecedor_cliente'],
    'CREATE_AR': ['valor', 'descricao', 'data_vencimento', 'fornecedor_cliente'],
    'PAY_AP': ['conta_id'],
    'RECEIVE_AR': ['conta_id'],
    'EDIT_RECORD': ['registro_id'],
    'DELETE_RECORD': ['registro_id']
  };
  
  return campos[acao] || [];
}
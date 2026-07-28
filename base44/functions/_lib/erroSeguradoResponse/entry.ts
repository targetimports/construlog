/**
 * PADRÃO DE ERRO: resposta padronizada, segura, sem expor stacks.
 * 
 * Uso:
 *   return erroSeguro('OBRA_REQUIRED', 'Selecione uma obra');
 *   return erroSeguro('VALIDACAO', 'Campo inválido', 400, 'email não é válido');
 */

const CODIGOS_ERRO = {
  // Validação
  'OBRA_REQUIRED': { status: 400, default: 'Selecione uma obra antes de continuar' },
  'OBRA_INVALIDA': { status: 400, default: 'Obra não encontrada ou sem permissão' },
  'VALIDACAO': { status: 400, default: 'Dados inválidos' },
  'CAMPO_OBRIGATORIO': { status: 400, default: 'Campo obrigatório não preenchido' },
  
  // Autorização
  'NAO_AUTORIZADO': { status: 401, default: 'Você precisa fazer login' },
  'SEM_PERMISSAO': { status: 403, default: 'Você não tem permissão para esta ação' },
  'ADMIN_REQUIRED': { status: 403, default: 'Apenas administradores podem fazer isso' },
  
  // Negócio
  'ALCADA_INSUFICIENTE': { status: 402, default: 'Valor acima da sua alçada de aprovação' },
  'SALDO_INSUFICIENTE': { status: 402, default: 'Saldo insuficiente' },
  'RECURSO_NAO_ENCONTRADO': { status: 404, default: 'Recurso não encontrado' },
  'ESTADO_INVALIDO': { status: 409, default: 'Operação não permitida neste estado' },
  'CONFLITO_DADOS': { status: 409, default: 'Há conflito com dados existentes' },
  
  // Integrações
  'INTEGRACAO_FALHOU': { status: 502, default: 'Erro ao comunicar com sistema externo' },
  'TIMEOUT': { status: 504, default: 'Operação demorou muito, tente novamente' },
  
  // Genérico (DEFAULT)
  'ERRO_INTERNO': { status: 500, default: 'Algo deu errado. Tente novamente.' }
};

function erroSeguro(codigo, mensagem, statusCustom, detalhes) {
  const config = CODIGOS_ERRO[codigo] || CODIGOS_ERRO['ERRO_INTERNO'];
  const status = statusCustom || config.status;
  const msg = mensagem || config.default;
  
  const response = {
    ok: false,
    code: codigo,
    message: msg,
    timestamp: new Date().toISOString()
  };
  
  if (detalhes) {
    response.details = detalhes;
  }
  
  return {
    body: response,
    status
  };
}

/**
 * Validação simplificada
 */
function validar(condicao, codigo, mensagem) {
  if (!condicao) {
    throw erroSeguro(codigo, mensagem);
  }
}

/**
 * Resposta de sucesso padronizada
 */
function sucesso(dados, mensagem = 'Operação realizada com sucesso') {
  return {
    ok: true,
    message: mensagem,
    data: dados,
    timestamp: new Date().toISOString()
  };
}

export { erroSeguro, validar, sucesso, CODIGOS_ERRO };
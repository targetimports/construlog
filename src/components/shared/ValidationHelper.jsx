export const ValidationHelper = {
  // Valida se valor é positivo
  isPositive: (value) => {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
  },

  // Valida se valor não é zero
  isNotZero: (value) => {
    const num = parseFloat(value);
    return !isNaN(num) && num !== 0;
  },

  // Valida se composição pode ser editada
  canEditComposicao: (composicao, usosEmOrcamentos = []) => {
    if (composicao.bloqueado) {
      return { canEdit: false, reason: 'Composição bloqueada para edição' };
    }

    const orcamentosAprovados = usosEmOrcamentos.filter(o => o.status === 'aprovado');
    if (orcamentosAprovados.length > 0) {
      return { 
        canEdit: false, 
        reason: `Esta composição está sendo usada em ${orcamentosAprovados.length} orçamento(s) aprovado(s)` 
      };
    }

    return { canEdit: true };
  },

  // Valida se insumo pode ser editado
  canEditInsumo: (insumo, usosEmComposicoes = []) => {
    if (usosEmComposicoes.length > 10) {
      return { 
        canEdit: true, 
        warning: `Este insumo é usado em ${usosEmComposicoes.length} composições. Atualizar o preço recalculará todas elas.` 
      };
    }

    return { canEdit: true };
  },

  // Valida código único
  isUniqueCode: (code, existingCodes) => {
    return !existingCodes.includes(code);
  },

  // Valida intervalo de datas
  isValidDateRange: (startDate, endDate) => {
    if (!startDate || !endDate) return true;
    return new Date(startDate) <= new Date(endDate);
  },

  // Valida percentual (0-100)
  isValidPercentage: (value) => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 && num <= 100;
  },

  // Mensagens de erro padrão
  errors: {
    required: 'Este campo é obrigatório',
    positive: 'O valor deve ser maior que zero',
    notZero: 'O valor não pode ser zero',
    uniqueCode: 'Este código já existe',
    invalidDate: 'Data inválida',
    invalidDateRange: 'A data final deve ser maior que a inicial',
    invalidPercentage: 'O percentual deve estar entre 0 e 100',
    blocked: 'Este item está bloqueado para edição'
  }
};
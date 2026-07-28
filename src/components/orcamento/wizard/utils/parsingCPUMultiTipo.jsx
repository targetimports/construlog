/**
 * Utilities for parsing CPU files with multi-type support
 * Supports: Material, Mão de Obra, Equipamento, Serviço, Mobilização, Encargos, BDI, Others
 */

// Mapeamento de tipos normalizados
export const TIPO_NORMALIZED = {
  MATERIAL: 'material',
  MAO_DE_OBRA: 'mao_de_obra',
  EQUIPAMENTO: 'equipamento',
  SERVICO: 'servico',
  MOBILIZACAO: 'mobilizacao',
  ENCARGOS: 'encargos',
  BDI: 'bdi',
  SEM_TIPO: 'sem_tipo',
  OUTROS: 'outros'
};

// Labels para UI
export const TIPO_LABELS = {
  [TIPO_NORMALIZED.MATERIAL]: 'Materiais',
  [TIPO_NORMALIZED.MAO_DE_OBRA]: 'Mão de Obra',
  [TIPO_NORMALIZED.EQUIPAMENTO]: 'Equipamentos',
  [TIPO_NORMALIZED.SERVICO]: 'Serviços',
  [TIPO_NORMALIZED.MOBILIZACAO]: 'Mobilização',
  [TIPO_NORMALIZED.ENCARGOS]: 'Encargos',
  [TIPO_NORMALIZED.BDI]: 'BDI',
  [TIPO_NORMALIZED.SEM_TIPO]: 'Sem Tipo',
  [TIPO_NORMALIZED.OUTROS]: 'Outros'
};

/**
 * Normaliza string de tipo para uma categoria conhecida
 * @param {string} tipoRaw - tipo bruto do arquivo
 * @returns {object} { tipoNormalizado, tipoOriginal }
 */
export function normalizarTipo(tipoRaw) {
  if (!tipoRaw) {
    return {
      tipoNormalizado: TIPO_NORMALIZED.SEM_TIPO,
      tipoOriginal: ''
    };
  }

  const tipo = (tipoRaw || '').trim().toLowerCase();

  if (!tipo) {
    return {
      tipoNormalizado: TIPO_NORMALIZED.SEM_TIPO,
      tipoOriginal: tipoRaw
    };
  }

  // Mapeamentos diretos
  if (tipo === 'material') {
    return { tipoNormalizado: TIPO_NORMALIZED.MATERIAL, tipoOriginal: tipoRaw };
  }
  if (['mão de obra', 'mao de obra', 'mo', 'mão-de-obra'].includes(tipo)) {
    return { tipoNormalizado: TIPO_NORMALIZED.MAO_DE_OBRA, tipoOriginal: tipoRaw };
  }
  if (['equipamento', 'equipamentos'].includes(tipo)) {
    return { tipoNormalizado: TIPO_NORMALIZED.EQUIPAMENTO, tipoOriginal: tipoRaw };
  }
  if (['serviço', 'servicos', 'serviço terceirizado', 'serviços'].includes(tipo)) {
    return { tipoNormalizado: TIPO_NORMALIZED.SERVICO, tipoOriginal: tipoRaw };
  }
  if (['mobilização', 'instalações provisórias', 'desmobilização'].includes(tipo)) {
    return { tipoNormalizado: TIPO_NORMALIZED.MOBILIZACAO, tipoOriginal: tipoRaw };
  }
  if (['encargos', 'encargos complementares'].includes(tipo)) {
    return { tipoNormalizado: TIPO_NORMALIZED.ENCARGOS, tipoOriginal: tipoRaw };
  }
  if (tipo === 'bdi') {
    return { tipoNormalizado: TIPO_NORMALIZED.BDI, tipoOriginal: tipoRaw };
  }

  // Fallback: OUTROS
  return {
    tipoNormalizado: TIPO_NORMALIZED.OUTROS,
    tipoOriginal: tipoRaw
  };
}

/**
 * Converte string de valor pt-BR para número
 * @param {string|number} valor - "1.234,56" ou 1234.56
 * @returns {number}
 */
export function converterValorBR(valor) {
  if (!valor && valor !== 0) return 0;
  if (typeof valor === 'number') return valor;

  const str = String(valor).trim();
  if (!str) return 0;

  // Remover espaços e separadores de milhar, trocar vírgula por ponto
  const numStr = str
    .replace(/\./g, '') // Remove pontos (separador de milhar)
    .replace(/,/g, '.'); // Troca vírgula por ponto

  const num = parseFloat(numStr);
  return isNaN(num) ? 0 : num;
}

/**
 * Detecta se uma linha é um cabeçalho repetido
 * @param {object} linha - objeto com os campos
 * @returns {boolean}
 */
export function ehCabecalho(linha) {
  const { descricao, tipo, und } = linha;
  const desc = (descricao || '').toLowerCase().trim();
  const t = (tipo || '').toLowerCase().trim();
  const u = (und || '').toLowerCase().trim();

  // Detectar linhas de cabeçalho conhecidas
  const cabecalhos = ['descrição', 'description', 'tipo', 'type', 'und', 'unit', 'quantidade', 'quantity', 'valor unit', 'valor unitário'];
  
  return [desc, t, u].some(field => cabecalhos.includes(field));
}

/**
 * Detecta se uma linha é vazia/inválida
 * @param {object} linha
 * @returns {boolean}
 */
export function ehLinhaVazia(linha) {
  const { descricao, quantidade, valor_unit, total } = linha;
  const desc = (descricao || '').trim();

  // Se descrição vazia
  if (!desc) return true;

  // Se sem valores numéricos
  const quant = converterValorBR(quantidade);
  const valor = converterValorBR(valor_unit);
  const tot = converterValorBR(total);

  return quant === 0 && valor === 0 && tot === 0;
}

/**
 * Processa array de linhas do CPU e retorna itens válidos
 * @param {array} linhas - linhas do arquivo
 * @param {string} origem - "CPU", "MANUAL", etc
 * @returns {array} itens processados
 */
export function processarLinhasCPU(linhas, origem = 'CPU') {
  if (!Array.isArray(linhas)) return [];

  const itens = [];
  let idCounter = 0;

  linhas.forEach((linha, idx) => {
    // Pular cabeçalhos e linhas vazias
    if (ehCabecalho(linha) || ehLinhaVazia(linha)) {
      return;
    }

    const quantidade = converterValorBR(linha.quantidade);
    const valorUnit = converterValorBR(linha.valor_unit);
    const total = converterValorBR(linha.total) || (quantidade * valorUnit);

    const { tipoNormalizado, tipoOriginal } = normalizarTipo(linha.tipo);

    const item = {
      idTemp: `temp_${idCounter++}`,
      descricao: (linha.descricao || '').trim(),
      tipoNormalizado,
      tipoOriginal,
      und: (linha.und || 'un').trim(),
      quantidade,
      valorUnit,
      total,
      codigo: linha.codigo || '',
      banco: linha.banco || '',
      origem
    };

    itens.push(item);
  });

  return itens;
}

/**
 * Agrupa itens por tipoNormalizado
 * @param {array} itens
 * @returns {object} { [tipoNormalizado]: [itens] }
 */
export function agruparPorTipo(itens) {
  const grupos = {};

  itens.forEach(item => {
    if (!grupos[item.tipoNormalizado]) {
      grupos[item.tipoNormalizado] = [];
    }
    grupos[item.tipoNormalizado].push(item);
  });

  return grupos;
}

/**
 * Calcula totais por tipo
 * @param {array} itens
 * @returns {object} { [tipoNormalizado]: { qtd, total } }
 */
export function calcularTotaisPorTipo(itens) {
  const totais = {};

  Object.values(TIPO_NORMALIZED).forEach(tipo => {
    totais[tipo] = { qtd: 0, total: 0 };
  });

  itens.forEach(item => {
    if (totais[item.tipoNormalizado]) {
      totais[item.tipoNormalizado].qtd += 1;
      totais[item.tipoNormalizado].total += item.total;
    }
  });

  return totais;
}

/**
 * Formata número para formato pt-BR
 * @param {number} valor
 * @returns {string}
 */
export function formatarValorBR(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

/**
 * Filtra itens por tipo
 * @param {array} itens
 * @param {string} tipoNormalizado
 * @returns {array}
 */
export function filtrarPorTipo(itens, tipoNormalizado) {
  if (tipoNormalizado === 'todos') return itens;
  return itens.filter(i => i.tipoNormalizado === tipoNormalizado);
}
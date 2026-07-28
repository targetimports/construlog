/**
 * Schema de completude de obra.
 * ESSENCIAIS: se faltarem → banner aparece, modal alerta em vermelho
 * RECOMENDADOS: contam no % mas não bloqueiam
 */

/**
 * Verifica se um valor de campo está realmente preenchido.
 * Considera pendente: null, undefined, "", " ", "0", 0, "null", "undefined", false
 */
function isFilled(v) {
  if (v === null || v === undefined || v === false) return false;
  const s = String(v).trim();
  return s.length > 0 && s !== '0' && s !== 'null' && s !== 'undefined' && s !== 'false';
}

const isMongoId = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v.trim());

export const CAMPOS_ESSENCIAIS = [
  {
    key: 'cliente_id',
    label: 'Cliente / Contratante',
    nivel: 'essencial',
    check: (obra) => {
      // Preferência: cliente_id preenchido (campo oficial)
      if (isFilled(obra.cliente_id)) return true;
      // Fallback: campo legado "cliente" contendo um nome (não um ID bruto)
      if (typeof obra.cliente === 'string' && isFilled(obra.cliente) && !isMongoId(obra.cliente)) return true;
      return false;
    },
  },
  {
    key: 'responsavel_tecnico',
    label: 'Responsável Técnico',
    nivel: 'essencial',
    // Salvo como string (nome do usuário)
    check: (obra) => isFilled(obra.responsavel_tecnico),
  },
  {
    key: 'responsavel_obra',
    label: 'Responsável da Obra',
    nivel: 'essencial',
    // Salvo como string (nome do usuário)
    check: (obra) => isFilled(obra.responsavel_obra),
  },
  {
    key: 'data_inicio',
    label: 'Data de Início',
    nivel: 'essencial',
    check: (obra) => isFilled(obra.data_inicio),
  },
  {
    key: 'data_prevista_fim',
    label: 'Data de Término Previsto',
    nivel: 'essencial',
    check: (obra) => isFilled(obra.data_prevista_fim),
  },
];

export const CAMPOS_RECOMENDADOS = [
  {
    key: 'endereco',
    label: 'Endereço',
    nivel: 'recomendado',
    check: (obra) => !!(obra.endereco && obra.cidade),
  },
  {
    key: 'tipo_obra',
    label: 'Tipo de Obra',
    nivel: 'recomendado',
    check: (obra) => !!(obra.tipo_obra || obra.tipo_intervencao),
  },
  {
    key: 'centro_custo',
    label: 'Centro de Custo',
    nivel: 'recomendado',
    check: (obra) => !!(obra.centro_custo_codigo || obra.centro_custo_nome),
  },
  {
    key: 'categoria_dre',
    label: 'Categoria DRE',
    nivel: 'recomendado',
    check: (obra) => !!(obra.categoria_dre && obra.categoria_dre !== 'OUTRO'),
  },
];

const TODOS_CAMPOS = [...CAMPOS_ESSENCIAIS, ...CAMPOS_RECOMENDADOS];

export function calcularCompletude(obra) {
  if (!obra) {
    return {
      percent: 0,
      pendencias: TODOS_CAMPOS,
      pendencias_count: TODOS_CAMPOS.length,
      missingEssential: CAMPOS_ESSENCIAIS,
      missingRecommended: CAMPOS_RECOMENDADOS,
      filled: [],
      completa: false,
    };
  }

  const missingEssential = CAMPOS_ESSENCIAIS.filter(c => !c.check(obra));
  const missingRecommended = CAMPOS_RECOMENDADOS.filter(c => !c.check(obra));
  const filled = TODOS_CAMPOS.filter(c => c.check(obra));

  const total = TODOS_CAMPOS.length;
  const preenchidos = filled.length;
  const percent = Math.round((preenchidos / total) * 100);

  // Compat: pendencias antigas (para BannerPendenciasObra que usa obrigatorias_pendentes)
  const pendencias = [...missingEssential, ...missingRecommended];

  return {
    percent,
    pendencias,
    pendencias_count: pendencias.length,
    missingEssential,
    missingRecommended,
    filled,
    obrigatorias_pendentes: missingEssential,
    recomendadas_pendentes: missingRecommended,
    completa: missingEssential.length === 0,
  };
}

/**
 * Tenta inferir datas de início/fim a partir de itens de cronograma e marcos.
 */
export function inferirDatasDosCronogramas(cronogramaItems = [], marcos = []) {
  const todasDatas = [];

  cronogramaItems.forEach(item => {
    if (item.data_inicio) todasDatas.push({ tipo: 'inicio', data: new Date(item.data_inicio) });
    if (item.data_fim) todasDatas.push({ tipo: 'fim', data: new Date(item.data_fim) });
    if (item.data_prevista_inicio) todasDatas.push({ tipo: 'inicio', data: new Date(item.data_prevista_inicio) });
    if (item.data_prevista_fim) todasDatas.push({ tipo: 'fim', data: new Date(item.data_prevista_fim) });
  });

  marcos.forEach(marco => {
    if (marco.data_prevista) todasDatas.push({ tipo: 'fim', data: new Date(marco.data_prevista) });
    if (marco.data_inicio) todasDatas.push({ tipo: 'inicio', data: new Date(marco.data_inicio) });
  });

  const datasValidas = todasDatas.filter(d => d.data && !isNaN(d.data));
  if (datasValidas.length === 0) return null;

  const inicios = datasValidas.filter(d => d.tipo === 'inicio').map(d => d.data);
  const fins = datasValidas.filter(d => d.tipo === 'fim').map(d => d.data);

  const minInicio = inicios.length > 0 ? new Date(Math.min(...inicios)) : null;
  const maxFim = fins.length > 0 ? new Date(Math.max(...fins)) : null;

  return {
    data_inicio: minInicio ? minInicio.toISOString().split('T')[0] : null,
    data_prevista_fim: maxFim ? maxFim.toISOString().split('T')[0] : null,
  };
}
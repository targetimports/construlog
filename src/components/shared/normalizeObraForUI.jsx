/**
 * Detect Mongo-like 24-char hex IDs so we never display them as names.
 */
const isMongoId = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v.trim());

/**
 * Normalizar um registro bruto da Obra para um objeto consistente
 * que UI (card, modal, revisão final) possa ler sem conflitos.
 *
 * REGRA HARD:
 *   - cliente_nome → sempre nome/razão social (NUNCA um ID)
 *   - cliente_id   → sempre o ID hex
 */
export function normalizeObraForUI(obra) {
  if (!obra) return null;

  // --- Cliente: resolver corretamente ---
  const rawClienteField = obra.cliente;          // campo legado (pode ser ID ou nome)
  const rawClienteNome  = obra.cliente_nome;     // campo correto (deve ser nome)
  const rawClienteId    = obra.cliente_id;       // campo correto (deve ser ID)

  // cliente_id: pegar do campo correto, ou do legado se parecer ID
  const clienteId =
    rawClienteId ||
    (isMongoId(rawClienteField) ? rawClienteField : '') ||
    '';

  // cliente_nome: nunca armazenar ID aqui
  // Ordem de prioridade: cliente_nome > cliente (se não for ID) > vazio
  let clienteNome = '';
  if (rawClienteNome && !isMongoId(rawClienteNome)) {
    clienteNome = rawClienteNome;
  } else if (rawClienteField && !isMongoId(rawClienteField)) {
    clienteNome = rawClienteField;
  }

  // Log de diagnóstico se detectar ID em lugar errado
  if (isMongoId(rawClienteNome)) {
    console.warn(`[normalizeObraForUI] obra "${obra.nome}" tem cliente_nome como ID bruto: ${rawClienteNome}`);
  }

  return {
    // Identidade
    id: obra.id,
    created_date: obra.created_date,
    updated_date: obra.updated_date,

    // Informações básicas
    nome: obra.nome || obra.titulo || '',
    descricao: obra.descricao || '',
    codigo: obra.codigo || '',

    // Fase e status
    fase: obra.fase || '',
    status: obra.status || obra.status_inicial || '',
    status_inicial: obra.status_inicial || obra.status || '',

    // Cliente (corrigido)
    cliente_id: clienteId,
    cliente_nome: clienteNome,

    // Responsáveis
    responsavel_tecnico: obra.responsavel_tecnico || '',
    responsavel_tecnico_id: obra.responsavel_tecnico_id || '',
    responsavel_obra: obra.responsavel_obra || '',
    responsavel_obra_id: obra.responsavel_obra_id || '',
    responsavel_administrativo: obra.responsavel_administrativo || '',
    responsavel_financeiro: obra.responsavel_financeiro || '',

    // Localização — suporta todas as variações de nome de campo
    cep: obra.cep || '',
    logradouro: obra.logradouro || obra.rua || obra.endereco || '',
    rua: obra.rua || obra.logradouro || '',
    numero: obra.numero || '',
    bairro: obra.bairro || '',
    cidade: obra.cidade || obra.cidade_nome || '',
    uf: obra.uf || obra.estado || '',
    estado: obra.estado || obra.uf || '',
    complemento: obra.complemento || '',

    // Tipos e categorias
    tipo: obra.tipo || '',
    categoria_dre: obra.categoria_dre || '',
    tipo_estrutural: obra.tipo_estrutural || '',
    tipo_intervencao: obra.tipo_intervencao || '',

    // Centro de custo
    centro_custo_codigo: obra.centro_custo_codigo || '',
    centro_custo_nome: obra.centro_custo_nome || '',

    // Datas
    data_inicio: obra.data_inicio || obra.inicio_estimado || '',
    data_fim_previsto: obra.data_fim_previsto || obra.data_prevista_fim || obra.termino_estimado || '',
    data_prevista_fim: obra.data_prevista_fim || obra.data_fim_previsto || '',
    data_conclusao: obra.data_conclusao || '',

    // Financeiro snapshot
    total_orcamento: obra.total_orcamento || obra.valor_orcado || 0,
    valor_orcado: obra.valor_orcado || obra.total_orcamento || 0,
    valor_contrato: obra.valor_contrato || 0,

    // Flags importação
    importada_orca_facil: obra.importada_orca_facil || false,
    importada_orca_facil_em: obra.importada_orca_facil_em || '',
  };
}

/**
 * Extrair os campos importantes para validação/checklist
 */
export function getObraChecklist(obra) {
  const normalized = normalizeObraForUI(obra);
  if (!normalized) return { complete: false, missing: [] };

  const required = [
    'nome',
    'cliente_id',
    'cidade',
    'uf',
    'categoria_dre',
    'tipo_estrutural',
    'tipo_intervencao',
  ];

  const missing = required.filter(field => !normalized[field]);
  const complete = missing.length === 0;

  return {
    complete,
    missing,
    filled: required.filter(field => normalized[field]),
  };
}
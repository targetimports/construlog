// Catálogo de chaves de ConfiguracaoSistema que o sistema realmente entende.
//
// A tela /ConfiguracoesSistema usa este catálogo para oferecer SELEÇÃO GUIADA
// em vez de campo de texto livre: o admin escolhe a regra de uma lista curada e
// só preenche o valor, no formato certo. Os nomes de chave são literais e batem
// exatamente com o `filter({ chave })` espalhado pelo código — NÃO renomeie sem
// alterar o consumidor correspondente (veja "ref" em cada item).
//
// Aqui ficam só as REGRAS DE NEGÓCIO (Grupo 1). Chaves de OPS/infra e estado
// interno (ops_outbox_*, system_mode, etc.) ficam de fora de propósito: são
// perigosas de editar à mão e têm setters próprios. Para elas, use o modo
// avançado/manual da tela.
//
// Campos de cada item:
//   chave      - nome literal da chave (igual ao código)
//   label      - rótulo legível para humanos
//   tipo       - texto | numero | boolean | json (como o consumidor interpreta)
//   categoria  - categoria do registro (uma de CATEGORIAS na página)
//   padrao     - valor de fallback usado quando a chave NÃO existe (string)
//   modulo     - área funcional, só para exibição/agrupamento
//   descricao  - o que muda no sistema ao alterar
//   formato    - dica de como digitar o valor
//   opcoes     - (opcional) [{value,label}] -> renderiza seleção em vez de input livre
//   nota       - (opcional) aviso extra (ex.: também editável em outra tela)

export const CONFIG_CATALOG = [
  {
    chave: 'perfil_padrao_novos_usuarios',
    label: 'Perfil padrão de novos usuários',
    tipo: 'texto',
    categoria: 'geral',
    padrao: 'campo',
    modulo: 'Usuários',
    descricao: 'Perfil de acesso atribuído automaticamente a cada novo usuário criado.',
    formato: 'Selecione um perfil da lista.',
    opcoes: [
      { value: 'campo', label: 'Campo' },
      { value: 'engenharia', label: 'Engenharia' },
      { value: 'compras', label: 'Compras' },
      { value: 'almoxarifado', label: 'Almoxarifado' },
      { value: 'logistica', label: 'Logística' },
      { value: 'financeiro', label: 'Financeiro' },
      { value: 'admin_empresa', label: 'Admin da Empresa' },
    ],
    nota: 'Também editável em Gestão de Usuários › Perfis & Padrões (gravam a mesma chave).',
    ref: 'aplicarPerfilAutomaticoNovoUsuario',
  },
  {
    chave: 'financeiro_threshold_n1',
    label: 'Teto de auto-aprovação — Contas a pagar (R$)',
    tipo: 'numero',
    categoria: 'financeiro',
    padrao: '5000',
    modulo: 'Financeiro',
    descricao: 'Contas a pagar até este valor são liberadas direto; acima, exigem aprovação N1.',
    formato: 'Número em reais, sem "R$" nem separador de milhar. Ex.: 5000',
    ref: 'solicitarAprovacaoPagamento',
  },
  {
    chave: 'compras_threshold_n1',
    label: 'Teto de auto-aprovação — Ordens de compra (R$)',
    tipo: 'numero',
    categoria: 'financeiro',
    padrao: '5000',
    modulo: 'Compras',
    descricao: 'Ordens de compra até este valor são aprovadas direto; acima, exigem aprovação N1.',
    formato: 'Número em reais, sem "R$" nem separador de milhar. Ex.: 5000',
    ref: 'aprovarOrdemCompra',
  },
  {
    chave: 'modo_validacao_inicio_obra',
    label: 'Modo de validação ao iniciar obra',
    tipo: 'texto',
    categoria: 'obras',
    padrao: 'flexível',
    modulo: 'Obras',
    descricao: '"Rigoroso" bloqueia o início da obra quando falta um pré-requisito; "Flexível" apenas alerta e deixa seguir.',
    formato: 'Selecione o modo.',
    opcoes: [
      { value: 'rigoroso', label: 'Rigoroso — bloqueia' },
      { value: 'flexível', label: 'Flexível — só alerta' },
    ],
    ref: 'validarInicioObra',
  },
  {
    chave: 'alerta_desvio_alto',
    label: 'Alerta de desvio orçamentário — Alto (%)',
    tipo: 'numero',
    categoria: 'financeiro',
    padrao: '15',
    modulo: 'Alertas Executivos',
    descricao: 'Percentual de desvio do orçamento que dispara um alerta de severidade "Alto".',
    formato: 'Percentual (só o número). Ex.: 15',
    ref: 'getAlertasExecutivos',
  },
  {
    chave: 'alerta_desvio_critico',
    label: 'Alerta de desvio orçamentário — Crítico (%)',
    tipo: 'numero',
    categoria: 'financeiro',
    padrao: '30',
    modulo: 'Alertas Executivos',
    descricao: 'Percentual de desvio do orçamento que dispara um alerta de severidade "Crítico".',
    formato: 'Percentual (só o número). Ex.: 30',
    ref: 'getAlertasExecutivos',
  },
  {
    chave: 'alerta_dias_atraso_oc',
    label: 'Alerta de OC sem recebimento (dias)',
    tipo: 'numero',
    categoria: 'financeiro',
    padrao: '7',
    modulo: 'Alertas Executivos',
    descricao: 'Dias de atraso de uma Ordem de Compra sem recebimento até gerar alerta.',
    formato: 'Número de dias. Ex.: 7',
    ref: 'getAlertasExecutivos',
  },
  {
    chave: 'vistoria_checklist_items',
    label: 'Itens do checklist de vistoria',
    tipo: 'json',
    categoria: 'frota',
    padrao: JSON.stringify([
      { item_nome: 'Pneus', status: 'OK', observacao: '' },
      { item_nome: 'Óleo/Fluidos', status: 'OK', observacao: '' },
      { item_nome: 'Faróis/Lanternas', status: 'OK', observacao: '' },
      { item_nome: 'Kit de Segurança', status: 'OK', observacao: '' },
      { item_nome: 'Documentação', status: 'OK', observacao: '' },
      { item_nome: 'Avarias/Danos', status: 'OK', observacao: '' },
      { item_nome: 'Limpeza Interna', status: 'OK', observacao: '' },
    ], null, 2),
    modulo: 'Frota',
    descricao: 'Lista de itens que aparecem no checklist ao abrir uma vistoria de veículo.',
    formato: 'Lista JSON de itens. Ex.: [{"item_nome":"Pneus","status":"OK","observacao":""}]',
    ref: 'FormVistoria',
  },
];

export const catalogoPorChave = (chave) => CONFIG_CATALOG.find((c) => c.chave === chave) || null;

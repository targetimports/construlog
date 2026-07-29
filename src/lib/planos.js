// TABELA DE PLANOS — fonte única.
//
// A landing mostra estes valores para o visitante e o painel os usa para sugerir
// a mensalidade ao cadastrar um cliente. Mantidos aqui para que preço de vitrine
// e preço cobrado não sigam caminhos diferentes.
//
// `valor` é o preço de tabela em reais; null = sob consulta (negociado caso a caso).
export const PLANOS = [
  {
    nome: 'Essencial',
    valor: 490,
    preco: 'R$ 490',
    periodo: '/mês',
    resumo: 'Para quem toca até 3 obras e quer sair da planilha.',
    itens: [
      'Até 3 obras ativas',
      'Até 10 usuários',
      'Orçamento, medição e diário de obra',
      'Financeiro por obra',
      'Suporte por e-mail',
    ],
    destaque: false,
    cta: 'Começar',
  },
  {
    nome: 'Construtora',
    valor: 1290,
    preco: 'R$ 1.290',
    periodo: '/mês',
    resumo: 'Para quem gerencia várias obras e precisa de visão consolidada.',
    itens: [
      'Obras ilimitadas',
      'Até 40 usuários',
      'Tudo do Essencial',
      'Suprimentos, estoque e frota',
      'Multi-empresa e DRE consolidada',
      'Suporte prioritário no WhatsApp',
    ],
    destaque: true,
    cta: 'Falar com especialista',
  },
  {
    nome: 'Corporativo',
    valor: null,
    preco: 'Sob consulta',
    periodo: '',
    resumo: 'Para grupos com várias empresas, integrações e regras próprias.',
    itens: [
      'Usuários ilimitados',
      'Tudo do Construtora',
      'Integrações e importações sob medida',
      'Ambiente dedicado',
      'Treinamento da equipe',
    ],
    destaque: false,
    cta: 'Fale conosco',
  },
];

/** Preço de tabela do plano, ou null quando é sob consulta. */
export const valorDoPlano = (nome) => PLANOS.find((p) => p.nome === nome)?.valor ?? null;

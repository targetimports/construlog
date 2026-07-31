// CLIENTE HTTP DA ASAAS — a única parte que conhece o formato da API deles.
//
// Fica isolado de propósito: o resto do sistema fala com `pagamentos/index.js`
// em português e com os nossos nomes de campo. Se um dia trocar de provedor
// (ou a Asaas mudar a rota), o estrago para aqui.
//
// Configuração (.env):
//   ASAAS_API_KEY=$aact_...           chave da conta (produção ou sandbox)
//   ASAAS_AMBIENTE=sandbox|producao   default: sandbox — mais seguro errar aqui
//   ASAAS_WEBHOOK_TOKEN=...           segredo que valida os avisos recebidos
//
// ⚠️ CONFERIR NA DOCUMENTAÇÃO ANTES DE LIGAR EM PRODUÇÃO: rotas, nomes de campo e
// nomes de evento abaixo foram escritos a partir da API v3 e podem ter mudado.
// Este arquivo é o esqueleto — validar contra a doc oficial e testar no sandbox.

const BASES = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  producao: 'https://api.asaas.com/v3',
};

const TIMEOUT_MS = 20_000;

// A configuração vem da tela Sistema › Integrações externas (com o .env vencendo,
// quando definido lá). Fica em cache porque é lida a cada chamada da API e ir ao
// banco toda vez seria desperdício; `recarregarAsaas()` derruba o cache quando a
// tela salva algo, para a mudança valer na hora e não no próximo restart.
let cache = null;

export async function carregarAsaas() {
  const { configDe } = await import('../integracoesExternas.js');
  const cfg = await configDe('asaas');
  cache = {
    chave: cfg?.valores?.api_key || '',
    ambiente: cfg?.valores?.ambiente === 'producao' ? 'producao' : 'sandbox',
    webhookToken: cfg?.valores?.webhook_token || '',
    ativo: !!cfg?.ativo,
  };
  return cache;
}

export const recarregarAsaas = () => { cache = null; };

/** Leitura síncrona do cache — usada nos caminhos que não podem esperar I/O. */
export const configAsaas = () => cache || {
  chave: process.env.ASAAS_API_KEY || '',
  ambiente: process.env.ASAAS_AMBIENTE === 'producao' ? 'producao' : 'sandbox',
  webhookToken: process.env.ASAAS_WEBHOOK_TOKEN || '',
  ativo: true,
};

/** Está configurada e ligada? Sem isso, o sistema opera no modo manual de hoje. */
export const asaasAtiva = () => {
  const c = configAsaas();
  return !!c.chave && c.ativo !== false;
};

/**
 * Chamada crua à API. Devolve o corpo já em objeto e levanta erro com a
 * mensagem que a Asaas mandou — o retorno de erro deles vem em `errors[]`, e
 * perder isso transformaria "CPF inválido" num genérico "falhou".
 */
async function chamar(metodo, caminho, corpo) {
  const { chave, ambiente } = cache || await carregarAsaas();
  if (!chave) throw new Error('Asaas não configurada — configure em Sistema › Integrações externas.');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const r = await fetch(`${BASES[ambiente]}${caminho}`, {
      method: metodo,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        access_token: chave,
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });

    const texto = await r.text();
    const dados = texto ? JSON.parse(texto) : {};

    if (!r.ok) {
      const detalhe = dados?.errors?.map((e) => e.description).filter(Boolean).join('; ');
      throw new Error(detalhe || `Asaas respondeu ${r.status}`);
    }
    return dados;
  } finally {
    clearTimeout(timer);
  }
}

// --- Clientes -------------------------------------------------------------

export const criarClienteAsaas = ({ nome, cpfCnpj, email, telefone, referenciaExterna }) =>
  chamar('POST', '/customers', {
    name: nome,
    cpfCnpj: String(cpfCnpj || '').replace(/\D/g, ''),
    email: email || undefined,
    mobilePhone: String(telefone || '').replace(/\D/g, '') || undefined,
    externalReference: referenciaExterna || undefined,
  });

export const buscarClienteAsaas = (id) => chamar('GET', `/customers/${id}`);

// --- Cobranças ------------------------------------------------------------

// Nossa forma de pagamento → a deles. UNDEFINED deixa o cliente escolher no
// link de pagamento (boleto, Pix ou cartão).
const TIPOS = {
  boleto: 'BOLETO',
  pix: 'PIX',
  cartao: 'CREDIT_CARD',
  qualquer: 'UNDEFINED',
};

/**
 * Cria a cobrança. `referenciaExterna` recebe o id da nossa Cobranca — é o que
 * permite casar o webhook de volta com o registro certo sem depender de valor
 * ou data, que se repetem entre clientes.
 */
export const criarCobrancaAsaas = ({
  clienteAsaasId, valor, vencimento, descricao, referenciaExterna, forma = 'qualquer', multa, juros,
}) =>
  chamar('POST', '/payments', {
    customer: clienteAsaasId,
    billingType: TIPOS[forma] || 'UNDEFINED',
    value: Number(valor),
    dueDate: String(vencimento).slice(0, 10),
    description: descricao || undefined,
    externalReference: referenciaExterna || undefined,
    fine: multa ? { value: Number(multa) } : undefined,
    interest: juros ? { value: Number(juros) } : undefined,
  });

export const buscarCobrancaAsaas = (id) => chamar('GET', `/payments/${id}`);

export const cancelarCobrancaAsaas = (id) => chamar('DELETE', `/payments/${id}`);

/** Linha digitável do boleto — só existe depois que a cobrança é registrada. */
export const linhaDigitavelAsaas = (id) => chamar('GET', `/payments/${id}/identificationField`);

/** QR Code do Pix da cobrança. */
export const pixDaCobrancaAsaas = (id) => chamar('GET', `/payments/${id}/pixQrCode`);

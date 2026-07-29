// PAGAMENTOS — a camada que o painel usa, sem saber quem é o provedor.
//
// Hoje o modo é MANUAL: as cobranças são lançadas e baixadas à mão, exatamente
// como está funcionando. Quando a Asaas for configurada (ASAAS_API_KEY), as
// mesmas funções passam a emitir cobrança de verdade e a conciliar sozinhas.
//
// O painel chama sempre daqui — nunca `asaas.js` direto. É o que permite trocar
// de provedor depois sem caçar chamadas espalhadas pelas telas.
//
// REGRA DE OURO: a Cobranca do nosso banco continua sendo a verdade do que foi
// cobrado. O provedor é meio de recebimento, não fonte de dados. Se a Asaas cair,
// o painel continua registrando e baixando à mão.

import { store } from '../entityStore.js';
import {
  asaasAtiva, configAsaas, criarClienteAsaas, criarCobrancaAsaas,
  cancelarCobrancaAsaas, buscarCobrancaAsaas, linhaDigitavelAsaas, pixDaCobrancaAsaas,
} from './asaas.js';

export const modoPagamento = () => (asaasAtiva() ? 'asaas' : 'manual');

/**
 * Garante que o cliente exista na Asaas e devolve o id de lá, guardando-o no
 * nosso ClienteSaaS para não recriar a cada cobrança (duplicaria o cadastro).
 */
export async function sincronizarCliente(clienteId) {
  if (!asaasAtiva()) return { ok: false, motivo: 'modo_manual' };

  const [cliente] = await store.filter('ClienteSaaS', { id: clienteId }, null, 1);
  if (!cliente) return { ok: false, motivo: 'cliente_nao_encontrado' };
  if (cliente.asaas_id) return { ok: true, asaas_id: cliente.asaas_id, criado: false };

  const criado = await criarClienteAsaas({
    nome: cliente.nome,
    cpfCnpj: cliente.cnpj,
    email: cliente.email,
    telefone: cliente.telefone,
    referenciaExterna: cliente.id,
  });

  await store.update('ClienteSaaS', cliente.id, { asaas_id: criado.id });
  return { ok: true, asaas_id: criado.id, criado: true };
}

/**
 * Emite no provedor uma cobrança que já existe no nosso banco.
 *
 * Emitir é separado de criar de propósito: o painel lança a cobrança (registro
 * interno) e só depois manda emitir. Assim uma falha na Asaas não impede o
 * lançamento — a cobrança fica registrada e pode ser emitida de novo depois.
 */
export async function emitirCobranca(cobrancaId, { forma = 'qualquer' } = {}) {
  if (!asaasAtiva()) return { ok: false, motivo: 'modo_manual' };

  const [cobranca] = await store.filter('Cobranca', { id: cobrancaId }, null, 1);
  if (!cobranca) return { ok: false, motivo: 'cobranca_nao_encontrada' };
  if (cobranca.asaas_id) return { ok: true, asaas_id: cobranca.asaas_id, jaEmitida: true };
  if (cobranca.status === 'pago') return { ok: false, motivo: 'ja_paga' };
  if (cobranca.status === 'cancelado') return { ok: false, motivo: 'cancelada' };

  const cli = await sincronizarCliente(cobranca.cliente_id);
  if (!cli.ok) return cli;

  const emitida = await criarCobrancaAsaas({
    clienteAsaasId: cli.asaas_id,
    valor: cobranca.valor,
    vencimento: cobranca.vencimento,
    descricao: `Construlog — mensalidade ${cobranca.competencia || ''}`.trim(),
    referenciaExterna: cobranca.id,
    forma,
  });

  await store.update('Cobranca', cobranca.id, {
    provedor: 'asaas',
    asaas_id: emitida.id,
    url_fatura: emitida.invoiceUrl || null,
    url_boleto: emitida.bankSlipUrl || null,
    emitida_em: new Date().toISOString(),
  });

  return { ok: true, asaas_id: emitida.id, url_fatura: emitida.invoiceUrl || null };
}

/** Cancela no provedor e no nosso registro. */
export async function cancelarCobranca(cobrancaId) {
  const [cobranca] = await store.filter('Cobranca', { id: cobrancaId }, null, 1);
  if (!cobranca) return { ok: false, motivo: 'cobranca_nao_encontrada' };

  if (cobranca.asaas_id && asaasAtiva()) {
    await cancelarCobrancaAsaas(cobranca.asaas_id);
  }
  await store.update('Cobranca', cobranca.id, { status: 'cancelado' });
  return { ok: true };
}

/** Boleto/Pix para mandar ao cliente. */
export async function meiosDePagamento(cobrancaId) {
  if (!asaasAtiva()) return { ok: false, motivo: 'modo_manual' };

  const [cobranca] = await store.filter('Cobranca', { id: cobrancaId }, null, 1);
  if (!cobranca?.asaas_id) return { ok: false, motivo: 'nao_emitida' };

  const [linha, pix] = await Promise.all([
    linhaDigitavelAsaas(cobranca.asaas_id).catch(() => null),
    pixDaCobrancaAsaas(cobranca.asaas_id).catch(() => null),
  ]);

  return {
    ok: true,
    url_fatura: cobranca.url_fatura || null,
    linha_digitavel: linha?.identificationField || null,
    pix_copia_e_cola: pix?.payload || null,
    pix_qrcode: pix?.encodedImage || null,
  };
}

// --- Conciliação ----------------------------------------------------------

// Eventos que nos interessam. RECEIVED = dinheiro na conta; CONFIRMED = cartão
// aprovado mas ainda não liquidado. Tratamos os dois como pago: para liberar o
// acesso do cliente, esperar a liquidação seria injusto com quem já pagou.
const EVENTOS_PAGO = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
const EVENTOS_ESTORNO = new Set(['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED']);
const EVENTOS_APAGADA = new Set(['PAYMENT_DELETED']);

/**
 * Processa um aviso do provedor. Idempotente de propósito: a Asaas reenvia o
 * mesmo evento quando não recebe 200, e dar baixa duas vezes bagunçaria o caixa.
 */
export async function processarWebhook(corpo) {
  const evento = corpo?.event;
  const pagamento = corpo?.payment;
  if (!evento || !pagamento) return { ok: false, motivo: 'payload_invalido' };

  // Acha a nossa cobrança: primeiro pela referência que mandamos na emissão,
  // depois pelo id da Asaas (caso a cobrança tenha nascido lá).
  let cobranca = null;
  if (pagamento.externalReference) {
    [cobranca] = await store.filter('Cobranca', { id: String(pagamento.externalReference) }, null, 1);
  }
  if (!cobranca && pagamento.id) {
    [cobranca] = await store.filter('Cobranca', { asaas_id: String(pagamento.id) }, null, 1);
  }
  if (!cobranca) return { ok: false, motivo: 'cobranca_nao_encontrada', evento };

  if (EVENTOS_PAGO.has(evento)) {
    if (cobranca.status === 'pago') return { ok: true, ignorado: 'ja_estava_paga' };
    await store.update('Cobranca', cobranca.id, {
      status: 'pago',
      data_pagamento: (pagamento.paymentDate || pagamento.confirmedDate || new Date().toISOString()).slice(0, 10),
      forma: pagamento.billingType || null,
      valor_pago: pagamento.value ?? cobranca.valor,
      conciliado_em: new Date().toISOString(),
    });
    return { ok: true, acao: 'baixa' };
  }

  if (EVENTOS_ESTORNO.has(evento)) {
    await store.update('Cobranca', cobranca.id, {
      status: 'pendente',
      data_pagamento: null,
      observacoes: `${cobranca.observacoes || ''}\n[${evento}] pagamento estornado`.trim(),
    });
    return { ok: true, acao: 'estorno' };
  }

  if (EVENTOS_APAGADA.has(evento)) {
    await store.update('Cobranca', cobranca.id, { status: 'cancelado' });
    return { ok: true, acao: 'cancelamento' };
  }

  // Os demais (PAYMENT_OVERDUE, PAYMENT_UPDATED…) não mudam nada: atraso já é
  // derivado do vencimento no painel, não precisa de campo.
  return { ok: true, ignorado: evento };
}

/**
 * Rede de segurança: relê no provedor as cobranças ainda em aberto e dá baixa
 * no que já foi pago. Webhook se perde (deploy no ar, rede fora) — sem isto o
 * cliente pagaria e continuaria constando como devedor, e o corte por
 * inadimplência bloquearia quem está em dia.
 */
export async function conciliarPendentes({ limite = 200 } = {}) {
  if (!asaasAtiva()) return { ok: false, motivo: 'modo_manual' };

  const abertas = (await store.filter('Cobranca', {}, null, limite))
    .filter((c) => c.asaas_id && c.status !== 'pago' && c.status !== 'cancelado');

  let baixadas = 0;
  for (const c of abertas) {
    try {
      const remota = await buscarCobrancaAsaas(c.asaas_id);
      if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(remota.status)) {
        await store.update('Cobranca', c.id, {
          status: 'pago',
          data_pagamento: (remota.paymentDate || remota.confirmedDate || new Date().toISOString()).slice(0, 10),
          forma: remota.billingType || null,
          valor_pago: remota.value ?? c.valor,
          conciliado_em: new Date().toISOString(),
        });
        baixadas += 1;
      }
    } catch {
      // Uma cobrança problemática não pode interromper a varredura das outras.
    }
  }

  return { ok: true, verificadas: abertas.length, baixadas };
}

export { configAsaas, asaasAtiva };

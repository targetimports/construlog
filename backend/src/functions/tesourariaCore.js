import { store } from '../entityStore.js';

// Núcleo reutilizável da tesouraria (Caixa & Bancos) + verba por empresa.
// Antes, só tesourariaMovimentar mexia no caixa e o pagar/receber não o acionava
// (bug "pagar não baixa o caixa"). Estes helpers são o ponto único de débito/crédito
// de caixa, chamados por pagarContaPagar / darBaixaRecebimento / boletoPagar / repassarVerba.

const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;
const hoje = () => new Date().toISOString().slice(0, 10);

// Débito de caixa numa ContaTesouraria + lançamento no extrato (saída).
export async function registrarSaidaCaixa({ conta_id, valor, meta = {}, user }) {
  if (!conta_id) return { error: 'Conta de pagamento (Caixa & Bancos) é obrigatória' };
  const conta = (await store.filter('ContaTesouraria', { id: conta_id }))[0];
  if (!conta) return { error: 'Conta de pagamento não encontrada' };
  const v = r2(valor);
  if (v <= 0) return { error: 'Valor deve ser maior que zero' };
  const novo = r2(num(conta.saldo_atual) - v);
  if (novo < 0 && !conta.permite_saldo_negativo) return { error: `Saldo insuficiente em "${conta.nome}"` };
  await store.update('ContaTesouraria', conta.id, { saldo_atual: novo });
  const mov = await store.create('MovimentacaoTesouraria', {
    conta_id, tipo: 'saida', valor: v, saldo_posterior: novo,
    descricao: meta.descricao || null, categoria: meta.categoria || null,
    data_movimentacao: meta.data || hoje(), obra_id: meta.obra_id || null,
    empresa_id: conta.empresa_id ?? meta.empresa_id ?? null,
    referencia_tipo: meta.referencia_tipo || null, referencia_id: meta.referencia_id || null,
  }, user?.email || null);
  return { ok: true, movimentacao_id: mov.id, saldo_posterior: novo };
}

// Crédito de caixa numa ContaTesouraria + lançamento no extrato (entrada).
export async function registrarEntradaCaixa({ conta_id, valor, meta = {}, user }) {
  if (!conta_id) return { error: 'Conta de recebimento (Caixa & Bancos) é obrigatória' };
  const conta = (await store.filter('ContaTesouraria', { id: conta_id }))[0];
  if (!conta) return { error: 'Conta de recebimento não encontrada' };
  const v = r2(valor);
  if (v <= 0) return { error: 'Valor deve ser maior que zero' };
  const novo = r2(num(conta.saldo_atual) + v);
  await store.update('ContaTesouraria', conta.id, { saldo_atual: novo });
  const mov = await store.create('MovimentacaoTesouraria', {
    conta_id, tipo: 'entrada', valor: v, saldo_posterior: novo,
    descricao: meta.descricao || null, categoria: meta.categoria || null,
    data_movimentacao: meta.data || hoje(), obra_id: meta.obra_id || null,
    empresa_id: conta.empresa_id ?? meta.empresa_id ?? null,
    referencia_tipo: meta.referencia_tipo || null, referencia_id: meta.referencia_id || null,
  }, user?.email || null);
  return { ok: true, movimentacao_id: mov.id, saldo_posterior: novo };
}

// Ajusta a VERBA de uma empresa (delta > 0 = repasse; delta < 0 = gasto). Best-effort.
export async function ajustarVerbaEmpresa({ empresa_id, delta, user }) {
  if (!empresa_id) return { ok: false, motivo: 'sem empresa' };
  const emp = (await store.filter('Empresa', { id: empresa_id }))[0];
  if (!emp) return { ok: false, motivo: 'empresa não encontrada' };
  const novo = r2(num(emp.saldo_verba) + num(delta));
  await store.update('Empresa', empresa_id, { saldo_verba: novo });
  return { ok: true, saldo_verba: novo };
}

// Empresa dona de um lançamento/conta: direto por empresa_id ou herdado da obra.
export async function empresaDaConta(conta) {
  if (!conta) return null;
  if (conta.empresa_id) return conta.empresa_id;
  if (conta.obra_id) {
    const obra = (await store.filter('Obra', { id: conta.obra_id }))[0];
    return obra?.empresa_id || null;
  }
  return null;
}

// Empresa responsável pela conta, SEMPRE com um destino: obra → empresa_id → Matriz.
// (Regra do cliente: custo sem empresa cai na Central/Matriz.)
async function empresaResponsavel(conta) {
  const direto = await empresaDaConta(conta);
  if (direto) return direto;
  const matriz = (await store.filter('Empresa', { tipo: 'matriz' }, null, 1))[0]
    || (await store.filter('Empresa', {}, null, 1))[0];
  return matriz?.id || null;
}

// O caixa (ContaTesouraria) de uma empresa. Hoje cada empresa tem 1 só; se tiver
// vários, pega o primeiro (o dia em que houver escolha real, um seletor entra aqui).
async function caixaDaEmpresa(empresa_id) {
  if (!empresa_id) return null;
  const contas = await store.filter('ContaTesouraria', { empresa_id }, null, 10).catch(() => []);
  return contas[0] || null;
}

// LIQUIDAÇÃO AUTOMÁTICA NO CAIXA.
//
// Quando uma tela marca a conta como paga/recebida sem passar pelo fluxo de
// pagamento (só virando o status), o dinheiro não saía/entrava do caixa e o saldo
// da tesouraria ficava inflado. Aqui fechamos esse furo: derivamos a empresa
// responsável (obra → conta → Matriz), pegamos o caixa dela e movimentamos —
// débito para 'pagar' (consumindo verba), crédito para 'receber'.
//
// Best-effort: se a empresa não tiver caixa, apenas não movimenta (não trava o
// usuário). Retorna o que precisa ser gravado de volta na conta para ela ficar
// conciliada (e o estorno depois saber desfazer).
export async function liquidarContaNoCaixa(conta, { user } = {}) {
  if (!conta) return { ok: false };
  const empresa_id = await empresaResponsavel(conta);
  const caixa = await caixaDaEmpresa(empresa_id);
  if (!caixa) return { ok: false, motivo: 'sem_caixa', empresa_id };

  if (conta.tipo === 'pagar') {
    const valor = num(conta.valor_pago) || num(conta.valor);
    if (valor <= 0) return { ok: false, motivo: 'sem_valor' };
    const r = await registrarSaidaCaixa({
      conta_id: caixa.id, valor, user,
      meta: {
        categoria: 'pagamento', descricao: `Pagamento: ${conta.descricao || conta.fornecedor_cliente || ''}`.trim(),
        obra_id: conta.obra_id || null, referencia_tipo: 'conta_financeira', referencia_id: conta.id,
        data: conta.data_pagamento || new Date().toISOString().slice(0, 10),
      },
    });
    if (r.error) return { ok: false, motivo: r.error };
    await ajustarVerbaEmpresa({ empresa_id, delta: -valor, user }).catch(() => {});
    return { ok: true, conta_tesouraria_id: caixa.id, conciliacao_movimentacao_id: r.movimentacao_id, conciliado: true, empresa_id };
  }

  if (conta.tipo === 'receber') {
    const valor = num(conta.valor_recebido) || num(conta.valor);
    if (valor <= 0) return { ok: false, motivo: 'sem_valor' };
    const r = await registrarEntradaCaixa({
      conta_id: caixa.id, valor, user,
      meta: {
        categoria: 'recebimento', descricao: `Recebimento: ${conta.descricao || conta.fornecedor_cliente || ''}`.trim(),
        obra_id: conta.obra_id || null, referencia_tipo: 'conta_financeira', referencia_id: conta.id,
        data: conta.data_recebimento || new Date().toISOString().slice(0, 10),
      },
    });
    if (r.error) return { ok: false, motivo: r.error };
    return { ok: true, conta_tesouraria_id: caixa.id, conciliacao_movimentacao_id: r.movimentacao_id, conciliado: true, empresa_id };
  }

  return { ok: false, motivo: 'tipo_desconhecido' };
}

// A conta está liquidada? (pagar→pago; receber→recebido)
export function contaEstaLiquidada(rec) {
  const s = String(rec?.status || '').toLowerCase();
  if (rec?.tipo === 'pagar') return s === 'pago';
  if (rec?.tipo === 'receber') return s === 'recebido';
  return false;
}

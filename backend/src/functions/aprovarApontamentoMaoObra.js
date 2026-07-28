import { store } from '../entityStore.js';
import { requirePermission, podeEditarObra } from '../rbac.js';

// Aprova um apontamento de mão de obra (diária) e gera a DESPESA correspondente
// como Conta a Pagar (plano §13: "ao aprovar, gerar diárias/custos de mão de
// obra por obra"). Idempotente: não duplica a conta se já existir.
//
// Observação: a despesa de mão de obra aparece no Centro de Custos lendo o
// próprio ApontamentoMaoObra (status APROVADO) e no Financeiro pela ContaFinanceira
// aqui criada — sem dupla contagem (Centro de Custos e DRE não leem ContaFinanceira).

const num = (v) => Number(v) || 0;

export default async function aprovarApontamentoMaoObra({ body, user }) {
  requirePermission(user, 'OBRAS_EDIT');
  const { apontamento_id } = body || {};
  if (!apontamento_id) throw Object.assign(new Error('apontamento_id é obrigatório'), { status: 400 });

  const ap = (await store.filter('ApontamentoMaoObra', { id: apontamento_id }))[0];
  if (!ap) throw Object.assign(new Error('Apontamento não encontrado'), { status: 404 });

  const obra = ap.obra_id ? (await store.filter('Obra', { id: ap.obra_id }))[0] : null;
  if (!podeEditarObra(user, obra)) {
    throw Object.assign(new Error('Apenas responsáveis pela obra (ou Admin/TI/Financeiro) podem aprovar apontamentos.'), { status: 403 });
  }

  if (ap.status !== 'APROVADO') {
    await store.update('ApontamentoMaoObra', apontamento_id, { status: 'APROVADO' });
  }

  // Regime de pagamento: SÓ DIARISTA gera conta a pagar de diária. Mensalista
  // (Salário Fixo) tem o custo na FOLHA mensal — gerar diária também contaria em
  // dobro. tipo_pagamento vazio = mensalista (padrão do cadastro).
  const colab = ap.profissional_id ? (await store.filter('Colaborador', { id: ap.profissional_id }))[0] : null;

  // TERCEIRIZADO: não é Colaborador, então caía fora da busca acima e não gerava
  // despesa nenhuma. Ele não entra na folha (não é CLT) — o custo é SEMPRE conta a
  // pagar. Regimes: DIARIA gera aqui; MENSAL sai no fechamento do mês
  // (gerarPagamentosTerceirizados); EMPREITA vem da medição do contrato e nem
  // aparece no ponto — gerar diária para ele pagaria o mesmo serviço duas vezes.
  const terc = !colab && ap.profissional_id
    ? (await store.filter('ProfissionalTerceirizado', { id: ap.profissional_id }))[0]
    : null;
  const regimeTerc = terc
    ? (['DIARIA', 'MENSAL', 'EMPREITA'].includes(terc.tipo_pagamento) ? terc.tipo_pagamento : 'DIARIA')
    : null;

  const ehDiarista = terc
    ? regimeTerc === 'DIARIA'
    : String(colab?.tipo_pagamento || 'SALARIO_FIXO') === 'DIARIA';

  const valor = num(ap.total) || (num(ap.valor_diaria) + num(ap.total_horas_extra));
  let contaId = null;

  if (ehDiarista && valor > 0) {
    // Idempotência: já existe conta para este apontamento?
    const existentes = await store.filter('ContaFinanceira', {
      referencia_tipo: 'apontamento_mao_obra',
      referencia_id: apontamento_id,
    }).catch(() => []);

    if (existentes.length) {
      contaId = existentes[0].id;
    } else {
      const data = ap.data || new Date().toISOString().split('T')[0];
      const conta = await store.create('ContaFinanceira', {
        tipo: 'pagar',
        obra_id: ap.obra_id,
        // Quem é terceirizado vai marcado: no Contas a Pagar, "quem eu estou
        // pagando" muda o tratamento (é fornecedor de serviço, não empregado).
        descricao: `Mão de obra — ${ap.profissional_nome || 'profissional'}${terc ? ' (terceirizado)' : ''} (${data})`,
        categoria: 'mao_de_obra',
        valor,
        status: 'pendente',
        data_emissao: data,
        data_vencimento: data,
        fornecedor_cliente: terc ? (terc.empresa_contratante || terc.nome) : undefined,
        terceirizado_id: terc ? terc.id : undefined,
        referencia_tipo: 'apontamento_mao_obra',
        referencia_id: apontamento_id,
      }, user?.email || null);
      contaId = conta.id;
    }
  }

  return {
    ok: true,
    conta_pagar_id: contaId,
    valor,
    vinculo: terc ? 'terceirizado' : 'proprio',
    regime: terc ? regimeTerc : (ehDiarista ? 'diarista' : 'mensalista'),
  };
}

import { store } from '../entityStore.js';

// Cria uma Medição (rascunho) com seus itens; se enviar=true, já marca como 'enviada'.
// valor de cada item = quantidade_periodo * valor_unitario; total somado na medição.
export default async function criarMedicaoObra({ body, user }) {
  if (!user) throw Object.assign(new Error('Login necessário'), { status: 401 });

  const { obra_id, tipo = 'fisica', itens, observacoes, enviar = false } = body || {};
  if (!obra_id) throw Object.assign(new Error('Obra obrigatória'), { status: 400 });

  const medicaoCriada = await store.create('Medicao', {
    obra_id,
    numero: `MED-${Date.now()}`,
    data_medicao: new Date().toISOString().split('T')[0],
    responsavel_email: user.email,
    tipo,
    status: 'rascunho',
    valor_total_realizado: 0,
    observacoes: observacoes || ''
  });

  const itensCriados = [];
  let valor_total = 0;

  if (Array.isArray(itens) && itens.length > 0) {
    for (const item of itens) {
      const valor_periodo = (item.quantidade_periodo || 0) * (item.valor_unitario || 0);
      const itemCriado = await store.create('ItemMedicao', {
        medicao_id: medicaoCriada.id,
        descricao: item.descricao,
        unidade: item.unidade || 'un',
        quantidade_periodo: item.quantidade_periodo,
        valor_unitario: item.valor_unitario,
        valor_periodo,
        etapa: item.etapa || '',
        categoria: item.categoria || ''
      });
      itensCriados.push(itemCriado);
      valor_total += valor_periodo;
    }
    await store.update('Medicao', medicaoCriada.id, {
      ...(enviar ? { status: 'enviada' } : {}),
      valor_total_realizado: valor_total
    });
  }

  return {
    ok: true,
    medicao: { ...medicaoCriada, valor_total_realizado: valor_total, status: enviar ? 'enviada' : 'rascunho' },
    itens: itensCriados,
    status: enviar ? 'enviada' : 'rascunho',
    message: `Medição ${enviar ? 'criada e enviada' : 'criada'} com sucesso`
  };
}

import { store } from '../entityStore.js';

// Aprova uma medição: status 'enviada' -> 'aprovada'.
export default async function aprovarMedicaoObra({ body, user }) {
  if (!user) throw Object.assign(new Error('Login necessário'), { status: 401 });

  const { medicao_id, observacoes } = body || {};
  if (!medicao_id) throw Object.assign(new Error('medicao_id obrigatório'), { status: 400 });

  const medicoes = await store.filter('Medicao', { id: medicao_id }, null, 1);
  const medicao = medicoes[0];
  if (!medicao) throw Object.assign(new Error('Medição não encontrada'), { status: 404 });
  if (medicao.status !== 'enviada') {
    throw Object.assign(new Error(`Apenas medições 'enviada' podem ser aprovadas. Status atual: ${medicao.status}`), { status: 409 });
  }

  await store.update('Medicao', medicao_id, {
    status: 'aprovada',
    aprovado_por: user.email,
    data_aprovacao: new Date().toISOString(),
    observacoes: observacoes || medicao.observacoes
  });

  return { ok: true, message: 'Medição aprovada com sucesso', data: { medicao_id, status: 'aprovada', aprovado_por: user.email } };
}

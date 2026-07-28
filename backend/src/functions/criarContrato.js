import { store } from '../entityStore.js';

// Cria um contrato (com terceiro/fornecedor) vinculado a uma obra.

const num = (v) => Number(v) || 0;

export default async function criarContrato({ body, user }) {
  const d = body || {};
  if (!d.numero || !d.obra_id || !d.fornecedor_id) {
    throw Object.assign(new Error('Número, obra e fornecedor são obrigatórios.'), { status: 400 });
  }
  const contrato = await store.create('Contrato', {
    numero: d.numero,
    titulo: d.titulo || null,
    tipo: d.tipo || 'fornecimento',
    obra_id: d.obra_id,
    fornecedor_id: d.fornecedor_id,
    contratado_tipo: d.contratado_tipo || 'fornecedor',   // 'fornecedor' | 'terceirizado'
    contratado_nome: d.contratado_nome || null,           // nome denormalizado (exibição/conta)
    categoria_id: d.categoria_id || null,
    valor_inicial: num(d.valor_inicial ?? d.valor_total),
    valor_total: num(d.valor_total),
    data_assinatura: d.data_assinatura || null,
    data_inicio: d.data_inicio || null,
    data_fim_prevista: d.data_fim_prevista || null,
    observacoes: d.observacoes || null,
    status: d.status || 'ativo',
  }, user?.email || null);

  return { ok: true, contrato };
}

import { store } from '../entityStore.js';

// Cria uma SolicitacaoVeiculo em status 'rascunho', resolvendo a obra do
// contexto do usuário quando o tipo_vinculo é 'obra' e gerando número
// sequencial SV-000001. Usada pelo SolicitacaoVeiculoForm em /SolicitacoesVeiculos.

export default async function criarSolicitacaoVeiculoComContexto({ body, user }) {
  const { tipo_vinculo = 'obra', ...dados } = body || {};

  let obra_id = dados.obra_id;
  let cliente_id = dados.cliente_id;

  if (tipo_vinculo === 'obra') {
    if (!obra_id) {
      const ctx = await store.filter('ContextoUsuario', { user_email: user?.email }, null, 1);
      if (ctx[0]?.obra_atual_id) {
        obra_id = ctx[0].obra_atual_id;
        cliente_id = ctx[0].cliente_atual_id;
      }
    }
    if (!obra_id) {
      throw Object.assign(
        new Error('Selecione uma Obra no menu superior para criar solicitação de tipo "Obra"'),
        { status: 400 }
      );
    }
  }

  // Número sequencial (SV-000001). Mesma lógica do base44: pega a última criada.
  const ultimas = await store.filter('SolicitacaoVeiculo', {}, '-created_date', 1);
  const ultimaNum = ultimas[0]?.numero
    ? (parseInt(String(ultimas[0].numero).split('-')[1], 10) || 0)
    : 0;
  const numero = `SV-${String(ultimaNum + 1).padStart(6, '0')}`;

  const solicitacao = await store.create('SolicitacaoVeiculo', {
    ...dados,
    numero,
    solicitante_user_id: user?.email,
    tipo_vinculo,
    obra_id: obra_id || null,
    cliente_id: cliente_id || null,
    status: 'rascunho'
  }, user?.email || null);

  return { success: true, solicitacao };
}

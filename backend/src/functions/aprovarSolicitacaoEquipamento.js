import { store } from '../entityStore.js';
import { isSuperAdmin } from '../rbac.js';

// Aprova uma solicitação de equipamento (entidade SolicitacaoEquipamento).
// Invocada pela aba "Aprovações Pendentes" em /SolicitacaoEquipamentos.
// Payload do front: { solicitacao_id, aprovador_id, observacao }.
//
// Para equipamento próprio, registra o uso (RegistroUsoEquipamento) para
// alimentar o controle de equipamento em uso — best-effort, não bloqueia a
// aprovação se falhar. A rejeição é feita direto pelo front via
// SolicitacaoEquipamento.update(status='rejeitada').

export default async function aprovarSolicitacaoEquipamento({ body, user }) {
  if (!isSuperAdmin(user)) {
    throw Object.assign(new Error('Apenas administradores podem aprovar solicitações.'), { status: 403 });
  }

  const { solicitacao_id, observacao } = body || {};
  if (!solicitacao_id) {
    throw Object.assign(new Error('Solicitação não informada.'), { status: 400 });
  }

  const [solicitacao] = await store.filter('SolicitacaoEquipamento', { id: solicitacao_id }, null, 1);
  if (!solicitacao) {
    throw Object.assign(new Error('Solicitação não encontrada.'), { status: 404 });
  }
  if (solicitacao.status && solicitacao.status !== 'pendente') {
    throw Object.assign(new Error('Solicitação já foi processada.'), { status: 409 });
  }

  const patch = {
    status: 'aprovada',
    aprovado_por: user?.email || null,
    data_aprovacao: new Date().toISOString(),
  };
  if (observacao) patch.observacao_aprovacao = observacao;

  // Registro de uso para equipamento próprio (best-effort).
  if (solicitacao.tipo_solicitacao === 'proprio' && solicitacao.equipamento_id) {
    try {
      const registro = await store.create('RegistroUsoEquipamento', {
        equipamento_id: solicitacao.equipamento_id,
        obra_id: solicitacao.obra_id,
        data_inicio: solicitacao.data_inicio,
        data_fim: solicitacao.data_fim,
        tipo_uso: 'proprio',
        solicitacao_id: solicitacao.id,
      }, user?.email || null);
      patch.registro_uso_equipamento_id = registro.id;
    } catch {
      // não bloqueia a aprovação se o registro de uso falhar
    }
  }

  const atualizada = await store.update('SolicitacaoEquipamento', solicitacao_id, patch);
  return { ok: true, solicitacao: atualizada };
}

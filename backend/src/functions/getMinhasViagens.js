import { store } from '../entityStore.js';
import { requirePermission, isSuperAdmin } from '../rbac.js';
import { colaboradorDoUsuario } from '../obraScope.js';
import { VIAGEM_ABERTA } from './viagemCore.js';

// As viagens do motorista logado.
//
// Autossuficiente de propósito: devolve tudo o que a tela precisa (destino, endereço,
// carga, veículo) direto do registro da Viagem. O motorista não tem OBRAS_VIEW e o
// filtro "só as minhas obras" não o vincula a obra nenhuma — se esta tela dependesse
// de buscar a Obra, ele veria "sem acesso" justamente no destino da própria entrega.
//
// ESCOPO (cliente, 2026-07-20): cada usuário vê SOMENTE as próprias viagens. Só
// ADMIN e TI (super admin) enxergam a frota inteira — é a visão de operação. Vale
// para qualquer role, não só motorista: quem dirige vê o que vai dirigir.
export default async function getMinhasViagens({ body, user }) {
  requirePermission(user, 'LOGISTICA_VIEW');
  const { incluir_finalizadas = false } = body || {};

  const todas = await store.filter('Viagem', {}, '-created_date', 5000).catch(() => []);

  const veTudo = isSuperAdmin(user);
  let minhas = todas;
  if (!veTudo) {
    // Casa por e-mail do usuário ou pelo colaborador vinculado a ele.
    const colab = await colaboradorDoUsuario(user).catch(() => null);
    const email = String(user?.email || '').toLowerCase();
    minhas = todas.filter((v) =>
      (colab && v.motorista_id === colab.id) ||
      (v.motorista_email && String(v.motorista_email).toLowerCase() === email));
  }

  const abertas = minhas.filter((v) => VIAGEM_ABERTA.includes(String(v.status)));
  const encerradas = minhas.filter((v) => !VIAGEM_ABERTA.includes(String(v.status)));

  return {
    success: true,
    ve_tudo: veTudo,                 // admin/TI: visão da frota inteira
    sou_motorista: !veTudo,          // demais: só as próprias viagens
    abertas,
    encerradas: incluir_finalizadas ? encerradas : encerradas.slice(0, 50),
    total: minhas.length,
  };
}

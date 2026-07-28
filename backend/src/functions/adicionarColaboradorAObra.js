import { store } from '../entityStore.js';
import { podeEditarObra } from '../rbac.js';
import { resolverColaborador } from '../pessoaResolver.js';

// Porte de adicionarColaboradorAObra: cria (ou reativa) o vínculo ObraColaborador.
// funcao_na_obra (opcional) sobrepõe o cargo padrão — usado ao alocar pela Gestão
// de Mão de Obra, que carrega o cargo alocado. Nome é resolvido em Colaborador e,
// como fallback, em Motorista (alocação aceita os dois).
export default async function adicionarColaboradorAObra({ body, user }) {
  const { obra_id, funcao_na_obra } = body || {};
  let { colaborador_id } = body || {};
  if (!obra_id || !colaborador_id) {
    throw Object.assign(new Error('obra_id e colaborador_id são obrigatórios'), { status: 400 });
  }

  // O id pode chegar de um USUÁRIO (telas que listam usuários junto de colaboradores).
  // Converte para o Colaborador correspondente — senão o vínculo nasce órfão e a
  // equipe mostra "—" no lugar do nome.
  const res = await resolverColaborador(colaborador_id);
  if (!res?.id) {
    const msg = res?.origem === 'usuario_sem_colaborador'
      ? `"${res.usuario?.full_name || 'Este usuário'}" não tem cadastro de colaborador. Cadastre-o em Colaboradores antes de alocá-lo.`
      : 'Colaborador não encontrado.';
    throw Object.assign(new Error(msg), { status: 400 });
  }
  colaborador_id = res.id;

  const obra = (await store.filter('Obra', { id: obra_id }))[0];
  if (!podeEditarObra(user, obra)) {
    throw Object.assign(new Error('Apenas responsáveis pela obra (ou Admin/TI/Financeiro) podem alterar a equipe.'), { status: 403 });
  }

  const hoje = new Date().toISOString().split('T')[0];
  const existentes = (await store.filter('ObraColaborador', { obra_id, colaborador_id })) || [];

  // Já vinculado e ativo → idempotente.
  const ativo = existentes.find((v) => (v.status || 'ativo') !== 'inativo');
  if (ativo) return { ok: true, vinculo_id: ativo.id, ja_existia: true };

  const c = (await store.filter('Colaborador', { id: colaborador_id }))[0]
    || (await store.filter('Motorista', { id: colaborador_id }))[0]
    || {};

  // Havia vínculo inativo → reativa (preserva histórico).
  const inativo = existentes[0];
  if (inativo) {
    await store.update('ObraColaborador', inativo.id, { status: 'ativo', data_inicio: hoje, data_fim: null });
    return { ok: true, vinculo_id: inativo.id, reativado: true };
  }

  const v = await store.create('ObraColaborador', {
    obra_id,
    colaborador_id,
    colaborador_nome: c.nome || null,
    funcao_na_obra: funcao_na_obra || c.cargo || null,
    status: 'ativo',
    data_inicio: hoje,
  }, user?.email || null);

  return { ok: true, vinculo_id: v.id };
}

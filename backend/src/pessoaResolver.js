import { store } from './entityStore.js';
import { query } from './db.js';

// RESOLVE "QUEM É ESSA PESSOA" para um id que pode vir de qualquer cadastro.
//
// A equipe da obra é sempre COLABORADOR. Mas telas diferentes oferecem listas
// diferentes (Colaborador, Motorista, Usuário do sistema), e um id de USUÁRIO
// gravado como colaborador_id vira registro órfão: a linha aparece com o nome "—"
// e o vínculo não casa com ponto, folha nem rateio.
//
// Aqui o id é normalizado: se veio de um usuário, achamos o Colaborador dele pelo
// e-mail (a mesma ponte usada pelo filtro "só as minhas obras").
export async function resolverColaborador(id) {
  if (!id) return null;

  const direto = (await store.filter('Colaborador', { id }))[0];
  if (direto) return { colaborador: direto, id: direto.id, origem: 'colaborador' };

  // Motorista tem cadastro próprio e também pode ser alocado.
  const mot = (await store.filter('Motorista', { id }).catch(() => []))[0];
  if (mot) return { colaborador: mot, id: mot.id, origem: 'motorista' };

  // É um USUÁRIO do sistema? Então procura o colaborador correspondente pelo e-mail.
  const u = (await query('SELECT id, email, full_name FROM auth_users WHERE id = $1', [id]).catch(() => ({ rows: [] }))).rows[0];
  if (u) {
    const email = String(u.email || '').toLowerCase().trim();
    const todos = await store.filter('Colaborador', {}, undefined, 100000).catch(() => []);
    const achado = todos.find((c) =>
      String(c.email || '').toLowerCase().trim() === email ||
      String(c.user_email || '').toLowerCase().trim() === email ||
      String(c.user_id || '') === String(u.id));
    if (achado) return { colaborador: achado, id: achado.id, origem: 'usuario_convertido', usuario: u };
    return { colaborador: null, id: null, origem: 'usuario_sem_colaborador', usuario: u };
  }

  return { colaborador: null, id: null, origem: 'desconhecido' };
}

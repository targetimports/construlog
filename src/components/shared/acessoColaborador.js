import { base44 } from '@/api/base44Client';
import { ROLES } from './roles';

// Regra-mãe (plano §1/§13): todo colaborador com e-mail e CPF vira usuário do sistema.
// Senha inicial = CPF (só dígitos); perfil = user_role do colaborador ou 'operacional'.
// Usado por TODOS os pontos que criam colaborador (direto ou indireto), para manter
// o comportamento consistente em todo o sistema.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const VALID_ROLES = new Set(ROLES.map((r) => r.value));

// status possíveis: 'criado' | 'ja_existe' | 'sem_email' | 'cpf_invalido' | 'erro'
export async function criarAcessoColaborador(col, emailsExistentes) {
  const email = (col.email || '').toLowerCase().trim();
  if (!EMAIL_RE.test(email)) return { status: 'sem_email' };
  if (emailsExistentes && emailsExistentes.has(email)) return { status: 'ja_existe' };

  const cpf = String(col.cpf || '').replace(/\D/g, '');
  if (cpf.length < 4) return { status: 'cpf_invalido' };

  const role = VALID_ROLES.has(col.user_role) ? col.user_role : 'operacional';
  await base44.entities.User.create({
    email,
    password: cpf,
    full_name: col.nome || email,
    role,
    status: 'ativo',
  });
  // vincula o colaborador ao usuário recém-criado
  if (col.id) {
    await base44.entities.Colaborador.update(col.id, { user_email: email, user_role: role }).catch(() => {});
  }
  return { status: 'criado', email };
}

// Conveniência para fluxos de criação isolada (1 colaborador): busca os usuários
// atuais, monta o set e tenta criar o acesso. Não invalida cache — quem chama decide.
export async function garantirAcessoColaborador(col) {
  let emails = new Set();
  try {
    const usuarios = await base44.entities.User.list('-created_date', 2000);
    emails = new Set((usuarios || []).map((u) => (u.email || '').toLowerCase()));
  } catch {
    // se não conseguir listar, segue sem dedupe (o backend ainda barra duplicado)
  }
  try {
    return await criarAcessoColaborador(col, emails);
  } catch (err) {
    return { status: 'erro', message: err?.message };
  }
}

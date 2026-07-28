import { query, entityTable } from './db.js';
import { getRole, isSuperAdmin } from './rbac.js';
import { isGlobal } from './middleware.js';

// ─────────────────────────────────────────────────────────────────────────────
// "SÓ AS MINHAS OBRAS" — 3ª camada de visibilidade.
//
// As outras duas já existiam: EMPRESA (isolamento, em entities.js) e ROLE (quais
// telas). Esta responde "dentro da minha empresa, QUAIS obras eu enxergo".
//
// Regra (cliente, 2026-07-16): quem não é ADMIN/TI/FINANCEIRO/GESTOR vê apenas as
// obras em que está inserido. Vale para o DETALHE da obra (lista + abrir a obra);
// relatórios e consolidados NÃO passam por aqui — eles rodam por functions no
// servidor e continuam somando tudo, porque dado errado é pior que dado escondido.
//
// Ligação usuário → obra (qualquer uma serve):
//   1. é RESPONSÁVEL da obra (campo casa com e-mail ou nome do usuário);
//   2. tem vínculo ativo na equipe (ObraColaborador);
//   3. tem alocação/transferência ativa (AlocacaoObra).
// (2) e (3) dependem da PONTE usuário↔colaborador — ver colaboradorDoUsuario.
// ─────────────────────────────────────────────────────────────────────────────

// Veem todas as obras da empresa. Gestor entra aqui porque acompanha o consolidado
// (DRE, ranking, contas): filtrá-lo furaria as telas gerenciais.
const ROLES_VEEM_TODAS_OBRAS = new Set(['admin', 'programador', 'financeiro', 'gestor']);

export const veTodasAsObras = (user) =>
  isSuperAdmin(user) || isGlobal(user) || ROLES_VEEM_TODAS_OBRAS.has(getRole(user));

// PONTE usuário (login) → colaborador (quem trabalha na obra).
//
// A ponte é o E-MAIL, e isso já é regra do sistema: "todo colaborador com e-mail e
// CPF vira usuário" (shared/acessoColaborador.js) — o login É o e-mail do
// colaborador, e o cadastro guarda `user_email`. Não há campo novo aqui: só se
// usa o que o fluxo de cadastro já produz.
//
// Ordem: user_email (gravado quando o acesso foi criado) → email do cadastro →
// user_id (se algum dia existir vínculo explícito). Sem esta ponte não há como
// saber em quais obras o usuário está.
export async function colaboradorDoUsuario(user) {
  if (!user) return null;
  const tbl = entityTable('Colaborador');

  const email = String(user.email || '').toLowerCase().trim();
  if (email) {
    const { rows } = await query(
      `SELECT id, data FROM ${tbl}
        WHERE lower(data->>'user_email') = $1 OR lower(data->>'email') = $1
        LIMIT 1`,
      [email],
    );
    if (rows[0]) return { id: rows[0].id, ...rows[0].data };
  }

  const uid = user.id || user.sub;
  if (uid) {
    const { rows } = await query(`SELECT id, data FROM ${tbl} WHERE data->>'user_id' = $1 LIMIT 1`, [String(uid)]);
    if (rows[0]) return { id: rows[0].id, ...rows[0].data };
  }
  return null;
}

// IDs das obras que o usuário enxerga. `null` = vê todas (não filtrar).
export async function obrasDoUsuario(user) {
  if (veTodasAsObras(user)) return null;

  const ids = new Set();

  // 1) Responsável da obra. Os campos guardam NOME (o wizard escolhe de uma lista
  //    de usuários) e às vezes e-mail — casa pelos dois, como podeEditarObra.
  const ident = [user?.email, user?.name, user?.full_name, user?.nome]
    .map((s) => String(s || '').trim().toLowerCase())
    .filter(Boolean);
  if (ident.length) {
    const { rows } = await query(
      `SELECT id, data FROM ${entityTable('Obra')}
        WHERE lower(coalesce(data->>'responsavel_obra', '')) = ANY($1)
           OR lower(coalesce(data->>'responsavel_tecnico', '')) = ANY($1)
           OR lower(coalesce(data->>'responsavel_administrativo', '')) = ANY($1)
           OR lower(coalesce(data->>'responsavel_financeiro', '')) = ANY($1)`,
      [ident],
    );
    for (const r of rows) ids.add(r.id);
  }

  // 2) e 3) Equipe e alocação — dependem do colaborador correspondente.
  const colab = await colaboradorDoUsuario(user);
  if (colab?.id) {
    const vin = await query(
      `SELECT data->>'obra_id' AS obra_id FROM ${entityTable('ObraColaborador')}
        WHERE data->>'colaborador_id' = $1
          AND coalesce(data->>'status', 'ativo') <> 'inativo'`,
      [colab.id],
    );
    for (const r of vin.rows) if (r.obra_id) ids.add(r.obra_id);

    const alo = await query(
      `SELECT data->>'obra_id' AS obra_id FROM ${entityTable('AlocacaoObra')}
        WHERE data->>'colaborador_id' = $1
          AND coalesce(data->>'status', 'ativa') NOT IN ('finalizada', 'cancelada')`,
      [colab.id],
    );
    for (const r of alo.rows) if (r.obra_id) ids.add(r.obra_id);
  }

  return [...ids];
}

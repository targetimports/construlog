import { nanoid } from 'nanoid';
import { query, entityTable } from './db.js';

// Camada de entidades server-side — equivalente a base44.asServiceRole.entities
// para uso dentro de functions portadas. Opera sobre as mesmas tabelas JSONB.

const rowToRecord = (row) => ({
  id: row.id,
  ...row.data,
  created_date: row.created_date,
  updated_date: row.updated_date,
  created_by: row.created_by,
});

const parseOrder = (orderBy) => {
  if (!orderBy) return 'created_date DESC';
  const desc = orderBy.startsWith('-');
  const field = desc ? orderBy.slice(1) : orderBy;
  const dir = desc ? 'DESC' : 'ASC';
  if (field === 'created_date' || field === 'updated_date' || field === 'id') return `${field} ${dir}`;
  return `data->>'${field.replace(/'/g, "''")}' ${dir}`;
};

// Entidades que herdam a empresa da obra quando criadas sem empresa_id explícito
// (multi-empresa: todo lançamento financeiro de uma obra pertence à empresa da obra).
const DERIVA_EMPRESA_DE_OBRA = new Set([
  'ContaFinanceira', 'BoletoPagar', 'ContaTesouraria', 'MovimentacaoTesouraria', 'EmprestimoAtivo',
  // Filhos da obra (auditoria) — herdam empresa_id da obra quando criados por functions.
  'Contrato', 'ContratoObra', 'Medicao', 'MedicaoObra', 'MedicaoContrato', 'BM',
  'DiarioObra', 'ReceitaObra', 'RecebimentoPrevisto', 'LancamentoCustoObra', 'NotaFiscal',
  'RequisicaoObra', 'ApontamentoMaoObra', 'OrdemCompra', 'RequisicaoCompra',
  'ConsolidacaoFinanceiraPorObra', 'DocumentoObra', 'AnexoObra', 'HistoricoObra',
  // Solicitação de compra do fluxo Suprimentos — pertence à empresa-membro (via obra).
  'SolicitacaoCompra',
  // Orçamento/contrato canônicos + RH/apontamento (via obra) — prontidão 2026-07-03.
  'Orcamento', 'ContratoVersao', 'ContratoItem', 'ObraColaborador', 'AlocacaoObra', 'ApontamentoHora',
  'AcidenteTrabalho', 'AcaoCorretiva', 'ProfissionalTerceirizado',
]);

// Entidades-FILHO que herdam a empresa da entidade-PAI (a qual já é escopada por empresa)
// quando não têm obra_id próprio. { entidade: { fk, paiTabela } }.
const DERIVA_EMPRESA_DE_PAI = {
  ItemOrcamento: { fk: 'orcamento_id', pai: 'Orcamento' },
  BMItem: { fk: 'bm_id', pai: 'BM' },
};

export const store = {
  async create(name, data = {}, createdBy = null) {
    const table = entityTable(name);
    const id = data.id || nanoid();
    const { id: _i, created_date, updated_date, created_by, ...rest } = data;
    if (DERIVA_EMPRESA_DE_OBRA.has(name) && !rest.empresa_id && rest.obra_id) {
      const o = await query(`SELECT data->>'empresa_id' AS eid FROM ${entityTable('Obra')} WHERE id = $1`, [rest.obra_id]);
      if (o.rows[0]?.eid) rest.empresa_id = o.rows[0].eid;
    }
    // Filho herda a empresa do pai (Orcamento/BM já escopados) quando não tem obra_id.
    const pai = DERIVA_EMPRESA_DE_PAI[name];
    if (pai && !rest.empresa_id && rest[pai.fk]) {
      const p = await query(`SELECT data->>'empresa_id' AS eid FROM ${entityTable(pai.pai)} WHERE id = $1`, [rest[pai.fk]]);
      if (p.rows[0]?.eid) rest.empresa_id = p.rows[0].eid;
    }
    const { rows } = await query(
      `INSERT INTO ${table} (id, data, created_by) VALUES ($1, $2::jsonb, $3) RETURNING *`,
      [id, JSON.stringify(rest), createdBy],
    );
    return rowToRecord(rows[0]);
  },

  async filter(name, filter = {}, orderBy, limit = 1000) {
    const table = entityTable(name);
    const params = [];
    const conds = [];
    for (const [k, v] of Object.entries(filter || {})) {
      const safe = k.replace(/'/g, "''");
      if (v && typeof v === 'object' && Array.isArray(v.$in)) {
        if (!v.$in.length) { conds.push('FALSE'); continue; }
        const ph = v.$in.map((x) => { params.push(String(x)); return `$${params.length}`; });
        conds.push(k === 'id' ? `id IN (${ph.join(',')})` : `data->>'${safe}' IN (${ph.join(',')})`);
      } else if (v === null) {
        conds.push(`((data ? '${safe}') = false OR (data->>'${safe}') IS NULL)`);
      } else if (k === 'id') {
        params.push(v); conds.push(`id = $${params.length}`);
      } else {
        params.push(JSON.stringify({ [k]: v })); conds.push(`data @> $${params.length}::jsonb`);
      }
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const lim = Math.min(Number(limit) || 1000, 100000);
    params.push(lim);
    const { rows } = await query(
      `SELECT * FROM ${table} ${where} ORDER BY ${parseOrder(orderBy)} LIMIT $${params.length}`,
      params,
    );
    return rows.map(rowToRecord);
  },

  async update(name, id, patch = {}) {
    const table = entityTable(name);
    const { id: _i, created_date, updated_date, created_by, ...rest } = patch;
    const { rows } = await query(
      `UPDATE ${table} SET data = data || $2::jsonb, updated_date = NOW() WHERE id = $1 RETURNING *`,
      [id, JSON.stringify(rest)],
    );
    return rows[0] ? rowToRecord(rows[0]) : null;
  },

  async delete(name, id) {
    const table = entityTable(name);
    await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return { ok: true };
  },
};

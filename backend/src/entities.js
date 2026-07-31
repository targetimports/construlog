import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { query, entityTable } from './db.js';
import { requireAuth, isGlobal, empresaIdDe } from './middleware.js';
import { podeEditarObra, isSuperAdmin, getRole } from './rbac.js';
import { resolverColaborador } from './pessoaResolver.js';
import { obrasDoUsuario } from './obraScope.js';
import { sincronizarContaDoApontamento } from './contaApontamento.js';
import { estornarContaFinanceira, contaMovimentouDinheiro } from './functions/estornoCore.js';
import { liquidarContaNoCaixa, contaEstaLiquidada } from './functions/tesourariaCore.js';

// ─── Gestão de USUÁRIOS: quem pode mexer em quem ───
// Antes NÃO havia guarda nenhuma aqui: qualquer usuário autenticado conseguia
// PUT /entities/User/<ele mesmo> com {"role":"admin"} e virar admin — verificado
// na prática. Escalada de privilégio direta, e o mesmo caminho servia para marcar
// `acesso_global` e furar o isolamento por empresa.
//
// Regra: quem gere pessoas (RH/Gestor) pode criar/editar usuário comum; só
// ADMIN/TI concede PODER — role e acesso_global. Ninguém se auto-promove.
const ROLES_GERENCIAM_USUARIOS = new Set(['admin', 'programador', 'rh', 'gestor']);
const podeGerirUsuarios = (user) => isSuperAdmin(user) || ROLES_GERENCIAM_USUARIOS.has(getRole(user));
const CAMPOS_DE_PODER = ['role', 'acesso_global'];

const router = Router();

// Escritas na obra gateadas pela regra de responsáveis (além do isolamento por
// empresa): só responsáveis da obra (ou Admin/TI/Financeiro/Gestor) criam.
// Cobre solicitações (compra/requisição), financeiro previsto (recebimento/custo)
// e cronograma. Todas carregam obra_id.
const OBRA_WRITE_GATED = new Set([
  'SolicitacaoCompra', 'RequisicaoObra',
  'RecebimentoPrevisto', 'PlannedCostItem', 'CronogramaItem',
  'DiarioObra', 'ApontamentoMaoObra', 'AlocacaoObra',
]);
router.use(requireAuth);

// ───────────── Entidades que guardam SEGREDO ─────────────
//
// ChaveApi guarda a chave que autentica a instalação de cada cliente: com ela,
// alguém se passa pelo sistema do cliente no heartbeat. IntegracaoExterna guarda
// o token do WhatsApp, a chave da Asaas e a senha do SMTP — em texto puro,
// porque o backend precisa usá-los.
//
// Sem esta trava, QUALQUER usuário do painel (um financeiro, um suporte) lia as
// duas por /entities. Hoje só existe o admin, então não havia exposição prática;
// no primeiro usuário com outro perfil, haveria. Segredo não é dado de trabalho:
// é infraestrutura, e infraestrutura é do administrador.
const ENTIDADES_SO_ADMIN = new Set(['ChaveApi', 'IntegracaoExterna']);

router.use('/:name', (req, res, next) => {
  if (!ENTIDADES_SO_ADMIN.has(req.params.name)) return next();
  if (isSuperAdmin(req.user) || getRole(req.user) === 'admin') return next();
  // 404 e não 403: para quem não é admin, estas entidades não existem. Dizer
  // "existe mas você não pode" já entrega que há segredo ali.
  return res.status(404).json({ error: 'not_found' });
});

// ───────────── Helpers ─────────────

// row → { id, ...data, created_date, updated_date, created_by }
const rowToRecord = (row) => ({
  id: row.id,
  ...row.data,
  created_date: row.created_date,
  updated_date: row.updated_date,
  created_by: row.created_by,
});

// "field" → "field ASC", "-field" → "field DESC".
// created_date/updated_date/id são colunas reais; o resto é campo do JSONB.
const parseOrder = (orderBy) => {
  if (!orderBy) return 'created_date DESC';
  const desc = orderBy.startsWith('-');
  const field = desc ? orderBy.slice(1) : orderBy;
  const dir = desc ? 'DESC' : 'ASC';
  if (field === 'created_date' || field === 'updated_date' || field === 'id') {
    return `${field} ${dir}`;
  }
  return `data->>'${field.replace(/'/g, "''")}' ${dir}`;
};

const clampLimit = (limit) => {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return 1000;
  return Math.min(Math.floor(n), 10000);
};

// ───────────── Escopo multi-empresa (isolamento por empresa no backend) ─────────────
// Entidades que já carregam a dimensão de empresa. Cresce a cada fase do redesenho
// (Fase 1: estoque/compras; Fase 2: financeiro; Fase 3: ativos).
// 'Empresa' é escopada pelo próprio id; as demais por data->>'empresa_id'.
// Usuário GLOBAL (admin / staff da matriz com acesso_global) vê tudo;
// usuário MEMBRO (não-global) só vê/mexe na própria empresa — e, se estiver
// sem empresa_id, cai em fail-closed (vê nada) em vez de vazar o grupo.
const ESCOPO_POR_EMPRESA = new Set([
  'Obra', 'LocalEstoque', 'EstoqueMovimentacao', 'SaldoEstoque',
  // Compras: SC + itens ficam com a empresa-membro (quem pede); Pedido/Recebimento
  // e seus itens são da Matriz (compra centralizada — entram no estoque Central).
  'SolicitacaoCompra', 'SolicitacaoCompraItem',
  'PedidoCompra', 'PedidoCompraItem',
  'Recebimento', 'RecebimentoItem',
  // Financeiro (Fase 2): razão + caixa/extrato + boletos. empresa_id herdado da obra.
  'ContaFinanceira', 'ContaTesouraria', 'MovimentacaoTesouraria', 'BoletoPagar',
  // Frota (Fase 3): o Ativo é da Matriz (global); o EMPRÉSTIMO é da empresa tomadora.
  'EmprestimoAtivo',
  // Filhos da OBRA (auditoria 2026-07-01): herdam empresa_id da obra (100% têm obra_id).
  // Sem isso, um membro via/editava contrato/medição/diário/financeiro de OUTRA empresa.
  'Contrato', 'ContratoObra',
  'Medicao', 'MedicaoObra', 'MedicaoContrato', 'BM',
  'DiarioObra',
  'ReceitaObra', 'RecebimentoPrevisto', 'LancamentoCustoObra',
  // Controle de desvio (Fases 2 a 4): rateio do custo real por serviço, a
  // justificativa mensal do desvio e o retrato congelado do mês fechado.
  // Todos têm obra_id, então herdam a empresa da obra como os demais filhos.
  'ApontamentoCustoServico', 'JustificativaDesvio', 'FechamentoObra',
  'NotaFiscal',
  'RequisicaoObra',
  'ApontamentoMaoObra',
  'OrdemCompra', 'RequisicaoCompra',
  'ConsolidacaoFinanceiraPorObra',
  'DocumentoObra', 'AnexoObra', 'HistoricoObra',
  // Prontidão 2026-07-03 (workflow woisy6kk4): entidades canônicas que ficaram fora do
  // escopo e vazavam entre empresas — orçamento/contrato (valores/itens SINAPI), medição
  // (linhas), RH (colaboradores/folha/apontamento-hora). Herdam empresa_id da obra OU do pai.
  'Orcamento', 'ItemOrcamento',
  'ContratoVersao', 'ContratoItem',
  'BMItem',
  'Colaborador', 'Equipe', 'CustoHoraColaborador', 'HabilidadeColaborador',
  'ObraColaborador', 'AlocacaoObra', 'ApontamentoHora',
  'FolhaPagamento', 'FolhaPagamentoItem',
  // RH compliance/SST (prontidão 2026-07-03): dados de saúde/segurança/terceiros por empresa.
  'ControleEPI', 'ASO', 'Treinamento', 'AcidenteTrabalho', 'AcaoCorretiva', 'ProfissionalTerceirizado',
]);

// UM DIA, UMA OBRA (empréstimo de mão de obra entre empresas do grupo).
// O colaborador pode dividir a semana entre obras, mas não trabalha em duas no
// MESMO dia. Sem esta trava, o mesmo dia viraria custo em duas obras — e, se elas
// forem de empresas diferentes, duas empresas pagariam pelo mesmo dia (o rateio do
// consolidado por empresa vem das horas apontadas, em calcularDREGlobalEmpresa).
// Dia sem horas (falta/atestado) não trava: ausência pode constar em mais de uma obra.
const STATUS_FORA_AP = new Set(['REJEITADO', 'CANCELADO', 'CANCELADA']);

// PONTO NÃO SE LANÇA NO FUTURO: é registro do que aconteceu. Marcar presença de
// amanhã é ficção — e geraria diária a pagar por um dia que não existiu. Corrigir
// dia PASSADO continua liberado (esquecimento do encarregado é rotina no canteiro).
//
// A data vem no fuso de Brasília; o container roda em UTC. Usar new Date() aqui
// deixaria passar "amanhã" depois das 21h (quando em UTC já virou o dia seguinte).
const hojeBR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
function dataNoFuturo(data) {
  const d = String(data || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return d > hojeBR();
}
async function conflitoDeDia(data, ignorarId) {
  const prof = data.profissional_id || data.colaborador_id;
  const dia = String(data.data || '').slice(0, 10);
  const horas = (Number(data.horas_normais) || 0) + (Number(data.horas_extra) || 0);
  if (!prof || !dia || horas <= 0) return null;

  const { rows } = await query(
    `SELECT id, data FROM ${entityTable('ApontamentoMaoObra')}
      WHERE data->>'data' LIKE $1
        AND (data->>'profissional_id' = $2 OR data->>'colaborador_id' = $2)`,
    [`${dia}%`, prof],
  );
  for (const row of rows) {
    if (row.id === ignorarId) continue;
    const o = row.data || {};
    if (String(o.obra_id || '') === String(data.obra_id || '')) continue; // mesma obra = edição
    if (STATUS_FORA_AP.has(String(o.status || '').toUpperCase())) continue;
    if ((Number(o.horas_normais) || 0) + (Number(o.horas_extra) || 0) <= 0) continue;
    const ob = await query(`SELECT data->>'nome' AS nome FROM ${entityTable('Obra')} WHERE id = $1`, [o.obra_id]);
    return ob.rows[0]?.nome || 'outra obra';
  }
  return null;
}

// Código de ativo é a plaquinha colada no equipamento — dois ativos com o mesmo código
// tornam impossível saber qual foi emprestado, vistoriado ou mandado para manutenção.
// Compara sem diferenciar maiúsculas nem espaços das pontas.
async function ativoComMesmoCodigo(codigo, ignorarId) {
  const cod = String(codigo || '').trim();
  if (!cod) return null;
  const { rows } = await query(
    `SELECT id, data->>'nome' AS nome FROM ${entityTable('Ativo')}
      WHERE lower(btrim(data->>'codigo')) = lower($1)`,
    [cod],
  );
  const outro = rows.find((r) => r.id !== ignorarId);
  return outro ? (outro.nome || 'outro ativo') : null;
}

// 3ª camada de visibilidade: "só as minhas obras" (ver obraScope.js).
// Vem DEPOIS do escopo por empresa e só restringe a entidade Obra — o detalhe da
// obra. Relatórios/consolidados rodam por functions (não passam por aqui) e seguem
// com os números completos: dado errado é pior que dado escondido.
async function pushEscopoObra(name, user, params, conditions) {
  if (name !== 'Obra') return;
  const ids = await obrasDoUsuario(user);
  if (ids === null) return;                       // vê todas
  if (!ids.length) { conditions.push('FALSE'); return; }  // fail-closed
  params.push(ids);
  conditions.push(`id = ANY($${params.length})`);
}

function pushEscopoEmpresa(name, user, params, conditions) {
  if (isGlobal(user)) return;
  const eid = empresaIdDe(user);
  if (!eid) { conditions.push('FALSE'); return; }
  if (name === 'Empresa') {
    params.push(eid);
    conditions.push(`id = $${params.length}`);
  } else if (ESCOPO_POR_EMPRESA.has(name)) {
    params.push(JSON.stringify({ empresa_id: eid }));
    conditions.push(`data @> $${params.length}::jsonb`);
  }
}

function podeAcessarRegistro(name, user, row) {
  if (isGlobal(user)) return true;
  const eid = empresaIdDe(user);
  if (!eid) return false;
  if (name === 'Empresa') return row.id === eid;
  if (ESCOPO_POR_EMPRESA.has(name)) return (row.data?.empresa_id ?? null) === eid;
  return true; // entidade ainda não escopada nesta fase
}

// ───────────── User (tabela auth_users) ─────────────

const userRowToRecord = (row) => ({
  id: row.id,
  email: row.email,
  full_name: row.full_name,
  role: row.role,
  ...(row.data || {}),
  created_date: row.created_date,
  updated_date: row.updated_date,
});

const listUsers = async (reqUser) => {
  const { rows } = await query('SELECT * FROM auth_users ORDER BY created_date DESC');
  const recs = rows.map(userRowToRecord);
  if (!reqUser || isGlobal(reqUser)) return recs;
  const eid = empresaIdDe(reqUser);
  return recs.filter((u) => u.empresa_id === eid);
};

// ───────────── CRUD ─────────────

router.get('/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    if (name === 'User') return res.json(await listUsers(req.user));
    const table = entityTable(name);
    const order = parseOrder(req.query.orderBy || req.query.order);
    const limit = clampLimit(req.query.limit);
    const params = [];
    const conditions = [];
    pushEscopoEmpresa(name, req.user, params, conditions);
    await pushEscopoObra(name, req.user, params, conditions);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);
    const { rows } = await query(`SELECT * FROM ${table} ${where} ORDER BY ${order} LIMIT $${params.length}`, params);
    res.json(rows.map(rowToRecord));
  } catch (err) { next(err); }
});

router.post('/:name/filter', async (req, res, next) => {
  try {
    const { name } = req.params;
    const { filter = {}, orderBy, limit } = req.body || {};
    if (name === 'User') {
      const all = await listUsers(req.user);
      const matched = all.filter((u) =>
        Object.entries(filter).every(([k, v]) => u[k] === v),
      );
      return res.json(matched);
    }
    const table = entityTable(name);
    const order = parseOrder(orderBy);
    const lim = clampLimit(limit);
    const params = [];
    const conditions = [];

    for (const [key, value] of Object.entries(filter)) {
      const safeKey = key.replace(/'/g, "''");
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (Array.isArray(value.$in)) {
          if (value.$in.length === 0) { conditions.push('FALSE'); continue; }
          const placeholders = value.$in.map((v) => { params.push(String(v)); return `$${params.length}`; });
          if (key === 'id') conditions.push(`id IN (${placeholders.join(',')})`);
          else conditions.push(`data->>'${safeKey}' IN (${placeholders.join(',')})`);
          continue;
        }
        params.push(JSON.stringify({ [key]: value }));
        conditions.push(`data @> $${params.length}::jsonb`);
        continue;
      }
      if (value === null) {
        conditions.push(`((data ? '${safeKey}') = false OR (data->>'${safeKey}') IS NULL)`);
      } else if (key === 'id') {
        params.push(value);
        conditions.push(`id = $${params.length}`);
      } else {
        params.push(JSON.stringify({ [key]: value }));
        conditions.push(`data @> $${params.length}::jsonb`);
      }
    }

    // Isolamento multi-empresa (membro só enxerga a própria empresa).
    pushEscopoEmpresa(name, req.user, params, conditions);
    await pushEscopoObra(name, req.user, params, conditions);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(lim);
    const { rows } = await query(`SELECT * FROM ${table} ${where} ORDER BY ${order} LIMIT $${params.length}`, params);
    res.json(rows.map(rowToRecord));
  } catch (err) { next(err); }
});

router.get('/:name/:id', async (req, res, next) => {
  try {
    const { name, id } = req.params;
    if (name === 'User') {
      const { rows } = await query('SELECT * FROM auth_users WHERE id = $1', [id]);
      if (!rows[0]) return res.status(404).json({ error: 'not_found' });
      return res.json(userRowToRecord(rows[0]));
    }
    const table = entityTable(name);
    const { rows } = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    if (!rows[0] || !podeAcessarRegistro(name, req.user, rows[0])) {
      return res.status(404).json({ error: 'not_found' });
    }
    // "Só as minhas obras" também no acesso direto: sem isto, esconder da lista era
    // decoração — bastava abrir /ObraDetalhes?id=... de outra obra pela URL.
    if (name === 'Obra') {
      const permitidas = await obrasDoUsuario(req.user);
      if (permitidas !== null && !permitidas.includes(id)) {
        return res.status(404).json({ error: 'not_found' });
      }
    }
    res.json(rowToRecord(rows[0]));
  } catch (err) { next(err); }
});

router.post('/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    if (name === 'User') {
      if (!podeGerirUsuarios(req.user)) return res.status(403).json({ error: 'forbidden', message: 'Sem permissão para criar usuários.' });
      const { email, password, full_name, role = 'user', ...extra } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'email_and_password_required' });
      // Só ADMIN/TI cria gente poderosa (ou já nascida global).
      if (!isSuperAdmin(req.user)) {
        if (['admin', 'programador'].includes(String(role))) {
          return res.status(403).json({ error: 'forbidden_role', message: 'Apenas Admin/TI podem criar usuários Admin ou TI.' });
        }
        delete extra.acesso_global;
      }
      const hash = await bcrypt.hash(password, 10);
      const id = nanoid();
      // Mantém data.cargo em sincronia com a role canônica (várias telas do front leem cargo||role).
      const dataObj = { ...extra, cargo: role };
      await query(
        `INSERT INTO auth_users (id, email, password_hash, full_name, role, data) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [id, email.toLowerCase().trim(), hash, full_name || null, role, JSON.stringify(dataObj)],
      );
      const { rows } = await query('SELECT * FROM auth_users WHERE id = $1', [id]);
      return res.status(201).json(userRowToRecord(rows[0]));
    }
    const table = entityTable(name);
    const id = req.body?.id || nanoid();
    const { id: _ignore, created_date, updated_date, created_by, ...data } = req.body || {};

    // Recebimento SÓ com documento por trás (pedido de compra). Isto trava o
    // recebimento avulso pela API — o front já bloqueia, mas a regra de negócio tem
    // de morar aqui. O caminho legítimo (registrarRecebimentoCompra) cria via
    // store.create no servidor, não por esta rota, então não é afetado. Requisição de
    // transferência tem a própria função (receberTransferenciaObra).
    if (name === 'Recebimento' && !data.pedido_id) {
      return res.status(400).json({ error: 'recebimento_sem_pedido', message: 'Recebimento precisa de um pedido de compra. Confirme a compra em Pedidos, ou receba a transferência na obra.' });
    }

    // Multi-empresa: membro só cria na própria empresa (carimba se não informado).
    if (ESCOPO_POR_EMPRESA.has(name) && !isGlobal(req.user)) {
      const eid = empresaIdDe(req.user);
      if (data.empresa_id && data.empresa_id !== eid) return res.status(403).json({ error: 'empresa_forbidden' });
      data.empresa_id = eid;
    }
    // Multi-empresa: registros de obra herdam a empresa da obra (também p/ criador global).
    if (ESCOPO_POR_EMPRESA.has(name) && !data.empresa_id && data.obra_id) {
      const o = await query(`SELECT data->>'empresa_id' AS eid FROM ${entityTable('Obra')} WHERE id = $1`, [data.obra_id]);
      if (o.rows[0]?.eid) data.empresa_id = o.rows[0].eid;
    }
    // Filho herda a empresa do pai (Orcamento/BM já escopados) quando não tem obra_id.
    if (!data.empresa_id) {
      const pai = { ItemOrcamento: { fk: 'orcamento_id', tbl: 'Orcamento' }, BMItem: { fk: 'bm_id', tbl: 'BM' } }[name];
      if (pai && data[pai.fk]) {
        const r = await query(`SELECT data->>'empresa_id' AS eid FROM ${entityTable(pai.tbl)} WHERE id = $1`, [data[pai.fk]]);
        if (r.rows[0]?.eid) data.empresa_id = r.rows[0].eid;
      }
    }
    // Escrita na obra: só responsáveis (ou Admin/TI/Financeiro/Gestor) podem criar.
    if (OBRA_WRITE_GATED.has(name) && data.obra_id && !isGlobal(req.user)) {
      const o = await query(`SELECT * FROM ${entityTable('Obra')} WHERE id = $1`, [data.obra_id]);
      if (o.rows[0] && !podeEditarObra(req.user, rowToRecord(o.rows[0]))) {
        return res.status(403).json({ error: 'obra_forbidden', message: 'Apenas responsáveis pela obra (ou Admin/TI/Financeiro) podem alterar esta obra.' });
      }
    }
    if (name === 'ApontamentoMaoObra') {
      if (dataNoFuturo(data.data)) {
        return res.status(400).json({ error: 'data_futura', message: 'Não dá para lançar ponto em data futura.' });
      }
      const outra = await conflitoDeDia(data, id);
      if (outra) return res.status(409).json({ error: 'dia_em_outra_obra', message: `Este colaborador já tem horas lançadas em "${outra}" neste dia. Um colaborador só trabalha em uma obra por dia.` });
    }
    if (name === 'Ativo') {
      const dono = await ativoComMesmoCodigo(data.codigo, id);
      if (dono) return res.status(409).json({ error: 'codigo_ativo_duplicado', message: `O código "${String(data.codigo).trim()}" já está em uso por "${dono}".` });
    }
    // ALOCAÇÃO/VÍNCULO: colaborador_id precisa ser mesmo um COLABORADOR. As telas
    // oferecem listas mistas (colaborador, motorista, usuário do sistema) e um id de
    // usuário gravado aqui vira registro órfão — a equipe mostra "—" no lugar do nome
    // e o vínculo não casa com ponto, folha nem rateio. Converte pelo e-mail quando dá.
    if (['AlocacaoObra', 'ObraColaborador'].includes(name) && data.colaborador_id) {
      const r = await resolverColaborador(data.colaborador_id);
      if (!r?.id) {
        return res.status(400).json({
          error: 'colaborador_invalido',
          message: r?.origem === 'usuario_sem_colaborador'
            ? `"${r.usuario?.full_name || 'Este usuário'}" não tem cadastro de colaborador. Cadastre-o em Colaboradores antes de alocá-lo.`
            : 'Colaborador não encontrado.',
        });
      }
      data.colaborador_id = r.id;
      if (!data.colaborador_nome && r.colaborador?.nome) data.colaborador_nome = r.colaborador.nome;
    }
    const { rows } = await query(
      `INSERT INTO ${table} (id, data, created_by) VALUES ($1, $2::jsonb, $3) RETURNING *`,
      [id, JSON.stringify(data), req.user.email || null],
    );
    let novo = rowToRecord(rows[0]);

    // Conta NASCIDA já paga/recebida (tela de lançamento rápido, opção "já pago")
    // → movimenta o caixa da empresa responsável e concilia. Mesma regra do PUT.
    if (name === 'ContaFinanceira' && contaEstaLiquidada(novo) && !novo.conciliacao_movimentacao_id) {
      const liq = await liquidarContaNoCaixa(novo, { user: req.user }).catch(() => null);
      if (liq?.ok) {
        const { rows: r2 } = await query(
          `UPDATE ${table} SET data = data || $2::jsonb WHERE id = $1 RETURNING *`,
          [id, JSON.stringify({ conta_tesouraria_id: liq.conta_tesouraria_id, conciliacao_movimentacao_id: liq.conciliacao_movimentacao_id, conciliado: true })],
        );
        if (r2[0]) novo = rowToRecord(r2[0]);
      }
    }
    res.status(201).json(novo);
  } catch (err) { next(err); }
});

router.post('/:name/bulk', async (req, res, next) => {
  try {
    const { name } = req.params;
    if (name === 'User') return res.status(400).json({ error: 'bulk_not_supported_for_user' });
    const table = entityTable(name);
    const items = Array.isArray(req.body) ? req.body : (req.body?.items || []);
    const escopada = ESCOPO_POR_EMPRESA.has(name);
    const membroEid = (escopada && !isGlobal(req.user)) ? empresaIdDe(req.user) : null;
    const created = [];
    for (const item of items) {
      const id = item?.id || nanoid();
      const { id: _ig, created_date, updated_date, created_by, ...data } = item || {};
      // Multi-empresa: membro só cria na própria empresa (rejeita conflito, como o POST unitário).
      if (membroEid) {
        if (data.empresa_id && data.empresa_id !== membroEid) return res.status(403).json({ error: 'empresa_forbidden' });
        data.empresa_id = membroEid;
      }
      // Registros de obra herdam a empresa da obra (também p/ criador global).
      if (escopada && !data.empresa_id && data.obra_id) {
        const o = await query(`SELECT data->>'empresa_id' AS eid FROM ${entityTable('Obra')} WHERE id = $1`, [data.obra_id]);
        if (o.rows[0]?.eid) data.empresa_id = o.rows[0].eid;
      }
      const { rows } = await query(
        `INSERT INTO ${table} (id, data, created_by) VALUES ($1, $2::jsonb, $3) RETURNING *`,
        [id, JSON.stringify(data), req.user.email || null],
      );
      created.push(rowToRecord(rows[0]));
    }
    res.status(201).json(created);
  } catch (err) { next(err); }
});

router.put('/:name/:id', async (req, res, next) => {
  try {
    const { name, id } = req.params;
    if (name === 'User') {
      if (!podeGerirUsuarios(req.user)) return res.status(403).json({ error: 'forbidden', message: 'Sem permissão para editar usuários.' });
      const body = { ...(req.body || {}) };
      // PODER (role/acesso_global) só ADMIN/TI concede — nem para si mesmo. Era por
      // aqui que qualquer um virava admin com um PUT.
      // Barra a MUDANÇA, não a presença: as telas mandam o registro inteiro, então
      // recusar o campo igual travaria o RH até para corrigir um nome.
      if (!isSuperAdmin(req.user)) {
        const atual = (await query('SELECT role, data FROM auth_users WHERE id = $1', [id])).rows[0];
        if (!atual) return res.status(404).json({ error: 'not_found' });
        const valorAtual = (k) => (k === 'role' ? atual.role : atual.data?.[k] === true);
        const mudou = CAMPOS_DE_PODER.filter((k) => {
          if (body[k] === undefined) return false;
          return k === 'role' ? String(body[k]) !== String(valorAtual(k)) : (body[k] === true) !== valorAtual(k);
        });
        if (mudou.length) {
          return res.status(403).json({ error: 'forbidden_privilege', message: `Apenas Admin/TI podem alterar: ${mudou.join(', ')}.` });
        }
      }
      const fields = [];
      const values = [];
      const known = ['email', 'full_name', 'role'];
      if (body.email !== undefined) { values.push(String(body.email).toLowerCase().trim()); fields.push(`email = $${values.length}`); }
      if (body.full_name !== undefined) { values.push(body.full_name); fields.push(`full_name = $${values.length}`); }
      if (body.role !== undefined) { values.push(body.role); fields.push(`role = $${values.length}`); }
      if (body.password) { values.push(await bcrypt.hash(body.password, 10)); fields.push(`password_hash = $${values.length}`); }
      const extra = { ...body };
      for (const k of [...known, 'password', 'id', 'created_date', 'updated_date']) delete extra[k];
      // Ao trocar a role, sincroniza data.cargo (várias telas do front leem cargo||role).
      if (body.role !== undefined) extra.cargo = String(body.role);
      if (Object.keys(extra).length) {
        values.push(JSON.stringify(extra));
        fields.push(`data = COALESCE(data, '{}'::jsonb) || $${values.length}::jsonb`);
      }
      if (!fields.length) return res.status(400).json({ error: 'nothing_to_update' });
      values.push(id);
      await query(`UPDATE auth_users SET ${fields.join(', ')}, updated_date = NOW() WHERE id = $${values.length}`, values);
      const { rows } = await query('SELECT * FROM auth_users WHERE id = $1', [id]);
      if (!rows[0]) return res.status(404).json({ error: 'not_found' });
      return res.json(userRowToRecord(rows[0]));
    }
    const table = entityTable(name);
    // Guard multi-empresa: membro só edita registro da própria empresa e não reatribui a empresa.
    let curRow = null;
    if (ESCOPO_POR_EMPRESA.has(name) && !isGlobal(req.user)) {
      const cur = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
      if (!cur.rows[0]) return res.status(404).json({ error: 'not_found' });
      curRow = cur.rows[0];
      if (!podeAcessarRegistro(name, req.user, curRow)) return res.status(403).json({ error: 'empresa_forbidden' });
    }
    // Edição de OBRA: só responsáveis (ou Admin/TI/Financeiro) editam.
    if (name === 'Obra' && !isGlobal(req.user)) {
      if (!curRow) {
        const cur = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
        if (!cur.rows[0]) return res.status(404).json({ error: 'not_found' });
        curRow = cur.rows[0];
      }
      if (!podeEditarObra(req.user, rowToRecord(curRow))) {
        return res.status(403).json({ error: 'obra_forbidden', message: 'Apenas responsáveis pela obra (ou Admin/TI/Financeiro) podem editar.' });
      }
    }
    // Editar/excluir registro da obra (recebimento/custo/cronograma/solicitação): só responsáveis.
    if (OBRA_WRITE_GATED.has(name) && !isGlobal(req.user)) {
      if (!curRow) {
        const cur = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
        if (!cur.rows[0]) return res.status(404).json({ error: 'not_found' });
        curRow = cur.rows[0];
      }
      const rec = rowToRecord(curRow);
      if (rec.obra_id) {
        const o = await query(`SELECT * FROM ${entityTable('Obra')} WHERE id = $1`, [rec.obra_id]);
        if (o.rows[0] && !podeEditarObra(req.user, rowToRecord(o.rows[0]))) {
          return res.status(403).json({ error: 'obra_forbidden', message: 'Apenas responsáveis pela obra (ou Admin/TI/Financeiro) podem alterar esta obra.' });
        }
      }
    }
    const { id: _ig, created_date, updated_date, created_by, ...patch } = req.body || {};
    if (ESCOPO_POR_EMPRESA.has(name) && !isGlobal(req.user)) delete patch.empresa_id;
    // Um dia, uma obra: vale também na edição (ex.: falta → presente num dia em que
    // o colaborador já foi apontado em outra obra). Checa o registro JÁ MESCLADO.
    if (name === 'ApontamentoMaoObra') {
      if (!curRow) {
        const cur = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
        if (!cur.rows[0]) return res.status(404).json({ error: 'not_found' });
        curRow = cur.rows[0];
      }
      const mesclado = { ...rowToRecord(curRow), ...patch };
      if (dataNoFuturo(mesclado.data)) {
        return res.status(400).json({ error: 'data_futura', message: 'Não dá para lançar ponto em data futura.' });
      }
      const outra = await conflitoDeDia(mesclado, id);
      if (outra) return res.status(409).json({ error: 'dia_em_outra_obra', message: `Este colaborador já tem horas lançadas em "${outra}" neste dia. Um colaborador só trabalha em uma obra por dia.` });
    }
    // Renomear o código de um ativo não pode colidir com outro (ignora ele mesmo).
    if (name === 'Ativo' && patch.codigo !== undefined) {
      const dono = await ativoComMesmoCodigo(patch.codigo, id);
      if (dono) return res.status(409).json({ error: 'codigo_ativo_duplicado', message: `O código "${String(patch.codigo).trim()}" já está em uso por "${dono}".` });
    }

    // ── ContaFinanceira: dinheiro já movimentado não muda em silêncio ──
    // Duas proteções sobre uma conta JÁ paga/recebida:
    //  (1) mudar o VALOR é bloqueado — a baixa no caixa foi feita pelo valor
    //      antigo; reescrever o valor deixaria conta e caixa discordando. O
    //      caminho certo é cancelar (estorna) e refazer.
    //  (2) mudar o status para 'cancelado' ESTORNA antes: devolve caixa e verba.
    //  (3) virar 'pago'/'recebido' aqui (tela que só troca o status) LIQUIDA no
    //      caixa depois do update — senão o saldo da tesouraria fica inflado.
    let contaVaiLiquidar = false;
    if (name === 'ContaFinanceira') {
      if (!curRow) {
        const cur = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
        if (!cur.rows[0]) return res.status(404).json({ error: 'not_found' });
        curRow = cur.rows[0];
      }
      const atual = rowToRecord(curRow);
      const mudouStatusPara = (s) => patch.status !== undefined && String(patch.status).toLowerCase() === s;
      const cancelando = mudouStatusPara('cancelado');

      // A conta está VIRANDO liquidada agora (não era, passou a ser)? Guardamos
      // para, depois do UPDATE, movimentar o caixa que a tela não mexeu.
      const mesclado = { ...atual, ...patch };
      contaVaiLiquidar = !contaEstaLiquidada(atual) && contaEstaLiquidada(mesclado) && !atual.conciliacao_movimentacao_id;

      if (contaMovimentouDinheiro(atual) && !cancelando) {
        // Comparar contra o valor atual: as telas mandam o registro inteiro, então
        // "campo presente" não é "campo alterado" — só barra mudança de verdade.
        const mudou = (campo) => patch[campo] !== undefined && Number(patch[campo]) !== Number(atual[campo] || 0);
        if (mudou('valor') || mudou('valor_pago') || mudou('valor_recebido')) {
          return res.status(409).json({
            error: 'conta_liquidada_imutavel',
            message: 'Esta conta já foi paga/recebida. Para mudar o valor, cancele-a (o caixa e a verba são estornados) e lance de novo.',
          });
        }
      }

      if (cancelando && contaMovimentouDinheiro(atual)) {
        await estornarContaFinanceira(atual, { user: req.user, motivo: 'cancelamento' }).catch(() => null);
        // Zera os vínculos de liquidação: a conta cancelada não "aponta" mais para
        // um pagamento vivo (o estorno já lançou o movimento contrário).
        patch.conciliado = false;
        patch.conta_tesouraria_id = null;
      }
    }

    const { rows } = await query(
      `UPDATE ${table}
         SET data = data || $2::jsonb,
             updated_date = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, JSON.stringify(patch)],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });

    // Corrigiu o ponto de um dia JÁ APROVADO? A conta a pagar tem que acompanhar —
    // senão as horas dizem uma coisa e o financeiro paga outra, em silêncio.
    // Conta paga não é tocada (decisão de negócio); a tela avisa a divergência.
    let registro = rowToRecord(rows[0]);
    if (name === 'ApontamentoMaoObra') {
      const sync = await sincronizarContaDoApontamento(registro).catch(() => null);
      if (sync) return res.json({ ...registro, _conta_sync: sync });
    }

    // Conta virou paga/recebida por uma tela que só trocou o status → movimenta o
    // caixa da empresa responsável (obra → conta → Matriz) e concilia.
    if (contaVaiLiquidar) {
      const liq = await liquidarContaNoCaixa(registro, { user: req.user }).catch(() => null);
      if (liq?.ok) {
        const { rows: r2 } = await query(
          `UPDATE ${table} SET data = data || $2::jsonb WHERE id = $1 RETURNING *`,
          [id, JSON.stringify({ conta_tesouraria_id: liq.conta_tesouraria_id, conciliacao_movimentacao_id: liq.conciliacao_movimentacao_id, conciliado: true })],
        );
        if (r2[0]) registro = rowToRecord(r2[0]);
      }
    }
    res.json(registro);
  } catch (err) { next(err); }
});

router.delete('/:name/:id', async (req, res, next) => {
  try {
    const { name, id } = req.params;
    if (name === 'User') {
      // Só ADMIN/TI apaga login (antes qualquer autenticado apagava qualquer um,
      // inclusive o próprio admin — trancava o cliente fora do sistema).
      if (!isSuperAdmin(req.user)) return res.status(403).json({ error: 'forbidden', message: 'Apenas Admin/TI podem excluir usuários.' });
      if (String(id) === String(req.user.id || req.user.sub)) {
        return res.status(400).json({ error: 'self_delete', message: 'Você não pode excluir o próprio usuário.' });
      }
      await query('DELETE FROM auth_users WHERE id = $1', [id]);
      return res.json({ ok: true });
    }
    const table = entityTable(name);
    let curRow = null;
    if (ESCOPO_POR_EMPRESA.has(name) && !isGlobal(req.user)) {
      const cur = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
      if (!cur.rows[0]) return res.status(404).json({ error: 'not_found' });
      curRow = cur.rows[0];
      if (!podeAcessarRegistro(name, req.user, curRow)) return res.status(403).json({ error: 'empresa_forbidden' });
    }
    // Excluir Obra ou registro da obra: só responsáveis (ou Admin/TI/Financeiro).
    if ((name === 'Obra' || OBRA_WRITE_GATED.has(name)) && !isGlobal(req.user)) {
      if (!curRow) {
        const cur = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
        if (!cur.rows[0]) return res.status(404).json({ error: 'not_found' });
        curRow = cur.rows[0];
      }
      const rec = rowToRecord(curRow);
      let obra = null;
      if (name === 'Obra') obra = rec;
      else if (rec.obra_id) {
        const or = await query(`SELECT * FROM ${entityTable('Obra')} WHERE id = $1`, [rec.obra_id]);
        if (or.rows[0]) obra = rowToRecord(or.rows[0]);
      }
      if (obra && !podeEditarObra(req.user, obra)) {
        return res.status(403).json({ error: 'obra_forbidden', message: 'Apenas responsáveis pela obra (ou Admin/TI/Financeiro) podem excluir.' });
      }
    }
    // Excluir uma ContaFinanceira já paga/recebida ESTORNA o caixa e a verba antes
    // de apagar — senão o dinheiro some da conta e nunca volta ao saldo.
    if (name === 'ContaFinanceira') {
      if (!curRow) {
        const cur = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
        if (!cur.rows[0]) return res.status(404).json({ error: 'not_found' });
        curRow = cur.rows[0];
      }
      const rec = rowToRecord(curRow);
      if (contaMovimentouDinheiro(rec)) {
        await estornarContaFinanceira(rec, { user: req.user, motivo: 'exclusao' }).catch(() => null);
      }
    }

    await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;

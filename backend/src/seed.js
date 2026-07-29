import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { nanoid } from 'nanoid';
import { pool, query } from './db.js';

// DADOS DE DEMONSTRAÇÃO — desligados por padrão.
//
// Estes seeds nasceram para desenvolvimento e demo: criam um grupo fictício
// ("Construlog Construções" e irmãs), usuários com senha `demo1234`, estoque,
// caixa com milhões e ativos de exemplo. Numa instalação de cliente isso é
// inaceitável — empresas fantasmas no sistema dele e contas com senha pública.
//
// Por isso a regra é: instalação nasce VAZIA e a estrutura real (empresa,
// caixa, estoque central) é criada na configuração inicial, com os dados do
// cliente. Ligue SEED_DEMO=true só em ambiente seu, para demonstrar o produto.
const SEED_DEMO = String(process.env.SEED_DEMO || '').toLowerCase() === 'true';

const puloDemo = (nome) => {
  console.log(`[seed] ${nome}: instalação limpa (SEED_DEMO desligado) — pulando dados de exemplo.`);
};

export async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'contato@targetimports.com').toLowerCase().trim();
  const name = process.env.SEED_ADMIN_NOME || 'Administrador';
  let password = process.env.SEED_ADMIN_SENHA;

  const existing = await query('SELECT id FROM auth_users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    console.log(`[seed] Admin já existe: ${email}`);
    return;
  }

  let generated = false;
  if (!password) {
    password = crypto.randomBytes(9).toString('base64url');
    generated = true;
  }

  const hash = await bcrypt.hash(password, 10);
  await query(
    `INSERT INTO auth_users (id, email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4, 'admin')`,
    [nanoid(), email, hash, name],
  );

  console.log('================================================================');
  console.log(`[seed] Admin criado: ${email}`);
  if (generated) {
    console.log('[seed] Senha (gerada — anote agora, não será exibida de novo):');
    console.log(`       ${password}`);
  } else {
    console.log('[seed] Senha: definida via SEED_ADMIN_SENHA');
  }
  console.log('================================================================');
}

// ───────────── Seed multi-empresa (Grupo/Matriz + empresas-membro) ─────────────
// Idempotente: só roda enquanto não existe uma matriz. Cria a estrutura do grupo,
// vincula as obras existentes às empresas-membro e cria um usuário gestor por
// empresa (senha demo1234) para demonstrar o isolamento por empresa.
export async function seedEmpresas() {
  if (!SEED_DEMO) return puloDemo('Empresas');

  const jaTem = await query(`SELECT id FROM entity_empresa WHERE data->>'tipo' = 'matriz' LIMIT 1`);
  if (jaTem.rows.length) {
    console.log('[seed] Empresas do grupo já existem — pulando.');
    return;
  }

  const insEmpresa = async (data) => {
    const id = nanoid();
    await query(
      `INSERT INTO entity_empresa (id, data, created_by) VALUES ($1, $2::jsonb, 'seed')`,
      [id, JSON.stringify(data)],
    );
    return id;
  };

  // 1) Matriz (dona do estoque central, da frota e da tesouraria central).
  const matrizId = await insEmpresa({
    nome: 'Grupo Construlog', tipo: 'matriz',
    razao_social: 'Grupo Construlog Participações Ltda', cnpj: '00.000.000/0001-00',
    ativa: true, saldo_verba: 0,
  });

  // 2) Empresas-membro.
  const membrosDef = [
    { nome: 'Construlog Construções',   razao_social: 'Construlog Construções Ltda',   cnpj: '11.111.111/0001-11' },
    { nome: 'Construlog Engenharia',    razao_social: 'Construlog Engenharia Ltda',    cnpj: '22.222.222/0001-22' },
    { nome: 'Construlog Incorporadora', razao_social: 'Construlog Incorporadora Ltda', cnpj: '33.333.333/0001-33' },
  ];
  const membros = [];
  for (const m of membrosDef) {
    const id = await insEmpresa({ ...m, tipo: 'membro', ativa: true, saldo_verba: 0 });
    membros.push({ id, ...m });
  }

  // 3) Vincula obras existentes às empresas-membro (round-robin).
  const { rows: obras } = await query(`SELECT id FROM entity_obra ORDER BY created_date ASC`);
  for (let i = 0; i < obras.length; i++) {
    const eid = membros[i % membros.length].id;
    await query(
      `UPDATE entity_obra SET data = data || $2::jsonb, updated_date = NOW() WHERE id = $1`,
      [obras[i].id, JSON.stringify({ empresa_id: eid })],
    );
  }

  // 4) Um usuário gestor por empresa-membro (senha demo1234) — testa o isolamento.
  const senhaHash = await bcrypt.hash('demo1234', 10);
  const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^construlog\s*/i, '').replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');
  for (const m of membros) {
    const email = `gestor.${slug(m.nome)}@construlog.com.br`;
    const dup = await query('SELECT id FROM auth_users WHERE email = $1', [email]);
    if (dup.rows.length) continue;
    await query(
      `INSERT INTO auth_users (id, email, password_hash, full_name, role, data)
       VALUES ($1, $2, $3, $4, 'gestor', $5::jsonb)`,
      [nanoid(), email, senhaHash, `Gestor ${m.nome}`, JSON.stringify({ empresa_id: m.id, status: 'ativo' })],
    );
    console.log(`[seed] Usuário-membro: ${email} (senha demo1234) → ${m.nome}`);
  }

  // 5) Marca o admin (matriz) com acesso global.
  await query(
    `UPDATE auth_users SET data = COALESCE(data, '{}'::jsonb) || $1::jsonb WHERE role = 'admin'`,
    [JSON.stringify({ empresa_id: matrizId, acesso_global: true })],
  );

  console.log(`[seed] Grupo criado: 1 matriz + ${membros.length} empresas-membro; ${obras.length} obras vinculadas.`);
}

// ───────────── Seed estoque 3 níveis (Fase 1) ─────────────
// Central (Matriz) + 1 almoxarifado por empresa-membro + insumos base + entrada
// inicial no Central (para o saldo aparecer). Idempotente (guarda no nível CENTRAL).
export async function seedEstoque() {
  // O estoque CENTRAL real é criado na configuração inicial, junto com a matriz.
  if (!SEED_DEMO) return puloDemo('Estoque');

  const jaTem = await query(`SELECT id FROM entity_localestoque WHERE data->>'nivel' = 'CENTRAL' LIMIT 1`);
  if (jaTem.rows.length) {
    console.log('[seed] Estoque (3 níveis) já existe — pulando.');
    return;
  }

  const matriz = await query(`SELECT id FROM entity_empresa WHERE data->>'tipo' = 'matriz' LIMIT 1`);
  const matrizId = matriz.rows[0]?.id || null;
  const membros = await query(`SELECT id, data->>'nome' AS nome FROM entity_empresa WHERE data->>'tipo' = 'membro'`);

  const insLocal = async (data) => {
    const id = nanoid();
    await query(`INSERT INTO entity_localestoque (id, data, created_by) VALUES ($1, $2::jsonb, 'seed')`, [id, JSON.stringify(data)]);
    return id;
  };

  // Estoque CENTRAL da Matriz (dono do estoque geral do grupo).
  const centralId = await insLocal({ nome: 'Estoque Central — Grupo Construlog', nivel: 'CENTRAL', tipo: 'CENTRAL', empresa_id: matrizId, ativo: true });

  // Um almoxarifado por empresa-membro (nível EMPRESA).
  for (const m of membros.rows) {
    await insLocal({ nome: `Almoxarifado — ${m.nome}`, nivel: 'EMPRESA', empresa_id: m.id, ativo: true });
  }

  // Insumos base (catálogo único = Insumo).
  const insumosDef = [
    { codigo: 'CIM-50', descricao: 'Cimento CP-II 50kg', unidade: 'sc', preco_unitario: 32.5 },
    { codigo: 'ARE-M3', descricao: 'Areia média', unidade: 'm3', preco_unitario: 110 },
    { codigo: 'BRI-M3', descricao: 'Brita 1', unidade: 'm3', preco_unitario: 135 },
    { codigo: 'ACO-CA50', descricao: 'Aço CA-50 10mm', unidade: 'kg', preco_unitario: 8.9 },
    { codigo: 'TIJ-BLC', descricao: 'Bloco cerâmico 9x19x19', unidade: 'un', preco_unitario: 1.8 },
  ];
  const insumos = [];
  for (const i of insumosDef) {
    const dup = await query(`SELECT id FROM entity_insumo WHERE data->>'codigo' = $1 LIMIT 1`, [i.codigo]);
    let id = dup.rows[0]?.id;
    if (!id) {
      id = nanoid();
      await query(`INSERT INTO entity_insumo (id, data, created_by) VALUES ($1, $2::jsonb, 'seed')`,
        [id, JSON.stringify({ ...i, grupo: 'material', tipo: 'material', base: 'propria', ativo: true, empresa_id: matrizId })]);
    }
    insumos.push({ id, ...i });
  }

  // Entrada inicial no CENTRAL (para o saldo do grupo aparecer).
  const agora = new Date().toISOString();
  const qtdDemo = { 'CIM-50': 500, 'ARE-M3': 80, 'BRI-M3': 60, 'ACO-CA50': 2000, 'TIJ-BLC': 10000 };
  for (const ins of insumos) {
    const q = qtdDemo[ins.codigo] || 100;
    await query(`INSERT INTO entity_estoquemovimentacao (id, data, created_by) VALUES ($1, $2::jsonb, 'seed')`,
      [nanoid(), JSON.stringify({
        tipo: 'ENTRADA', empresa_id: null, obra_id: null,
        origem_local_id: null, destino_local_id: centralId,
        insumo_id: ins.id, insumo_nome: ins.descricao, insumo_unidade: ins.unidade,
        quantidade: q, qtd_itens: 1, custo_unitario: ins.preco_unitario, valor_total: q * ins.preco_unitario,
        documento_ref: 'SEED', observacao: 'Estoque inicial (seed)', data_mov: agora, registrado_por: 'seed',
      })]);
    // SaldoEstoque materializado do central (compat das telas que leem o materializado).
    await query(`INSERT INTO entity_saldoestoque (id, data, created_by) VALUES ($1, $2::jsonb, 'seed')`,
      [nanoid(), JSON.stringify({
        local_estoque_id: centralId, empresa_id: matrizId,
        insumo_id: ins.id, material_id: ins.id,
        insumo_nome: ins.descricao, insumo_unidade: ins.unidade, material_nome: ins.descricao, material_unidade: ins.unidade,
        saldo_atual: q, custo_unitario_medio: ins.preco_unitario, valor_total_estoque: q * ins.preco_unitario,
      })]);
  }

  console.log(`[seed] Estoque: 1 CENTRAL + ${membros.rows.length} almoxarifados de empresa + ${insumos.length} insumos c/ entrada inicial no central.`);
}

// ───────────── Seed financeiro por empresa (Fase 2) ─────────────
// Backfill de empresa_id (via obra) nas entidades financeiras + 1 caixa por empresa +
// verba inicial demo p/ os membros. Idempotente (guarda quando já há caixa com empresa_id).
export async function seedFinanceiro() {
  const jaTem = await query(`SELECT id FROM entity_contatesouraria WHERE data->>'empresa_id' IS NOT NULL LIMIT 1`);
  if (jaTem.rows.length) {
    console.log('[seed] Financeiro por empresa já configurado — pulando.');
    return;
  }

  // 1) Backfill empresa_id via obra nos lançamentos financeiros existentes.
  const obras = await query(`SELECT id, data->>'empresa_id' AS eid FROM entity_obra WHERE (data->>'empresa_id') IS NOT NULL`);
  const obraEmp = Object.fromEntries(obras.rows.map((r) => [r.id, r.eid]));
  let back = 0;
  for (const tbl of ['entity_contafinanceira', 'entity_boletopagar', 'entity_movimentacaotesouraria', 'entity_contatesouraria']) {
    const res = await query(`SELECT id, data->>'obra_id' AS obra_id FROM ${tbl} WHERE (data->>'empresa_id') IS NULL AND (data->>'obra_id') IS NOT NULL`).catch(() => ({ rows: [] }));
    for (const r of res.rows) {
      const eid = obraEmp[r.obra_id];
      if (eid) { await query(`UPDATE ${tbl} SET data = data || $2::jsonb WHERE id = $1`, [r.id, JSON.stringify({ empresa_id: eid })]); back++; }
    }
  }

  // 2) Um caixa (ContaTesouraria) por empresa (matriz + membros), se ainda não houver.
  const empresas = await query(`SELECT id, data->>'nome' AS nome, data->>'tipo' AS tipo FROM entity_empresa`);
  const hoje = new Date().toISOString().slice(0, 10);
  for (const e of empresas.rows) {
    const jaCaixa = await query(`SELECT id FROM entity_contatesouraria WHERE data->>'empresa_id' = $1 LIMIT 1`, [e.id]);
    if (jaCaixa.rows.length) continue;
    // Caixa é estrutura (toda empresa precisa de um); o dinheiro dentro dele é
    // que é demonstração. Instalação de cliente começa zerada.
    const saldo = SEED_DEMO ? (e.tipo === 'matriz' ? 2000000 : 100000) : 0;
    await query(`INSERT INTO entity_contatesouraria (id, data, created_by) VALUES ($1, $2::jsonb, 'seed')`,
      [nanoid(), JSON.stringify({
        nome: `Caixa — ${e.nome}`, tipo: 'caixa', empresa_id: e.id,
        saldo_inicial: saldo, saldo_atual: saldo, data_saldo_inicial: hoje,
        permite_saldo_negativo: false, saldo_inicial_bloqueado: false, status: 'ativa',
      })]);
  }

  // 3) Verba inicial p/ cada empresa-membro (a Matriz já "repassou") — só demo.
  //    Numa instalação real, a verba entra pelo repasse feito no sistema.
  const membros = empresas.rows.filter((e) => e.tipo === 'membro');
  if (SEED_DEMO) {
    for (const m of membros) {
      await query(`UPDATE entity_empresa SET data = data || $2::jsonb WHERE id = $1`, [m.id, JSON.stringify({ saldo_verba: 500000 })]);
    }
  }
  console.log(`[seed] Financeiro: backfill ${back} lançamentos + caixa por empresa${SEED_DEMO ? ` + verba demo p/ ${membros.length} membros` : ' (saldos zerados)'}.`);
}

// ───────────── Seed frota (Fase 3 — ativo único) ─────────────
// Unifica Veiculo/Equipamento órfãos no Ativo, faz backfill dos medidores (km/horímetro)
// e garante alguns ativos demo com tarifa (p/ demonstrar o empréstimo). Idempotente.
export async function seedFrota() {
  const jaTem = await query(`SELECT id FROM entity_ativo WHERE (data ? 'km_atual') OR (data ? 'horimetro_atual') LIMIT 1`);
  if (jaTem.rows.length) {
    console.log('[seed] Frota (ativo único) já configurada — pulando.');
    return;
  }

  const insAtivo = async (data) => {
    const id = nanoid();
    await query(`INSERT INTO entity_ativo (id, data, created_by) VALUES ($1, $2::jsonb, 'seed')`, [id, JSON.stringify(data)]);
    return id;
  };

  // 1) Veículos órfãos (sem ativo_id) → Ativo tipo veiculo.
  let migV = 0;
  const veics = await query(`SELECT id, data FROM entity_veiculo WHERE (data->>'ativo_id') IS NULL`).catch(() => ({ rows: [] }));
  for (const r of veics.rows) {
    const v = r.data || {};
    const aid = await insAtivo({
      tipo: 'veiculo', nome: v.modelo || v.placa || 'Veículo', codigo: v.placa || '', placa: v.placa || '',
      marca: v.marca || null, modelo: v.modelo || null, ano: v.ano || null,
      status: (v.status === 'inativo' || v.ativo === false) ? 'inativo' : 'disponivel',
      km_atual: Number(v.km_atual) || 0, horimetro_atual: 0,
      custo_diaria: Number(v.custo_diaria) || 0, custo_hora: 0, veiculo_id: r.id,
    });
    await query(`UPDATE entity_veiculo SET data = data || $2::jsonb WHERE id = $1`, [r.id, JSON.stringify({ ativo_id: aid })]);
    migV++;
  }

  // 2) Equipamentos órfãos → Ativo tipo equipamento/maquina.
  let migE = 0;
  const equis = await query(`SELECT id, data FROM entity_equipamento WHERE (data->>'ativo_id') IS NULL`).catch(() => ({ rows: [] }));
  for (const r of equis.rows) {
    const e = r.data || {};
    const tipo = e.tipo === 'maquinaria' ? 'maquina' : (e.tipo === 'veiculo' ? 'veiculo' : 'equipamento');
    const aid = await insAtivo({
      tipo, nome: e.nome || 'Equipamento', codigo: e.placa || '', placa: e.placa || '',
      status: (e.status === 'aposentado') ? 'inativo' : 'disponivel',
      custo_hora: Number(e.custo_hora) || 0, custo_diaria: Number(e.custo_diaria) || 0,
      consumo_medio: Number(e.consumo_medio) || 0, horimetro_atual: 0, km_atual: 0, equipamento_id: r.id,
    });
    await query(`UPDATE entity_equipamento SET data = data || $2::jsonb WHERE id = $1`, [r.id, JSON.stringify({ ativo_id: aid })]);
    migE++;
  }

  // 3) Backfill dos medidores nos Ativos existentes.
  await query(`UPDATE entity_ativo SET data = jsonb_set(data, '{km_atual}', '0') WHERE NOT (data ? 'km_atual')`);
  await query(`UPDATE entity_ativo SET data = jsonb_set(data, '{horimetro_atual}', '0') WHERE NOT (data ? 'horimetro_atual')`);

  // 4) Garante ativos demo com tarifa + medidor (p/ demonstrar o empréstimo).
  //    Só em demonstração: o cliente cadastra a frota dele.
  const comTarifa = SEED_DEMO
    ? await query(`SELECT id FROM entity_ativo WHERE COALESCE(NULLIF(data->>'custo_hora','')::numeric,0) > 0 OR COALESCE(NULLIF(data->>'custo_diaria','')::numeric,0) > 0 LIMIT 1`).catch(() => ({ rows: [] }))
    : { rows: [1] };
  if (!comTarifa.rows.length) {
    await insAtivo({ tipo: 'maquina', nome: 'Escavadeira CAT 320', codigo: 'MAQ-001', status: 'disponivel', custo_hora: 180, custo_diaria: 0, horimetro_atual: 1200, km_atual: 0 });
    await insAtivo({ tipo: 'maquina', nome: 'Retroescavadeira JCB 3CX', codigo: 'MAQ-002', status: 'disponivel', custo_hora: 140, custo_diaria: 0, horimetro_atual: 800, km_atual: 0 });
    await insAtivo({ tipo: 'veiculo', nome: 'Caminhão Mercedes Atego', codigo: 'FRO-001', placa: 'ABC1D23', status: 'disponivel', custo_hora: 0, custo_diaria: 350, km_atual: 45000, horimetro_atual: 0 });
  }
  console.log(`[seed] Frota: ${migV} veículos + ${migE} equipamentos migrados p/ Ativo; medidores backfilled${SEED_DEMO ? '; ativos demo garantidos' : ''}.`);
}

// ───────────── Seed manutenção do ativo (Fase 3 — consolidação 3→1) ─────────────
// Migra Manutencao/ManutencaoVeiculo/ManutencaoEquipamento → ManutencaoAtivo (por ativo_id,
// usando o vínculo veiculo.ativo_id / equipamento.ativo_id feito no seedFrota). Idempotente.
export async function seedManutencaoAtivo() {
  const jaTem = await query(`SELECT id FROM entity_manutencaoativo LIMIT 1`);
  if (jaTem.rows.length) {
    console.log('[seed] ManutencaoAtivo já populada — pulando.');
    return;
  }

  const veics = await query(`SELECT id, data->>'ativo_id' AS aid FROM entity_veiculo WHERE (data->>'ativo_id') IS NOT NULL`).catch(() => ({ rows: [] }));
  const equis = await query(`SELECT id, data->>'ativo_id' AS aid FROM entity_equipamento WHERE (data->>'ativo_id') IS NOT NULL`).catch(() => ({ rows: [] }));
  const vMap = Object.fromEntries(veics.rows.map((r) => [r.id, r.aid]));
  const eMap = Object.fromEntries(equis.rows.map((r) => [r.id, r.aid]));
  const ats = await query(`SELECT id, data->>'nome' AS nome FROM entity_ativo`);
  const nomeAtivo = Object.fromEntries(ats.rows.map((a) => [a.id, a.nome]));

  const ins = async (d) => { await query(`INSERT INTO entity_manutencaoativo (id, data, created_by) VALUES ($1, $2::jsonb, 'seed')`, [nanoid(), JSON.stringify(d)]); };
  const nn = (v) => (v == null || v === '' ? null : Number(v) || 0);
  let n = 0;

  const man = await query(`SELECT id, data FROM entity_manutencao`).catch(() => ({ rows: [] }));
  for (const r of man.rows) {
    const m = r.data || {}; const aid = vMap[m.veiculo_id]; if (!aid) continue;
    await ins({ ativo_id: aid, ativo_nome: nomeAtivo[aid] || '', tipo: m.tipo || 'corretiva', descricao: m.descricao || null, categoria: m.categoria || null, status: m.status || 'agendada', data_prevista: m.data_entrada || null, data_realizada: m.data_saida || null, medidor_realizado: nn(m.km), custo_pecas: nn(m.valor_pecas) || 0, custo_mao_obra: nn(m.valor_mao_obra) || 0, custo_real: nn(m.valor_total) || 0, oficina: m.oficina || null, origem: 'Manutencao' }); n++;
  }
  const mv = await query(`SELECT id, data FROM entity_manutencaoveiculo`).catch(() => ({ rows: [] }));
  for (const r of mv.rows) {
    const m = r.data || {}; const aid = vMap[m.veiculo_id]; if (!aid) continue;
    await ins({ ativo_id: aid, ativo_nome: nomeAtivo[aid] || '', tipo: m.tipo || 'preventiva', categoria: m.categoria || null, descricao: m.notas || null, status: m.status || 'agendada', data_prevista: m.data_agendamento || null, medidor_previsto: nn(m.km_proximo), custo_estimado: nn(m.custo_estimado) || 0, oficina: m.oficina || null, origem: 'ManutencaoVeiculo' }); n++;
  }
  const me = await query(`SELECT id, data FROM entity_manutencaoequipamento`).catch(() => ({ rows: [] }));
  for (const r of me.rows) {
    const m = r.data || {}; const aid = eMap[m.equipamento_id]; if (!aid) continue;
    await ins({ ativo_id: aid, ativo_nome: nomeAtivo[aid] || '', tipo: m.tipo || 'corretiva', descricao: m.descricao || null, categoria: m.categoria || null, status: m.status || 'agendada', data_prevista: m.data_prevista || m.data_agendamento || null, data_realizada: m.data_realizada || null, custo_real: nn(m.custo_total) || nn(m.custo) || 0, oficina: m.oficina || null, origem: 'ManutencaoEquipamento' }); n++;
  }
  console.log(`[seed] ManutencaoAtivo: ${n} registros migrados das 3 entidades antigas.`);
}

// ───────────── Backfill de escopo dos FILHOS DA OBRA (auditoria 2026-07-01) ─────────────
// As entidades-filho da obra recém-adicionadas ao ESCOPO_POR_EMPRESA precisam ter empresa_id
// carimbado (herdado da obra) para o membro ver os PRÓPRIOS registros. Idempotente.
export async function seedBackfillEscopoObra() {
  const jaTem = await query(`SELECT id FROM entity_apontamentomaoobra WHERE (data->>'empresa_id') IS NULL AND (data->>'obra_id') IS NOT NULL LIMIT 1`).catch(() => ({ rows: [] }));
  if (!jaTem.rows.length) {
    console.log('[seed] Escopo obra-filhos já backfilled — pulando.');
    return;
  }
  const obras = await query(`SELECT id, data->>'empresa_id' AS eid FROM entity_obra WHERE (data->>'empresa_id') IS NOT NULL`);
  const obraEmp = Object.fromEntries(obras.rows.map((r) => [r.id, r.eid]));
  const ents = ['Contrato', 'ContratoObra', 'Medicao', 'MedicaoObra', 'MedicaoContrato', 'BM', 'DiarioObra', 'ReceitaObra', 'RecebimentoPrevisto', 'LancamentoCustoObra', 'NotaFiscal', 'RequisicaoObra', 'ApontamentoMaoObra', 'OrdemCompra', 'RequisicaoCompra', 'ConsolidacaoFinanceiraPorObra', 'DocumentoObra', 'AnexoObra', 'HistoricoObra', 'SolicitacaoCompra', 'Orcamento', 'ContratoVersao', 'ContratoItem', 'ObraColaborador', 'AlocacaoObra', 'ApontamentoHora'];
  let total = 0;
  for (const n of ents) {
    const tbl = 'entity_' + n.toLowerCase();
    const res = await query(`SELECT id, data->>'obra_id' AS obra_id FROM ${tbl} WHERE (data->>'empresa_id') IS NULL AND (data->>'obra_id') IS NOT NULL`).catch(() => ({ rows: [] }));
    for (const r of res.rows) {
      const eid = obraEmp[r.obra_id];
      if (eid) { await query(`UPDATE ${tbl} SET data = data || $2::jsonb WHERE id = $1`, [r.id, JSON.stringify({ empresa_id: eid })]); total++; }
    }
  }
  // Filhos SEM obra_id herdam do pai já escopado (ItemOrcamento←Orcamento, BmItem←BM).
  for (const [tbl, fk, paiTbl] of [['entity_itemorcamento', 'orcamento_id', 'entity_orcamento'], ['entity_bmitem', 'bm_id', 'entity_bm']]) {
    const res = await query(`UPDATE ${tbl} t SET data = t.data || jsonb_build_object('empresa_id', p.data->>'empresa_id') FROM ${paiTbl} p WHERE t.data->>'${fk}' = p.id AND (t.data->>'empresa_id') IS NULL AND (p.data->>'empresa_id') IS NOT NULL`).catch(() => ({ rowCount: 0 }));
    total += res.rowCount || 0;
  }
  console.log(`[seed] Backfill escopo obra-filhos: ${total} registros carimbados com empresa_id.`);
}

// ───────────── Backfill de empresa_id nos USUÁRIOS operacionais (isolamento) ─────────────
// Com o isGlobal fail-closed, um usuário não-admin, sem acesso_global E sem empresa_id
// ficaria invisível (vê nada). Distribui esses usuários "soltos" round-robin nas
// empresas-membro (ordem estável pelo número do e-mail; fallback = índice). Idempotente:
// só toca em quem ainda está sem empresa_id.
export async function seedBackfillUsuariosEmpresa() {
  const membros = await query(`SELECT id FROM entity_empresa WHERE data->>'tipo' = 'membro' ORDER BY created_date ASC`);
  if (!membros.rows.length) { console.log('[seed] Sem empresas-membro — pulando backfill de usuários.'); return; }
  const { rows: soltos } = await query(
    `SELECT id, email FROM auth_users
      WHERE role <> 'admin'
        AND COALESCE(data->>'acesso_global', 'false') <> 'true'
        AND (data->>'empresa_id') IS NULL
      ORDER BY email ASC`,
  );
  if (!soltos.length) { console.log('[seed] Usuários sem empresa: nenhum — pulando.'); return; }
  for (let i = 0; i < soltos.length; i++) {
    const num = parseInt((soltos[i].email.match(/([0-9]+)@/) || [])[1] || String(i + 1), 10);
    const eid = membros.rows[(num - 1) % membros.rows.length].id;
    await query(
      `UPDATE auth_users SET data = COALESCE(data, '{}'::jsonb) || $2::jsonb WHERE id = $1`,
      [soltos[i].id, JSON.stringify({ empresa_id: eid, status: 'ativo' })],
    );
  }
  console.log(`[seed] Backfill usuários sem empresa: ${soltos.length} distribuídos nas ${membros.rows.length} empresas-membro.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedAdmin()
    .then(() => seedEmpresas())
    .then(() => seedEstoque())
    .then(() => seedFinanceiro())
    .then(() => seedFrota())
    .then(() => seedManutencaoAtivo())
    .then(() => seedBackfillEscopoObra())
    .then(() => seedBackfillUsuariosEmpresa())
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

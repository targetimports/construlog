import { store } from '../entityStore.js';
import { query, entityTable } from '../db.js';
import { podeEditarObra } from '../rbac.js';
import processarMovimentacaoEstoque from './processarMovimentacaoEstoque.js';

// Atende uma RequisicaoObra transferindo material para o almoxarifado da OBRA.
// Hierarquia multi-empresa (Obra ← Empresa ← Central): por padrão puxa do
// almoxarifado da EMPRESA da obra; por item pode-se escolher puxar do CENTRAL
// (ex.: quando a empresa está sem saldo). Faz uma transferência por origem.
// NÃO gera financeiro (movimentação interna; custo já entrou via compra).
const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;

export default async function atenderRequisicaoObra({ body, user }) {
  const { requisicao_id, itens = [] } = body || {};
  if (!requisicao_id) throw Object.assign(new Error('requisicao_id obrigatório'), { status: 400 });

  const req = (await store.filter('RequisicaoObra', { id: requisicao_id }))[0];
  if (!req) throw Object.assign(new Error('Requisição não encontrada'), { status: 404 });
  if (req.status === 'BAIXADA') throw Object.assign(new Error('Requisição já foi atendida'), { status: 400 });
  if (req.status === 'CANCELADA') throw Object.assign(new Error('Requisição cancelada'), { status: 400 });
  // Já há material a caminho: só depois de a obra RECEBER é que se pode enviar mais
  // (senão a origem de cada item em trânsito ficaria ambígua na hora de devolver
  // eventual diferença).
  if (req.status === 'EM_TRANSITO') throw Object.assign(new Error('Já há material em trânsito para esta requisição. Aguarde a obra receber antes de enviar mais.'), { status: 400 });

  const obra = (await store.filter('Obra', { id: req.obra_id }))[0];
  if (!obra) throw Object.assign(new Error('Obra da requisição não encontrada'), { status: 404 });
  if (!podeEditarObra(user, obra)) {
    throw Object.assign(new Error('Sem permissão para atender requisições desta obra'), { status: 403 });
  }

  // Locais: destino = almoxarifado da OBRA; origens possíveis = EMPRESA da obra e CENTRAL.
  let destino = req.local_estoque_id ? (await store.filter('LocalEstoque', { id: req.local_estoque_id }))[0] : null;
  if (!destino) {
    destino = (await store.filter('LocalEstoque', { obra_id: req.obra_id, nivel: 'OBRA' }))[0]
      || (await store.filter('LocalEstoque', { obra_id: req.obra_id, tipo: 'OBRA' }))[0];
  }
  if (!destino) throw Object.assign(new Error('A obra não possui almoxarifado (LocalEstoque nível OBRA).'), { status: 400 });

  const central = (await store.filter('LocalEstoque', { nivel: 'CENTRAL' }))[0]
    || (await store.filter('LocalEstoque', { tipo: 'CENTRAL' }))[0];

  let empresaLocal = null;
  if (obra.empresa_id) {
    const locaisEmp = await store.filter('LocalEstoque', { empresa_id: obra.empresa_id }, undefined, 200);
    empresaLocal = locaisEmp.find((l) => (l.nivel || l.tipo) === 'EMPRESA') || null;
  }

  const reqItens = await store.filter('RequisicaoObraItem', { requisicao_id }, undefined, 1000);
  const itemById = Object.fromEntries(reqItens.map((i) => [i.id, i]));

  const linhas = (Array.isArray(itens) ? itens : [])
    .map((l) => ({ ...l, ri: itemById[l.requisicao_item_id] }))
    .filter((l) => l.ri && num(l.quantidade) > 0);
  if (linhas.length === 0) throw Object.assign(new Error('Informe ao menos uma quantidade a enviar.'), { status: 400 });

  // Saldos + custo por local de origem.
  const saldoDe = async (localId) => {
    const rows = localId ? await store.filter('SaldoEstoque', { local_estoque_id: localId }, undefined, 100000) : [];
    const saldo = {}; const custo = {};
    for (const s of rows) { const k = s.insumo_id ?? s.material_id; saldo[k] = num(s.saldo_atual); custo[k] = num(s.custo_unitario_medio); }
    return { saldo, custo };
  };
  const centralS = central ? await saldoDe(central.id) : { saldo: {}, custo: {} };
  const empresaS = empresaLocal ? await saldoDe(empresaLocal.id) : { saldo: {}, custo: {} };

  // Valida ANTES de mover e agrupa por origem escolhida.
  const grupos = { empresa: [], central: [] };
  for (const l of linhas) {
    const ri = l.ri;
    const insumoId = ri.insumo_id || ri.material_id;
    const qtd = r2(l.quantidade);
    const origem = l.origem === 'central' ? 'central' : 'empresa';

    if (origem === 'empresa' && !empresaLocal) {
      throw Object.assign(new Error('A obra não tem almoxarifado de empresa; escolha o Central para os itens.'), { status: 400 });
    }
    if (origem === 'central' && !central) {
      throw Object.assign(new Error('Estoque Central não configurado.'), { status: 400 });
    }

    // Restante a ENVIAR = solicitado − já enviado. `quantidade_enviada` acumula tudo
    // que saiu da origem (em trânsito + já recebido), então isto cobre os dois.
    const restante = num(ri.quantidade_solicitada) - num(ri.quantidade_enviada);
    if (qtd > restante + 0.001) {
      throw Object.assign(new Error(`"${ri.material_nome || 'Material'}": ${qtd} excede o restante da requisição (${r2(restante)}).`), { status: 400 });
    }
    const src = origem === 'central' ? centralS : empresaS;
    const disp = src.saldo[insumoId] || 0;
    if (qtd > disp + 0.001) {
      const nomeOrigem = origem === 'central' ? 'Central' : 'da empresa';
      throw Object.assign(new Error(`"${ri.material_nome || 'Material'}": ${qtd} excede o saldo ${nomeOrigem} (${r2(disp)}).`), { status: 400 });
    }
    grupos[origem].push({
      ri,
      insumo_id: insumoId,
      insumo_nome: ri.material_nome || ri.insumo_nome || null,
      insumo_unidade: ri.material_unidade || ri.insumo_unidade || null,
      qtd,
      custo_unit: src.custo[insumoId] || 0,
      origem_local_id: origem === 'central' ? central.id : empresaLocal.id,
      origem_local_nome: origem === 'central' ? (central.nome || 'Central') : (empresaLocal.nome || 'Empresa'),
    });
  }

  // ENVIO (não é mais entrega): o material SAI da origem agora (deixa de ser da
  // Central/Empresa e não pode ser prometido a outra obra), mas NÃO entra no
  // almoxarifado da obra ainda — fica "em trânsito". Quem credita a obra é o
  // RECEBIMENTO (receberTransferenciaObra), feito pelo responsável da obra, que
  // confere a quantidade. Antes, "Atender" transferia direto, sem conferência.
  // ── TRAVA ANTI-DUPLICAÇÃO (atômica) ──
  // Sem isto, dois cliques concorrentes (duas abas, ou a rede repetindo o POST)
  // passavam os dois pela checagem de status lá em cima e davam SAÍDA de estoque
  // EM DOBRO. Aqui reivindicamos a requisição num único UPDATE condicional: só
  // vence quem troca o status atual por 'PROCESSANDO'. O Postgres serializa o
  // UPDATE na linha, então o segundo recebe 0 linhas e é barrado.
  const claim = await query(
    `UPDATE ${entityTable('RequisicaoObra')}
        SET data = data || '{"status":"PROCESSANDO"}'::jsonb, updated_date = NOW()
      WHERE id = $1 AND COALESCE(data->>'status', '') = $2
      RETURNING id`,
    [requisicao_id, req.status],
  );
  if (!claim.rows[0]) {
    throw Object.assign(new Error('Esta requisição já está sendo atendida (ou mudou de status). Recarregue a página.'), { status: 409 });
  }

  // A partir daqui já mexemos em estoque: se algo falhar, devolvemos o status
  // original para a requisição não ficar presa em 'PROCESSANDO'.
  try {
    const docRef = `REQ ${String(requisicao_id).slice(0, 8)}`;
    const saidaItens = (grupo) => grupo.map(({ insumo_id, insumo_nome, insumo_unidade, qtd, custo_unit }) =>
      ({ insumo_id, insumo_nome, insumo_unidade, qtd, custo_unit }));
    if (grupos.empresa.length) {
      await processarMovimentacaoEstoque({
        body: { tipo: 'SAIDA', origem_local_id: empresaLocal.id, documento_ref: docRef, observacao: `Envio de requisição (empresa → em trânsito) — obra ${obra.nome || ''}`.trim(), itens: saidaItens(grupos.empresa) },
        user,
      });
    }
    if (grupos.central.length) {
      await processarMovimentacaoEstoque({
        body: { tipo: 'SAIDA', origem_local_id: central.id, documento_ref: docRef, observacao: `Envio de requisição (central → em trânsito) — obra ${obra.nome || ''}`.trim(), itens: saidaItens(grupos.central) },
        user,
      });
    }

    // Registra o ENVIADO por item (acumula) + a ORIGEM (para o recebimento devolver a
    // diferença ao lugar certo). quantidade_atendida = o que já ENTROU na obra
    // (recebido) — não muda no envio; muda no recebimento.
    for (const g of [...grupos.empresa, ...grupos.central]) {
      const fresh = (await store.filter('RequisicaoObraItem', { id: g.ri.id }))[0] || g.ri;
      await store.update('RequisicaoObraItem', g.ri.id, {
        quantidade_enviada: r2(num(fresh.quantidade_enviada) + g.qtd),
        origem_local_id: g.origem_local_id,
        origem_local_nome: g.origem_local_nome,
      });
    }

    // Há material a caminho → EM_TRANSITO. Guarda o destino p/ o recebimento creditar.
    await store.update('RequisicaoObra', requisicao_id, {
      status: 'EM_TRANSITO',
      destino_local_id: destino.id,
      destino_local_nome: destino.nome || null,
      data_envio: new Date().toISOString().split('T')[0],
      enviado_por_user_id: user?.email || null,
    });

    return { ok: true, status: 'EM_TRANSITO', requisicao_id, em_transito: true };
  } catch (err) {
    // Solta a trava: devolve o status que estava antes do claim.
    await store.update('RequisicaoObra', requisicao_id, { status: req.status }).catch(() => {});
    throw err;
  }
}

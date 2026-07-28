import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { isGlobal, empresaIdDe } from '../middleware.js';
import { custoMensalistaDaObra } from './maoObraCore.js';
import { custoFrotaPorObra } from './frotaCore.js';

// DRE consolidado por empresa (Fase 2). Membro vê só as obras da própria empresa;
// Matriz (global) vê o consolidado do grupo + a quebra por empresa. Deriva de
// ContaFinanceira (razão único): receber = receita (faturada/recebida), pagar = custo
// (bucketizado por categoria). Conserta o 404 do "Consolidado por Empresa".
const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;

const bucketCusto = (cat) => {
  const s = String(cat || '').toLowerCase();
  // Combustível é custo de OPERAÇÃO e tem linha própria — antes de 'equip' para não
  // ser absorvido por ele (ver getDreObra.js).
  if (/(combust|diesel|gasolina|etanol|arla)/.test(s)) return 'combustivel';
  if (/(material|insumo|compra|obra_material)/.test(s)) return 'materiais';
  if (/(mao|m_o|folha|sal[aá]rio|pessoal|diaria|rh)/.test(s)) return 'mao_obra';
  if (/(equip|m[aá]quina|frota|ve[ií]culo|locac)/.test(s)) return 'equipamentos';
  return 'indiretas';
};

export default async function calcularDREGlobalEmpresa({ user }) {
  requirePermission(user, 'FINANCEIRO_VIEW');

  const [obrasAll, contasAll, empresasAll] = await Promise.all([
    store.filter('Obra', {}, undefined, 5000),
    store.filter('ContaFinanceira', {}, undefined, 100000),
    store.filter('Empresa', {}, 'nome', 1000),
  ]);

  const global = isGlobal(user);
  const minha = empresaIdDe(user);
  const obras = global ? obrasAll : obrasAll.filter((o) => o.empresa_id === minha);
  const obraById = Object.fromEntries(obras.map((o) => [o.id, o]));
  const empresaNome = Object.fromEntries(empresasAll.map((e) => [e.id, e.nome]));

  // Agrega por obra a partir do razão.
  const porObra = {};
  for (const o of obras) {
    porObra[o.id] = {
      obra_id: o.id, obra_nome: o.nome || 'Obra', empresa_id: o.empresa_id || null,
      receita_contratada: num(o.valor_contrato ?? o.valor_contratado ?? o.valor_total ?? 0),
      receita_faturada: 0, receita_recebida: 0, custo_total: 0,
      custos: { materiais: 0, mao_obra: 0, equipamentos: 0, combustivel: 0, indiretas: 0 },
    };
  }
  for (const c of contasAll) {
    const o = porObra[c.obra_id];
    if (!o) continue;
    if (c.tipo === 'receber' && c.status !== 'cancelado') {
      o.receita_faturada += num(c.valor);
      o.receita_recebida += num(c.valor_recebido);
    } else if (c.tipo === 'pagar' && c.status !== 'cancelado') {
      const v = num(c.valor);
      o.custo_total += v;
      o.custos[bucketCusto(c.categoria)] += v;
    }
  }

  // RATEIO DA MÃO DE OBRA MENSALISTA (empréstimo entre empresas do grupo).
  // A folha lança UMA conta a pagar na empresa do CADASTRO do colaborador, com
  // obra_id null — logo ela não entra no laço acima (que só lê conta com obra) e o
  // custo do mensalista ficava fora desta tela por completo.
  // Aqui o custo é atribuído pelas HORAS APONTADAS em cada obra, e como a empresa
  // de cada linha vem de `obra.empresa_id`, o colaborador emprestado a uma obra de
  // outra empresa faz o custo daqueles dias cair na empresa que o usou — que é o
  // rateio gerencial pedido (sem dinheiro trocando de mãos: quem paga continua
  // sendo a empresa do vínculo).
  // Sem dobra: diarista fica FORA do helper (o custo dele já vem da conta a pagar
  // da diária, que tem obra_id e é somada acima).
  await Promise.all(Object.values(porObra).map(async (o) => {
    const mo = await custoMensalistaDaObra(o.obra_id).catch(() => 0);
    if (!mo) return;
    o.custo_total += num(mo);
    o.custos.mao_obra += num(mo);
  }));

  // RATEIO DA FROTA — mesma lógica: o empréstimo de ativo da Matriz não gera título
  // financeiro (não entra no laço de contas acima), mas o custo de uso pertence à
  // obra/empresa que operou o equipamento. Uma consulta só para todas as obras.
  const frotaPorObra = await custoFrotaPorObra().catch(() => ({}));
  for (const [obraId, valor] of Object.entries(frotaPorObra)) {
    const o = porObra[obraId];
    if (!o || !valor) continue;
    o.custo_total += num(valor);
    o.custos.equipamentos += num(valor);
  }

  const lista = Object.values(porObra).map((o) => {
    const lucro_bruto = r2(o.receita_faturada - o.custo_total);
    const margem = o.receita_faturada > 0 ? r2((lucro_bruto / o.receita_faturada) * 100) : 0;
    return { ...o, receita_faturada: r2(o.receita_faturada), receita_recebida: r2(o.receita_recebida), custo_total: r2(o.custo_total), lucro_bruto, margem_percentual: margem };
  });

  // Consolidado.
  const soma = (f) => r2(lista.reduce((s, o) => s + num(f(o)), 0));
  const custos = {
    materiais: soma((o) => o.custos.materiais), mao_obra: soma((o) => o.custos.mao_obra),
    equipamentos: soma((o) => o.custos.equipamentos), combustivel: soma((o) => o.custos.combustivel),
    indiretas: soma((o) => o.custos.indiretas),
  };
  custos.total = r2(custos.materiais + custos.mao_obra + custos.equipamentos + custos.combustivel + custos.indiretas);
  const faturada = soma((o) => o.receita_faturada);
  const lucro_bruto = r2(faturada - custos.total);
  const consolidado = {
    receitas: { contratada: soma((o) => o.receita_contratada), faturada, recebida: soma((o) => o.receita_recebida) },
    custos,
    indicadores: {
      numero_obras: lista.length,
      lucro_bruto,
      margem_percentual: faturada > 0 ? r2((lucro_bruto / faturada) * 100) : 0,
    },
  };

  const comReceita = lista.filter((o) => o.receita_faturada > 0 || o.custo_total > 0);
  const ranking_lucro = [...comReceita].sort((a, b) => b.lucro_bruto - a.lucro_bruto).slice(0, 10);
  const obras_criticas = comReceita.filter((o) => o.receita_faturada > 0 && o.margem_percentual < 5)
    .sort((a, b) => a.margem_percentual - b.margem_percentual);

  // Quebra por empresa (útil para a Matriz consolidar o grupo).
  const porEmpresaMap = {};
  for (const o of lista) {
    const k = o.empresa_id || 'sem_empresa';
    if (!porEmpresaMap[k]) porEmpresaMap[k] = { empresa_id: o.empresa_id, empresa_nome: empresaNome[o.empresa_id] || '—', obras: 0, faturada: 0, custo: 0 };
    porEmpresaMap[k].obras += 1;
    porEmpresaMap[k].faturada = r2(porEmpresaMap[k].faturada + o.receita_faturada);
    porEmpresaMap[k].custo = r2(porEmpresaMap[k].custo + o.custo_total);
  }
  const por_empresa = Object.values(porEmpresaMap).map((e) => ({ ...e, lucro: r2(e.faturada - e.custo) }));

  return { success: true, consolidado, ranking_lucro, obras_criticas, por_empresa, escopo: global ? 'grupo' : 'empresa' };
}

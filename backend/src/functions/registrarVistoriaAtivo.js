import { store } from '../entityStore.js';

// VISTORIA DE ATIVO (frota/máquina) — a prova do estado do equipamento na SAÍDA
// (entrega à obra) e na ENTRADA (devolução à Matriz).
//
// Pedido do cliente (2026-07-17): o empréstimo precisa de conferência com fotos e
// medidor nas duas pontas, para haver comprovante de como o ativo saiu e como voltou
// (avaria, combustível, pneus, acessórios...). É o mesmo princípio da vistoria de
// recebimento de material: quem entrega e quem recebe registram, e a foto resolve a
// discussão depois.
//
// Reaproveita as entidades Vistoria/VistoriaMidia, que existiam vazias no sistema.
// SEM efeito em estoque/financeiro — é camada de documentação.
const num = (v) => Number(v) || 0;

// Itens conferidos por tipo de ativo. Máquina não tem pneu/estepe; veículo não tem
// esteira/implemento. Serve de checklist padrão — o vistoriador marca o estado.
export const CHECKLIST_PADRAO = {
  veiculo: ['Lataria / pintura', 'Pneus e estepe', 'Faróis e lanternas', 'Vidros e retrovisores', 'Interior / bancos', 'Documentos', 'Ferramentas / macaco', 'Nível de combustível'],
  maquina: ['Estrutura / lataria', 'Esteiras ou pneus', 'Implementos / caçamba', 'Vazamentos (óleo/hidráulico)', 'Faróis e sinalização', 'Nível de combustível', 'Horímetro legível'],
};

export default async function registrarVistoriaAtivo({ body, user }) {
  const {
    emprestimo_id, tipo,             // tipo: 'SAIDA' | 'ENTRADA'
    medidor, itens = [], fotos = [], observacao,
    assinatura_url, assinante_nome, assinante_documento,
  } = body || {};

  if (!emprestimo_id) throw Object.assign(new Error('emprestimo_id é obrigatório'), { status: 400 });
  const t = String(tipo || '').toUpperCase();
  if (!['SAIDA', 'ENTRADA'].includes(t)) throw Object.assign(new Error("tipo deve ser 'SAIDA' ou 'ENTRADA'"), { status: 400 });

  const emp = (await store.filter('EmprestimoAtivo', { id: emprestimo_id }))[0];
  if (!emp) throw Object.assign(new Error('Empréstimo não encontrado'), { status: 404 });

  const ativo = emp.ativo_id ? (await store.filter('Ativo', { id: emp.ativo_id }))[0] : null;

  // MEDIDOR NÃO ANDA PARA TRÁS. Sem esta trava, um erro de digitação na vistoria de
  // saída (ex.: 1000 num ativo com 7272 h) vira medidor_saida do empréstimo e depois
  // multiplica a diferença pela tarifa — cobrando da obra milhares de horas que não
  // existiram. Mesma regra já aplicada no abastecimento.
  const ehKm = emp.medidor_tipo === 'km';
  const medidorN = num(medidor);
  if (medidorN > 0) {
    // Saída confere com o cadastro do ativo; entrada confere com a leitura da saída.
    const piso = t === 'SAIDA'
      ? (ehKm ? num(ativo?.km_atual) : num(ativo?.horimetro_atual))
      : num(emp.medidor_saida);
    const ondeVeio = t === 'SAIDA' ? 'atual do ativo' : 'registrada na saída';
    if (piso > 0 && medidorN < piso) {
      throw Object.assign(
        new Error(`A leitura informada (${medidorN}) é menor que a ${ondeVeio} (${piso} ${ehKm ? 'km' : 'h'}). Confira o painel.`),
        { status: 400 },
      );
    }
  }

  // Uma vistoria por ponta: refazer substitui a anterior (evita duplicata quando o
  // usuário corrige algo antes de concluir a liberação/devolução).
  const jaExiste = ((await store.filter('Vistoria', { emprestimo_id, tipo: t })) || [])[0];

  const dados = {
    emprestimo_id,
    emprestimo_numero: emp.numero || null,
    tipo: t,
    ativo_id: emp.ativo_id || null,
    ativo_nome: emp.ativo_nome || ativo?.nome || null,
    obra_id: emp.obra_id || null,
    obra_nome: emp.obra_nome || null,
    empresa_id: emp.empresa_id || null,
    medidor_tipo: emp.medidor_tipo || null,
    medidor: num(medidor),
    itens: Array.isArray(itens) ? itens : [],      // [{ item, estado: 'ok'|'avaria', observacao }]
    fotos: Array.isArray(fotos) ? fotos.filter(Boolean) : [],
    observacao: observacao || null,
    // Assinatura de quem recebeu/devolveu — o comprovante do empréstimo.
    assinatura_url: assinatura_url || null,
    assinante_nome: assinante_nome || null,
    assinante_documento: assinante_documento || null,
    vistoriado_por: user?.email || null,
    data_vistoria: new Date().toISOString(),
  };

  const vistoria = jaExiste
    ? await store.update('Vistoria', jaExiste.id, dados)
    : await store.create('Vistoria', dados, user?.email || null);

  // Fotos também como mídia avulsa (galeria/consulta futura por ativo).
  if (!jaExiste) {
    for (const url of dados.fotos) {
      await store.create('VistoriaMidia', {
        vistoria_id: vistoria.id, emprestimo_id, ativo_id: emp.ativo_id || null,
        tipo: t, url_arquivo: url, empresa_id: emp.empresa_id || null,
      }, user?.email || null).catch(() => {});
    }
  }

  const avarias = dados.itens.filter((i) => String(i?.estado).toLowerCase() === 'avaria').length;
  return { success: true, vistoria_id: vistoria.id, tipo: t, avarias, fotos: dados.fotos.length };
}

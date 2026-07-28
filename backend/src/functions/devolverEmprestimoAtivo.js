import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { liberarAtivoSePossivel } from './viagemCore.js';

// Fase 3 — DEVOLUÇÃO do ativo emprestado. Lê o medidor final (km/horímetro), calcula o
// custo de uso (uso × tarifa, ou dias × diária) e gera uma CONTA A PAGAR da empresa/obra
// tomadora (empresa_id herdado da obra → cai no financeiro/DRE da empresa certa). Atualiza
// o medidor e libera o ativo.
const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;
const hoje = () => new Date().toISOString().slice(0, 10);

export default async function devolverEmprestimoAtivo({ body, user }) {
  requirePermission(user, 'EQUIPAMENTOS_VIEW');
  const { emprestimo_id, medidor_retorno, data_retorno } = body || {};
  if (!emprestimo_id) return { success: false, error: 'emprestimo_id é obrigatório' };

  const emp = (await store.filter('EmprestimoAtivo', { id: emprestimo_id }))[0];
  if (!emp) return { success: false, error: 'Empréstimo não encontrado' };
  if (emp.status !== 'em_uso') return { success: false, error: `Empréstimo não está em uso (${emp.status})` };

  // VISTORIA DE ENTRADA OBRIGATÓRIA: o ativo só volta ao pátio depois de conferido
  // (medidor, fotos, avarias). É o par da vistoria de saída — sem as duas pontas não
  // há como saber se o dano veio da obra.
  const vistoriaEntrada = ((await store.filter('Vistoria', { emprestimo_id, tipo: 'ENTRADA' })) || [])[0];
  if (!vistoriaEntrada) {
    return { success: false, error: 'Faça a vistoria de entrada (medidor, fotos e estado do ativo) antes de concluir a devolução.' };
  }

  // O medidor conferido na vistoria manda sobre o informado à mão.
  const medRet = num(vistoriaEntrada.medidor) || num(medidor_retorno);
  const medSaida = num(emp.medidor_saida);
  if (emp.tarifa_tipo !== 'dia' && medRet < medSaida) {
    return { success: false, error: `Medidor de retorno (${medRet}) menor que o de saída (${medSaida})` };
  }

  const dataRet = data_retorno || hoje();

  // Custo do uso.
  let uso, custo;
  if (emp.tarifa_tipo === 'dia') {
    const d0 = new Date(emp.data_saida || dataRet);
    const d1 = new Date(dataRet);
    uso = Math.max(1, Math.ceil((d1 - d0) / 86400000));
    custo = r2(uso * num(emp.tarifa_valor));
  } else {
    uso = r2(medRet - medSaida);
    custo = r2(uso * num(emp.tarifa_valor));
  }

  const unidade = emp.tarifa_tipo === 'dia' ? 'dia(s)' : (emp.medidor_tipo === 'km' ? 'km' : 'h');

  // RATEIO, NÃO COBRANÇA (cliente, 2026-07-20): o uso do ativo do grupo não gera
  // título financeiro — nenhum dinheiro troca de mãos entre Matriz e empresa-membro.
  // O custo entra na DRE da obra/empresa que usou pelo helper custoFrotaDaObra, que
  // lê o custo_total gravado aqui. Antes isto criava uma ContaFinanceira a pagar de
  // "Matriz (frota do grupo)": dívida fantasma no Contas a Pagar, sem contrapartida
  // a receber do outro lado.
  const avariasEntrada = (vistoriaEntrada.itens || []).filter((i) => String(i?.estado).toLowerCase() === 'avaria').length;

  await store.update('EmprestimoAtivo', emprestimo_id, {
    status: 'devolvido', medidor_retorno: medRet, data_retorno: dataRet,
    uso_calculado: uso, custo_total: custo,
    custo_rateado: true,          // marca que o custo é gerencial, não um título a pagar
    vistoria_entrada_id: vistoriaEntrada.id,
    avarias_na_devolucao: avariasEntrada,
  });

  // Atualiza medidor + disponibilidade do ativo. NÃO marca "disponível" às cegas:
  // o mesmo veículo pode estar numa viagem de transferência em curso, e devolvê-lo
  // ao pátio no papel enquanto ele está na estrada permitiria emprestá-lo de novo.
  if (emp.ativo_id) {
    const patch = { obra_atual_id: null };
    if (emp.medidor_tipo === 'km') patch.km_atual = medRet; else patch.horimetro_atual = medRet;
    await store.update('Ativo', emp.ativo_id, patch);
    await liberarAtivoSePossivel(emp.ativo_id, { ignorarEmprestimoId: emprestimo_id });
  }

  return { success: true, custo_total: custo, uso, unidade, rateado: true, avarias: avariasEntrada };
}

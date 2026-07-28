import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { disponibilidadeDoAtivo, proximoNumeroViagem, TIPO_VIAGEM } from './viagemCore.js';

// TRANSPORTE DE ATIVO — a retroescavadeira em cima do caminhão.
//
// Máquina pesada não vai sozinha para a obra: alguém a leva num caminhão/prancha.
// É a mesma viagem da transferência de material (mesmos estados, mesmo comprovante
// na chegada, mesma tela do motorista) — muda só a carga: em vez de uma lista de
// materiais, o que viaja é o próprio ativo emprestado.
//
// DISTINÇÃO IMPORTANTE: o VEÍCULO que transporta precisa estar livre; a MÁQUINA
// transportada não — ela está justamente sendo entregue, e já foi reservada pelo
// empréstimo. Checar disponibilidade dela aqui bloquearia o próprio transporte.
const num = (v) => Number(v) || 0;

export default async function iniciarViagemTransporteAtivo({ body, user }) {
  requirePermission(user, 'EQUIPAMENTOS_VIEW');

  const { emprestimo_id, veiculo_id, motorista_id, km_saida, observacao, sentido = 'IDA' } = body || {};
  if (!emprestimo_id) return { success: false, error: 'emprestimo_id é obrigatório' };
  if (!veiculo_id) return { success: false, error: 'Selecione o veículo que fará o transporte.' };
  if (!motorista_id) return { success: false, error: 'Selecione o motorista.' };

  const ehRetorno = String(sentido).toUpperCase() === 'RETORNO';

  const emp = (await store.filter('EmprestimoAtivo', { id: emprestimo_id }))[0];
  if (!emp) return { success: false, error: 'Empréstimo não encontrado' };
  // Só se move o que já foi LIBERADO. Empréstimo apenas solicitado ainda pode ser
  // rejeitado pela Matriz — mandar caminhão antes disso é frete perdido.
  if (String(emp.status) !== 'em_uso') {
    return {
      success: false,
      error: emp.status === 'solicitado'
        ? 'Este empréstimo ainda não foi liberado pela Matriz.'
        : `Empréstimo ${emp.status}: não há o que transportar.`,
    };
  }
  // A VOLTA precisa de um sinal de que o uso terminou: ou a obra clicou "encerrar
  // uso", ou já existe a VISTORIA DE ENTRADA (que é feita no ato da retirada).
  if (ehRetorno && !emp.devolucao_solicitada) {
    const vistEntrada = ((await store.filter("Vistoria", { emprestimo_id, tipo: "ENTRADA" })) || [])[0];
    if (!vistEntrada) return { success: false, error: "Faça a vistoria de devolução antes de programar a volta." };
  }
  // A IDA só faz sentido enquanto a máquina não chegou lá.
  if (!ehRetorno && emp.entregue_em) {
    return { success: false, error: 'Este ativo já foi entregue na obra.' };
  }
  if (String(veiculo_id) === String(emp.ativo_id)) {
    return { success: false, error: 'O veículo do transporte não pode ser o próprio ativo transportado.' };
  }

  // Uma viagem por SENTIDO: a máquina pode ir e depois voltar, mas não duas idas.
  const doEmprestimo = (await store.filter('Viagem', { emprestimo_id }, undefined, 100).catch(() => []))
    .filter((v) => v.status !== 'CANCELADA');
  const jaTem = doEmprestimo.find((v) => String(v.sentido || 'IDA') === (ehRetorno ? 'RETORNO' : 'IDA'));
  if (jaTem) return { success: false, error: `Já existe a viagem ${jaTem.numero} para ${ehRetorno ? 'a devolução' : 'a entrega'}.` };
  const abertaAgora = doEmprestimo.find((v) => !['FINALIZADA'].includes(String(v.status)));
  if (abertaAgora) return { success: false, error: `A viagem ${abertaAgora.numero} ainda está em andamento.` };

  // Só o TRANSPORTADOR precisa estar livre.
  const disp = await disponibilidadeDoAtivo(veiculo_id);
  if (!disp.livre) return { success: false, error: disp.motivo };

  const veiculo = (await store.filter('Ativo', { id: veiculo_id }))[0];
  const maquina = emp.ativo_id ? (await store.filter('Ativo', { id: emp.ativo_id }))[0] : null;
  const motorista = (await store.filter('Colaborador', { id: motorista_id }))[0];
  if (!motorista) return { success: false, error: 'Motorista não encontrado' };

  const obra = emp.obra_id ? (await store.filter('Obra', { id: emp.obra_id }))[0] : null;

  const kmAtual = num(veiculo?.km_atual);
  const kmSaida = num(km_saida);
  if (kmSaida > 0 && kmSaida < kmAtual) {
    return { success: false, error: `A leitura informada (${kmSaida}) é menor que o hodômetro do veículo (${kmAtual} km).` };
  }

  const carga = [maquina?.nome || emp.ativo_nome, maquina?.placa || maquina?.codigo]
    .filter(Boolean).join(' · ');

  const viagem = await store.create('Viagem', {
    numero: await proximoNumeroViagem(),
    tipo: TIPO_VIAGEM.TRANSPORTE_ATIVO,
    status: 'PLANEJADA',
    emprestimo_id,
    emprestimo_numero: emp.numero || null,
    sentido: ehRetorno ? 'RETORNO' : 'IDA',
    // Destino inverte na volta: a máquina sai da obra e volta para o pátio.
    // Autossuficiente: o motorista não acessa Obras.
    obra_id: emp.obra_id || null,
    destino_nome: ehRetorno ? 'Pátio / Matriz' : (emp.obra_nome || obra?.nome || 'Obra'),
    destino_endereco: ehRetorno ? null : ([obra?.endereco, obra?.cidade, obra?.estado].filter(Boolean).join(', ') || null),
    origem_nome: ehRetorno ? (emp.obra_nome || obra?.nome || 'Obra') : 'Pátio / Matriz',
    // --- quem transporta ---
    veiculo_id,
    veiculo_nome: veiculo?.nome || veiculo?.codigo || null,
    veiculo_placa: veiculo?.placa || null,
    motorista_id,
    motorista_nome: motorista.nome || null,
    motorista_email: motorista.email || motorista.user_email || null,
    km_saida: kmSaida || kmAtual,
    // --- o que vai em cima ---
    ativo_transportado_id: emp.ativo_id || null,
    ativo_transportado_nome: maquina?.nome || emp.ativo_nome || null,
    itens_resumo: [{ material_nome: carga || 'Ativo', quantidade: 1, unidade: 'un' }],
    observacao: observacao || null,
    eventos: [{
      status: 'PLANEJADA',
      em: new Date().toISOString(),
      por: user?.email || null,
      km: kmSaida || kmAtual || null,
      observacao: observacao || null,
    }],
    empresa_id: null,   // viagem é despesa da Matriz (ver viagemCore.js)
    criado_por: user?.email || null,
  }, user?.email || null);

  // O caminhão sai de circulação; a máquina segue presa ao empréstimo, como já estava.
  await store.update('Ativo', veiculo_id, { status: 'em_uso' }).catch(() => {});
  // Ida e volta em campos separados: a viagem de entrega continua consultável depois
  // que a de devolução é criada.
  await store.update('EmprestimoAtivo', emprestimo_id, ehRetorno ? {
    viagem_retorno_id: viagem.id,
    viagem_retorno_numero: viagem.numero,
  } : {
    viagem_id: viagem.id,
    viagem_numero: viagem.numero,
    transporte_motorista: motorista.nome || null,
    transporte_veiculo: [veiculo?.nome, veiculo?.placa].filter(Boolean).join(' · ') || null,
  }).catch(() => {});

  return { success: true, viagem_id: viagem.id, numero: viagem.numero, status: 'PLANEJADA' };
}

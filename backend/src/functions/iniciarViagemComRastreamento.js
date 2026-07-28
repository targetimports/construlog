import { store } from '../entityStore.js';

// Inicia uma rota do motorista (RotaMotorista): status → em_andamento e marca
// a hora de saída. Usada pelo BotaoIniciarViagem em /MinhasViagens.
//
// Também gera (uma única vez) uma Viagem vinculada (rota_id), para que o
// controle de custo/abastecimento (/ViagensAbastecimentos) seja alimentado
// automaticamente — assim o motorista não precisa cadastrar a viagem duas vezes.
// A criação da Viagem é best-effort: se falhar, não impede o início da rota.

export default async function iniciarViagemComRastreamento({ body, user }) {
  const { rota_id } = body || {};
  if (!rota_id) {
    throw Object.assign(new Error('rota_id é obrigatório'), { status: 400 });
  }

  const rota = await store.update('RotaMotorista', rota_id, {
    status: 'em_andamento',
    data_hora_saida: new Date().toISOString()
  });
  if (!rota) {
    throw Object.assign(new Error('Rota não encontrada'), { status: 404 });
  }

  let viagem = null;
  try {
    const existentes = await store.filter('Viagem', { rota_id }, null, 1);
    if (existentes[0]) {
      viagem = existentes[0];
    } else {
      const agora = new Date().toISOString();
      viagem = await store.create('Viagem', {
        rota_id,
        origem_registro: 'rota',
        status: 'em_andamento',
        motorista_user_id: rota.motorista_email || null,
        motorista_id: rota.motorista_email || null,
        veiculo_id: rota.veiculo_id || null,
        veiculo_placa: rota.veiculo_placa || null,
        saida_real: agora,
        data_saida: agora,
        origem_endereco: rota.endereco_origem || null,
        destino: rota.endereco_destino || null,
        descricao_carga: rota.nome || rota.motivo || null,
        motivo: rota.motivo || null,
        tipo: 'transporte_material'
      }, user?.email || null);
    }
  } catch { /* best-effort: não bloqueia o início da rota */ }

  return { success: true, rota, viagem, message: 'Viagem iniciada! Rastreamento em tempo real ativado.' };
}

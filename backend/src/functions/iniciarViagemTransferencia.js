import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { disponibilidadeDoAtivo, proximoNumeroViagem } from './viagemCore.js';

// Cria a VIAGEM que leva o material de uma transferência até a obra.
//
// É chamada logo depois do envio (atenderRequisicaoObra / recebimento de compra):
// a requisição já está EM_TRANSITO, e a viagem diz QUEM levou e EM QUÊ.
//
// A viagem é autossuficiente de propósito: grava nome e endereço da obra, do local
// de origem e a lista resumida do que vai. O motorista não tem acesso a Obras nem a
// ObraDetalhes (nem deve ter), então se a tela dele dependesse de buscar a obra ele
// veria "sem acesso" no destino da própria entrega.
const num = (v) => Number(v) || 0;

export default async function iniciarViagemTransferencia({ body, user }) {
  requirePermission(user, 'ESTOQUE_VIEW');

  const { requisicao_id, veiculo_id, motorista_id, observacao, km_saida } = body || {};
  if (!requisicao_id) return { success: false, error: 'requisicao_id é obrigatório' };
  if (!veiculo_id) return { success: false, error: 'Selecione o veículo da entrega.' };
  if (!motorista_id) return { success: false, error: 'Selecione o motorista.' };

  const req = (await store.filter('RequisicaoObra', { id: requisicao_id }))[0];
  if (!req) return { success: false, error: 'Transferência não encontrada' };

  // Uma viagem por transferência: refazer só depois de cancelar a anterior.
  const jaTem = (await store.filter('Viagem', { requisicao_id }, undefined, 100).catch(() => []))
    .find((v) => v.status !== 'CANCELADA');
  if (jaTem) return { success: false, error: `Esta transferência já tem a viagem ${jaTem.numero}.` };

  const disp = await disponibilidadeDoAtivo(veiculo_id);
  if (!disp.livre) return { success: false, error: disp.motivo };

  const veiculo = (await store.filter('Ativo', { id: veiculo_id }))[0];
  const motorista = (await store.filter('Colaborador', { id: motorista_id }))[0];
  if (!motorista) return { success: false, error: 'Motorista não encontrado' };

  const obra = req.obra_id ? (await store.filter('Obra', { id: req.obra_id }))[0] : null;
  const origem = req.destino_local_id ? null : null; // origem real vem dos itens (pode ser mais de uma)
  const itens = await store.filter('RequisicaoObraItem', { requisicao_id }, undefined, 1000).catch(() => []);
  const origemNome = itens.find((i) => i.origem_local_nome)?.origem_local_nome || 'Estoque';

  // Hodômetro de saída: não anda para trás (mesma regra da vistoria e do
  // abastecimento — leitura errada aqui contamina o km da viagem e do ativo).
  const kmAtual = num(veiculo?.km_atual);
  const kmSaida = num(km_saida);
  if (kmSaida > 0 && kmSaida < kmAtual) {
    return { success: false, error: `A leitura informada (${kmSaida}) é menor que o hodômetro do veículo (${kmAtual} km).` };
  }

  const viagem = await store.create('Viagem', {
    numero: await proximoNumeroViagem(),
    tipo: 'TRANSFERENCIA',
    status: 'PLANEJADA',
    requisicao_id,
    // --- destino (autossuficiente para a tela do motorista) ---
    obra_id: req.obra_id || null,
    destino_nome: req.obra_nome || obra?.nome || req.destino_local_nome || 'Obra',
    destino_endereco: [obra?.endereco, obra?.cidade, obra?.estado].filter(Boolean).join(', ') || null,
    origem_nome: origemNome,
    // --- veículo e motorista ---
    veiculo_id,
    veiculo_nome: veiculo?.nome || veiculo?.codigo || null,
    veiculo_placa: veiculo?.placa || null,
    motorista_id,
    motorista_nome: motorista.nome || null,
    motorista_email: motorista.email || motorista.user_email || null,
    km_saida: kmSaida || kmAtual,
    // Resumo da carga: o motorista confere o que está levando sem abrir a obra.
    itens_resumo: itens
      .filter((i) => num(i.quantidade_enviada) > 0)
      .map((i) => ({ material_nome: i.material_nome || 'Material', quantidade: num(i.quantidade_enviada), unidade: i.material_unidade || '' })),
    observacao: observacao || null,
    // Primeiro evento da linha do tempo: a viagem sendo planejada. Os demais passos
    // são acrescentados por avancarViagem, cada um com hora, medidor e localização.
    eventos: [{
      status: 'PLANEJADA',
      em: new Date().toISOString(),
      por: user?.email || null,
      km: kmSaida || kmAtual || null,
      observacao: observacao || null,
    }],
    // Despesa da MATRIZ: viagem não é custo da obra (ver viagemCore.js).
    empresa_id: null,
    criado_por: user?.email || null,
  }, user?.email || null);

  // Veículo sai de circulação enquanto a viagem estiver aberta.
  await store.update('Ativo', veiculo_id, { status: 'em_uso' }).catch(() => {});
  await store.update('RequisicaoObra', requisicao_id, {
    viagem_id: viagem.id,
    viagem_numero: viagem.numero,
    motorista_nome: motorista.nome || null,
    veiculo_placa: veiculo?.placa || null,
  }).catch(() => {});

  return { success: true, viagem_id: viagem.id, numero: viagem.numero, status: 'PLANEJADA' };
}

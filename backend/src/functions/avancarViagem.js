import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { PROXIMO_STATUS, liberarAtivoSePossivel } from './viagemCore.js';

// O motorista movendo a viagem pelos estados: PLANEJADA → A_CAMINHO → NO_DESTINO
// → RETORNANDO → FINALIZADA (ou CANCELADA antes de chegar).
//
// NA CHEGADA (NO_DESTINO) o motorista registra a ENTREGA: fotos da carga descarregada
// e a assinatura de quem recebeu. Isso NÃO substitui o recebimento feito pela obra
// (que confere quantidade e material quebrado, e é o que mexe no estoque) — são atos
// diferentes: o motorista prova que ENTREGOU, a obra confere o que CHEGOU. As fotos
// da entrega ficam na mesma requisição, então aparecem juntas na hora de conferir.
const num = (v) => Number(v) || 0;
const agora = () => new Date().toISOString();

export default async function avancarViagem({ body, user }) {
  requirePermission(user, 'LOGISTICA_VIEW');

  const {
    viagem_id, status, km, observacao,
    fotos = [], assinatura_url, recebedor_nome, recebedor_documento,
    motivo_cancelamento,
    latitude, longitude, precisao_gps,   // de onde o passo foi registrado
  } = body || {};

  if (!viagem_id) return { success: false, error: 'viagem_id é obrigatório' };
  const novo = String(status || '').toUpperCase();

  const vg = (await store.filter('Viagem', { id: viagem_id }))[0];
  if (!vg) return { success: false, error: 'Viagem não encontrada' };

  const permitidos = PROXIMO_STATUS[String(vg.status)] || [];
  if (!permitidos.includes(novo)) {
    return { success: false, error: `Não é possível ir de ${vg.status} para ${novo || '(vazio)'}.` };
  }

  // Só o motorista da viagem (ou quem administra a logística) mexe nela.
  const ehDono = [vg.motorista_email, vg.criado_por].filter(Boolean)
    .some((e) => String(e).toLowerCase() === String(user?.email || '').toLowerCase());
  const ehGestor = user?.role !== 'motorista';
  if (!ehDono && !ehGestor) return { success: false, error: 'Esta viagem é de outro motorista.' };

  const patch = { status: novo };
  if (observacao) patch.observacao = [vg.observacao, observacao].filter(Boolean).join('\n');

  // LINHA DO TEMPO — cada passo vira um evento imutável com quando, quem, quanto
  // marcava o hodômetro e de onde foi registrado. É o que permite reconstruir a
  // viagem depois de finalizada (e conferir se o "cheguei" saiu mesmo da obra).
  // A localização é opcional: o navegador pode negar, e isso não pode travar o passo.
  const evento = {
    status: novo,
    em: agora(),
    por: user?.email || null,
    km: num(km) || null,
    observacao: observacao || null,
  };
  if (latitude != null && longitude != null) {
    evento.latitude = Number(latitude);
    evento.longitude = Number(longitude);
    evento.precisao_gps = precisao_gps != null ? Math.round(Number(precisao_gps)) : null;
  }
  patch.eventos = [...(Array.isArray(vg.eventos) ? vg.eventos : []), evento];

  // Hodômetro: nunca para trás (mesma trava da vistoria e do abastecimento).
  const kmN = num(km);
  if (kmN > 0) {
    const piso = num(vg.km_chegada) || num(vg.km_saida);
    if (piso > 0 && kmN < piso) {
      return { success: false, error: `A leitura informada (${kmN}) é menor que a última registrada (${piso} km).` };
    }
  }

  if (novo === 'A_CAMINHO') {
    patch.saiu_em = agora();
    if (kmN > 0) patch.km_saida = kmN;
  }

  if (novo === 'NO_DESTINO') {
    patch.chegou_em = agora();
    if (kmN > 0) patch.km_chegada = kmN;
    // COMPROVANTE DA ENTREGA — pedido do cliente: o motorista registra na chegada.
    patch.fotos_entrega = Array.isArray(fotos) ? fotos.filter(Boolean) : [];
    patch.assinatura_url = assinatura_url || null;
    patch.recebedor_nome = recebedor_nome || null;
    patch.recebedor_documento = recebedor_documento || null;

    if (!patch.fotos_entrega.length && !patch.assinatura_url) {
      return { success: false, error: 'Registre a entrega: pelo menos uma foto ou a assinatura de quem recebeu.' };
    }

    // Espelha o comprovante no documento de origem, para quem receber na obra ver o
    // que o motorista entregou sem precisar abrir outra tela. Transferência de
    // material espelha na requisição; transporte de máquina, no empréstimo.
    const espelho = {
      fotos_entrega: patch.fotos_entrega,
      entregue_por_motorista: vg.motorista_nome || null,
      entregue_em: patch.chegou_em,
      recebedor_nome: patch.recebedor_nome,
    };
    if (vg.requisicao_id) await store.update('RequisicaoObra', vg.requisicao_id, espelho).catch(() => {});
    // Na VOLTA a chegada é no pátio, não na obra: marcar "entregue" ali diria que a
    // máquina acabou de ser entregue à obra — o oposto do que aconteceu.
    if (vg.emprestimo_id && String(vg.sentido || 'IDA') !== 'RETORNO') {
      await store.update('EmprestimoAtivo', vg.emprestimo_id, espelho).catch(() => {});
    }
    if (vg.emprestimo_id && String(vg.sentido) === 'RETORNO') {
      await store.update('EmprestimoAtivo', vg.emprestimo_id, {
        retornou_ao_patio_em: patch.chegou_em,
        fotos_retorno: patch.fotos_entrega,
      }).catch(() => {});
    }
  }

  if (novo === 'RETORNANDO') patch.retorno_em = agora();

  if (novo === 'FINALIZADA') {
    patch.finalizada_em = agora();
    if (kmN > 0) patch.km_retorno = kmN;
    const kmFim = num(patch.km_retorno) || num(vg.km_retorno) || num(vg.km_chegada) || num(vg.km_saida);
    patch.km_percorrido = Math.max(0, kmFim - num(vg.km_saida));
  }

  if (novo === 'CANCELADA') patch.motivo_cancelamento = motivo_cancelamento || null;

  await store.update('Viagem', viagem_id, patch);

  // Hodômetro do VEÍCULO em dia a CADA etapa (não só no fim): a leitura informada
  // agora é a quilometragem real do veículo naquele momento — se ele saiu a
  // 1.050.101 e chegou a 1.050.109, o cadastro tem de refletir 1.050.109 já na
  // chegada, não esperar a finalização. Forward-only (a trava lá em cima garante
  // kmN >= última leitura, e o guard extra protege contra medidor já maior).
  if (vg.veiculo_id && kmN > 0) {
    const veic = (await store.filter('Ativo', { id: vg.veiculo_id }))[0];
    if (veic && kmN > num(veic.km_atual)) {
      await store.update('Ativo', vg.veiculo_id, { km_atual: kmN }).catch(() => {});
    }
  }

  // Fim de linha: devolve o veículo ao pátio — mas só se nada mais o estiver
  // prendendo (pode haver empréstimo aberto). O hodômetro já foi sincronizado
  // acima; aqui garantimos o valor final mesmo quando a finalização não trouxe
  // uma leitura nova (usa a chegada/retorno já registrados).
  if (['FINALIZADA', 'CANCELADA'].includes(novo) && vg.veiculo_id) {
    const kmFinal = num(patch.km_retorno) || num(patch.km_chegada) || num(vg.km_chegada);
    if (kmFinal > 0) {
      const veic = (await store.filter('Ativo', { id: vg.veiculo_id }))[0];
      if (veic && kmFinal > num(veic.km_atual)) {
        await store.update('Ativo', vg.veiculo_id, { km_atual: kmFinal }).catch(() => {});
      }
    }
    await liberarAtivoSePossivel(vg.veiculo_id, { ignorarViagemId: viagem_id });
  }

  return {
    success: true,
    status: novo,
    km_percorrido: patch.km_percorrido ?? null,
    veiculo_liberado: ['FINALIZADA', 'CANCELADA'].includes(novo),
  };
}

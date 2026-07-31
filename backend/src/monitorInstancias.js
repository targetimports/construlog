// VIGILÂNCIA DAS INSTALAÇÕES — quem parou de dar sinal.
//
// O heartbeat só sabe dizer "estou vivo". Se o servidor do cliente morre, ele
// simplesmente para de chegar — e silêncio não dispara nada sozinho. Sem esta
// rotina, o painel mostra "No ar" para sempre com um último contato envelhecendo,
// e você descobre a queda quando o cliente liga reclamando.
//
// Aqui o silêncio vira evento: passou do prazo sem reportar, a instalação é
// marcada como offline, entra no relatório e um alerta é enviado.
//
// ALERTA SÓ NA TRANSIÇÃO. Avisar a cada ciclo enquanto o cliente está fora
// transformaria o alerta em ruído — e ruído é ignorado justamente no dia em que
// importa. Avisa quando cai e avisa quando volta; entre os dois, silêncio.

import { store } from './entityStore.js';
import { sendEmail, emailConfigured, getBranding } from './email.js';
import { enviarWhatsapp, whatsappConfigured } from './whatsapp.js';

// Tolerância antes de declarar queda. O heartbeat é de 30s, então 5 minutos são
// 10 batidas perdidas — folgado o suficiente para não acusar queda por causa de
// um deploy, um reinício de container ou uma oscilação de rede.
const MINUTOS_SILENCIO = Math.max(1, Number(process.env.INSTANCIA_SILENCIO_MIN || 5));

/** Para onde vão os alertas. Sem destino configurado, só registra no log. */
const destinos = () => ({
  email: process.env.ALERTA_EMAIL || process.env.EMAIL_CONTATO || process.env.SMTP_USER || '',
  whatsapp: process.env.ALERTA_WHATSAPP || '',
});

const minutosDesde = (iso) => {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 60000;
};

const fmtDataHora = (iso) => {
  if (!iso) return 'nunca';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'nunca'
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

async function avisar({ caiu, instancia, minutos }) {
  const { email, whatsapp } = destinos();
  const marca = await getBranding();
  const quem = instancia.cliente_nome || instancia.nome || 'instalação';
  const onde = instancia.url || '';

  const assunto = caiu
    ? `[${marca.nome}] ${quem} está fora do ar`
    : `[${marca.nome}] ${quem} voltou ao ar`;

  const linhas = caiu
    ? [
      `A instalação de *${quem}* parou de responder.`,
      '',
      `Último sinal: ${fmtDataHora(instancia.ultimo_heartbeat)} (há ${Math.round(minutos)} min)`,
      onde ? `Endereço: ${onde}` : '',
      '',
      'O sistema do cliente pode estar fora do ar.',
    ]
    : [
      `A instalação de *${quem}* voltou a reportar normalmente.`,
      '',
      onde ? `Endereço: ${onde}` : '',
    ];
  const texto = linhas.filter((l) => l !== '').join('\n');

  const resultados = [];

  if (email && emailConfigured()) {
    const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;color:#16181c">
      <p style="font-size:15px;line-height:1.6">${texto.replace(/\*/g, '').replace(/\n/g, '<br>')}</p>
    </div>`;
    const r = await sendEmail({ to: email, subject: assunto, html });
    resultados.push({ canal: 'email', ok: !!r?.ok });
  }

  if (whatsapp && whatsappConfigured()) {
    const r = await enviarWhatsapp({ telefone: whatsapp, texto: `*${assunto}*\n\n${texto}` });
    resultados.push({ canal: 'whatsapp', ok: !!r?.ok });
  }

  return resultados;
}

/**
 * Varre as instalações e reconcilia o estado com a realidade.
 *
 * A volta ao ar é detectada AQUI e não no heartbeat de propósito: o heartbeat
 * roda no servidor do cliente e não deve carregar a responsabilidade de avisar
 * o fornecedor. Aqui, num lugar só, fica toda a lógica de vigilância.
 */
export async function verificarInstanciasSilenciosas() {
  const instancias = await store.filter('InstanciaCliente', {}, null, 1000).catch(() => []);
  if (!instancias.length) return { ok: true, verificadas: 0 };

  let cairam = 0;
  let voltaram = 0;

  for (const inst of instancias) {
    // Instalação que nunca reportou não "caiu" — nunca esteve no ar. Some do
    // radar até o primeiro heartbeat, senão todo cadastro novo viraria alerta.
    if (!inst.ultimo_heartbeat) continue;
    if (inst.bloqueado === true) continue; // parada por decisão sua, não é queda

    const minutos = minutosDesde(inst.ultimo_heartbeat);
    const silenciosa = minutos > MINUTOS_SILENCIO;
    const estavaOnline = inst.status === 'online';

    if (silenciosa && estavaOnline) {
      await store.update('InstanciaCliente', inst.id, {
        status: 'offline',
        ultimo_erro: `Sem heartbeat há ${Math.round(minutos)} minutos.`,
        offline_desde: new Date().toISOString(),
      });
      await store.create('LogIntegracao', {
        instancia_id: inst.id,
        instancia_nome: inst.nome,
        cliente_id: inst.cliente_id || null,
        cliente_nome: inst.cliente_nome || null,
        tipo: 'monitoramento',
        status: 'offline',
        mudanca_de_estado: true,
        erro: `Sem heartbeat há ${Math.round(minutos)} minutos.`,
        testado_em: new Date().toISOString(),
      }).catch(() => {});

      const enviados = await avisar({ caiu: true, instancia: inst, minutos }).catch(() => []);
      console.warn('[monitor] %s FORA DO AR (sem sinal há %d min). Alertas: %s',
        inst.cliente_nome || inst.nome, Math.round(minutos),
        enviados.map((e) => `${e.canal}:${e.ok ? 'ok' : 'falhou'}`).join(', ') || 'nenhum destino configurado');
      cairam += 1;
      continue;
    }

    // Voltou: o heartbeat já gravou 'online' de novo; aqui só limpamos o rastro
    // e avisamos. A comparação usa offline_desde para não avisar recuperação de
    // quem nunca chegou a ser marcado como fora.
    if (!silenciosa && inst.offline_desde) {
      await store.update('InstanciaCliente', inst.id, {
        offline_desde: null,
        ultimo_erro: null,
      });
      await store.create('LogIntegracao', {
        instancia_id: inst.id,
        instancia_nome: inst.nome,
        cliente_id: inst.cliente_id || null,
        cliente_nome: inst.cliente_nome || null,
        tipo: 'monitoramento',
        status: 'online',
        mudanca_de_estado: true,
        testado_em: new Date().toISOString(),
      }).catch(() => {});

      await avisar({ caiu: false, instancia: inst, minutos }).catch(() => []);
      console.log('[monitor] %s voltou ao ar.', inst.cliente_nome || inst.nome);
      voltaram += 1;
    }
  }

  return { ok: true, verificadas: instancias.length, cairam, voltaram, toleranciaMin: MINUTOS_SILENCIO };
}

export const minutosDeSilencio = () => MINUTOS_SILENCIO;

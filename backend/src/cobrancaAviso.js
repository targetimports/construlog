// AVISO DE VENCIMENTO POR E-MAIL.
//
// Manda um lembrete ao cliente alguns dias antes da mensalidade vencer. É
// opcional POR CLIENTE: só sai para quem tem `cobranca_email: true` no cadastro.
//
// Por que opt-in e não "todos por padrão": e-mail vai para terceiro, em nome do
// fornecedor. Ligar sozinho para a base inteira mandaria cobrança a cliente que
// paga em dia por outro combinado, ou a quem pediu para não receber. Quem decide
// é quem conhece o contrato — a chave está no cadastro do cliente.
//
// São DOIS regimes, com tom e frequência diferentes:
//
//   1. ANTES do vencimento — um único lembrete, DIAS_AVISO dias antes. Cliente
//      que paga em dia não deve ser importunado; um aviso basta.
//   2. DEPOIS do vencimento — todo dia, enquanto seguir em aberto. Aqui já não é
//      lembrete, é cobrança: insistir é o esperado.
//
// Idempotência: `lembrete_enviado_em` trava o aviso prévio (uma vez só) e
// `ultimo_aviso_atraso` guarda a DATA do último aviso de atraso, para sair no
// máximo um por dia. Sem essas travas, o ciclo do agendador (5 min) mandaria
// dezenas de e-mails por dia — cobrar em looping é pior do que não cobrar.

import { store } from './entityStore.js';
import { sendEmail, emailConfigured, getBranding } from './email.js';
import { enviarWhatsapp, whatsappConfigured } from './whatsapp.js';

const DIAS_AVISO = Math.max(0, Number(process.env.COBRANCA_AVISO_DIAS || 3));

// Teto de dias insistindo numa cobrança vencida. 0 = sem limite (o padrão, que é
// o comportamento pedido). Existe como válvula: cliente que sumiu receberia
// e-mail todo dia para sempre, e um endereço morto acumulando rejeição no
// Gmail acaba prejudicando a entrega dos e-mails de quem está ativo.
const MAX_DIAS_ATRASO = Math.max(0, Number(process.env.COBRANCA_ATRASO_MAX_DIAS || 0));

const hojeISO = () => new Date().toISOString().slice(0, 10);
const emDias = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');

const escapar = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

/** Dias entre hoje e uma data ISO (negativo = já passou). */
const diasAte = (dataISO) => Math.round(
  (new Date(`${String(dataISO).slice(0, 10)}T00:00:00`) - new Date(`${hojeISO()}T00:00:00`)) / 86400000,
);

/**
 * Corpo do aviso. O tom muda conforme o prazo: antes do vencimento é lembrete
 * cordial; depois, é cobrança — direta, mas sem agressividade, porque atraso
 * costuma ser esquecimento e o cliente continua sendo cliente.
 */
export function montarEmail({ cliente, cobranca, marca, dias }) {
  const vencida = dias < 0;
  const atraso = Math.abs(dias);

  const quando = vencida
    ? (atraso === 1 ? 'venceu ontem' : `está em atraso há ${atraso} dias`)
    : dias === 0 ? 'vence hoje'
      : dias === 1 ? 'vence amanhã'
        : `vence em ${dias} dias`;

  const assunto = vencida
    ? `${marca.nome} — mensalidade em atraso (${fmtData(cobranca.vencimento)})`
    : `${marca.nome} — sua mensalidade ${quando}`;

  const abertura = vencida
    ? `Identificamos que a mensalidade do <strong>${escapar(marca.nome)}</strong> ${quando} e ainda consta em aberto.`
    : `Passando para lembrar que a mensalidade do <strong>${escapar(marca.nome)}</strong> ${quando}.`;

  const html = `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#16181c">
  <p style="font-size:15px;line-height:1.6">Olá, ${escapar(cliente.responsavel || cliente.nome)}.</p>
  <p style="font-size:15px;line-height:1.6">${abertura}</p>
  <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px">
    <tr>
      <td style="padding:8px 0;color:#6a6e77">Vencimento</td>
      <td style="padding:8px 0;text-align:right"><strong>${fmtData(cobranca.vencimento)}</strong></td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#6a6e77;border-top:1px solid #eceef1">Valor</td>
      <td style="padding:8px 0;text-align:right;border-top:1px solid #eceef1"><strong>${fmtBRL(cobranca.valor)}</strong></td>
    </tr>
    ${cobranca.competencia ? `<tr>
      <td style="padding:8px 0;color:#6a6e77;border-top:1px solid #eceef1">Competência</td>
      <td style="padding:8px 0;text-align:right;border-top:1px solid #eceef1">${escapar(cobranca.competencia)}</td>
    </tr>` : ''}
  </table>
  ${cobranca.url_fatura
    ? `<p style="margin:20px 0"><a href="${escapar(cobranca.url_fatura)}"
         style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px">
         Ver fatura</a></p>`
    : ''}
  <p style="font-size:13px;line-height:1.6;color:#6a6e77">
    ${vencida
      ? 'Se o pagamento já foi feito, desconsidere este aviso — e, se puder, nos envie o comprovante para darmos baixa.'
      : 'Se o pagamento já foi feito, pode desconsiderar este aviso.'}
  </p>
</div>`.trim();

  return { assunto, html };
}

/** Texto do WhatsApp: sem HTML, curto, com o essencial na primeira linha. */
export function montarWhatsapp({ cliente, cobranca, marca, dias }) {
  const vencida = dias < 0;
  const atraso = Math.abs(dias);

  const quando = vencida
    ? (atraso === 1 ? 'venceu ontem' : `está em atraso há ${atraso} dias`)
    : dias === 0 ? 'vence hoje'
      : dias === 1 ? 'vence amanhã'
        : `vence em ${dias} dias`;

  const linhas = [
    `Olá, ${cliente.responsavel || cliente.nome}!`,
    '',
    vencida
      ? `Sua mensalidade do *${marca.nome}* ${quando} e ainda consta em aberto.`
      : `Passando para lembrar: sua mensalidade do *${marca.nome}* ${quando}.`,
    '',
    `Vencimento: ${fmtData(cobranca.vencimento)}`,
    `Valor: ${fmtBRL(cobranca.valor)}`,
  ];
  if (cobranca.url_fatura) linhas.push('', `Fatura: ${cobranca.url_fatura}`);
  linhas.push('', vencida
    ? 'Se já pagou, é só nos mandar o comprovante que damos baixa.'
    : 'Se já pagou, pode desconsiderar.');

  return linhas.join('\n');
}

// OS CANAIS DE COBRANÇA.
//
// Cada um tem a própria chave no cadastro do cliente, o próprio destino e as
// próprias marcas de "já enviei". Manter as marcas separadas é o que impede um
// canal de silenciar o outro: se o e-mail sai e o WhatsApp falha, o WhatsApp
// tenta de novo no ciclo seguinte sem reenviar o e-mail.
const CANAIS = [
  {
    chave: 'email',
    disponivel: () => emailConfigured(),
    ligado: (cli) => cli.cobranca_email === true,
    destino: (cli) => cli.email || '',
    campoPrevio: 'lembrete_enviado_em',
    campoAtraso: 'ultimo_aviso_atraso',
    campoContagem: 'avisos_atraso',
    campoDestino: 'lembrete_email',
    enviar: async ({ cliente, cobranca, marca, dias }) => {
      const { assunto, html } = montarEmail({ cliente, cobranca, marca, dias });
      const r = await sendEmail({ to: cliente.email, subject: assunto, html });
      return { ok: !!r?.ok, erro: r?.error };
    },
  },
  {
    chave: 'whatsapp',
    disponivel: () => whatsappConfigured(),
    ligado: (cli) => cli.cobranca_whatsapp === true,
    destino: (cli) => cli.telefone || '',
    campoPrevio: 'lembrete_zap_em',
    campoAtraso: 'ultimo_zap_atraso',
    campoContagem: 'zaps_atraso',
    campoDestino: 'lembrete_zap_numero',
    enviar: async ({ cliente, cobranca, marca, dias }) => {
      const texto = montarWhatsapp({ cliente, cobranca, marca, dias });
      const r = await enviarWhatsapp({ telefone: cliente.telefone, texto });
      return { ok: !!r?.ok, erro: r?.erro };
    },
  },
];

/** Este canal já enviou o que devia para esta cobrança? */
function jaEnviou(cobranca, canal, vencida, hoje) {
  return vencida
    ? String(cobranca[canal.campoAtraso] || '').slice(0, 10) === hoje  // um por dia
    : !!cobranca[canal.campoPrevio];                                   // o prévio é único
}

/** O que gravar depois de um envio bem-sucedido. */
function marcaDeEnvio(cobranca, canal, vencida, hoje, destino) {
  return vencida
    ? {
      [canal.campoAtraso]: hoje,
      [canal.campoContagem]: Number(cobranca[canal.campoContagem] || 0) + 1,
      [canal.campoDestino]: destino,
    }
    : {
      [canal.campoPrevio]: new Date().toISOString(),
      [canal.campoDestino]: destino,
    };
}

/**
 * Varre as cobranças e manda o que estiver na hora.
 *
 * A janela do lembrete prévio é "de hoje até hoje + N dias", e não "exatamente
 * no dia N": se o servidor ficar fora do ar no dia certo, o aviso ainda sai no
 * dia seguinte em vez de se perder. Cobrança lançada já perto do vencimento
 * também é avisada.
 *
 * Já vencida entra todo dia, enquanto não for paga ou cancelada.
 */
export async function processarAvisosCobranca() {
  const canaisAtivos = CANAIS.filter((c) => c.disponivel());
  if (!canaisAtivos.length) return { ok: false, motivo: 'nenhum_canal_configurado' };

  const limite = emDias(DIAS_AVISO);
  const hoje = hojeISO();

  const cobrancas = await store.filter('Cobranca', {}, '-vencimento', 2000).catch(() => []);
  const emAberto = cobrancas.filter((c) => c.status !== 'pago' && c.status !== 'cancelado' && c.vencimento);

  const aVencer = emAberto.filter((c) => c.vencimento >= hoje && c.vencimento <= limite);
  const vencidas = emAberto.filter((c) => (
    c.vencimento < hoje
    && (MAX_DIAS_ATRASO === 0 || Math.abs(diasAte(c.vencimento)) <= MAX_DIAS_ATRASO)
  ));

  const pendentes = [...aVencer, ...vencidas];
  if (!pendentes.length) return { ok: true, enviados: 0, verificadas: cobrancas.length };

  const clientes = await store.filter('ClienteSaaS', {}, null, 500).catch(() => []);
  const porId = Object.fromEntries(clientes.map((c) => [c.id, c]));
  const marca = await getBranding();

  let previos = 0;
  let atrasos = 0;
  let semDestino = 0;
  let desligados = 0;

  for (const cobranca of pendentes) {
    const cliente = porId[cobranca.cliente_id];
    if (!cliente) continue;

    const dias = diasAte(cobranca.vencimento);
    const vencida = dias < 0;

    // Cada canal decide sozinho se deve enviar: a marca de "já mandei" é por
    // canal. Assim o WhatsApp que falhou não fica preso porque o e-mail saiu.
    for (const canal of canaisAtivos) {
      if (!canal.ligado(cliente)) { desligados += 1; continue; }
      if (!canal.destino(cliente)) { semDestino += 1; continue; }
      if (jaEnviou(cobranca, canal, vencida, hoje)) continue;

      const r = await canal.enviar({ cliente, cobranca, marca, dias });
      if (!r.ok) {
        console.warn('[cobranca-aviso] %s falhou para %s: %s', canal.chave, canal.destino(cliente), r.erro);
        continue; // sem marcar: tenta de novo no próximo ciclo
      }

      await store.update('Cobranca', cobranca.id, marcaDeEnvio(cobranca, canal, vencida, hoje, canal.destino(cliente)));
      if (vencida) atrasos += 1; else previos += 1;
    }
  }

  if (previos || atrasos || desligados || semDestino) {
    console.log('[cobranca-aviso] %d lembrete(s) prévio(s), %d cobrança(s) de atraso; %d canal(is) desligado(s); %d sem destino.',
      previos, atrasos, desligados, semDestino);
  }
  return { ok: true, enviados: previos + atrasos, previos, atrasos, desligados, semDestino, candidatas: pendentes.length };
}

export const diasDeAviso = () => DIAS_AVISO;

/**
 * Envio manual de uma cobrança específica, pelo botão do painel.
 *
 * Ignora a janela de dias (o operador está mandando de propósito) mas respeita
 * a chave do cliente: se ele pediu para não receber e-mail, não é um botão no
 * painel que deve furar isso.
 */
export async function enviarAvisoManual(cobrancaId, { canais } = {}) {
  const [cobranca] = await store.filter('Cobranca', { id: cobrancaId }, null, 1);
  if (!cobranca) return { ok: false, motivo: 'cobranca_nao_encontrada' };
  if (cobranca.status === 'pago') return { ok: false, motivo: 'ja_paga' };
  if (cobranca.status === 'cancelado') return { ok: false, motivo: 'cancelada' };

  const [cliente] = await store.filter('ClienteSaaS', { id: cobranca.cliente_id }, null, 1);
  if (!cliente) return { ok: false, motivo: 'cliente_nao_encontrado' };

  // Sem canal informado, manda por todos os que o cliente aceitou.
  const escolhidos = CANAIS.filter((c) => (!canais || canais.includes(c.chave)) && c.ligado(cliente));
  if (!escolhidos.length) return { ok: false, motivo: 'aviso_desligado' };

  const marca = await getBranding();
  const dias = diasAte(cobranca.vencimento);
  const vencida = dias < 0;
  const hoje = hojeISO();

  const resultados = [];
  for (const canal of escolhidos) {
    if (!canal.disponivel()) { resultados.push({ canal: canal.chave, ok: false, motivo: `${canal.chave}_nao_configurado` }); continue; }
    const destino = canal.destino(cliente);
    if (!destino) { resultados.push({ canal: canal.chave, ok: false, motivo: 'cliente_sem_destino' }); continue; }

    const r = await canal.enviar({ cliente, cobranca, marca, dias });
    if (!r.ok) { resultados.push({ canal: canal.chave, ok: false, motivo: r.erro || 'falha_no_envio' }); continue; }

    await store.update('Cobranca', cobranca.id, marcaDeEnvio(cobranca, canal, vencida, hoje, destino));
    resultados.push({ canal: canal.chave, ok: true, destino });
  }

  const enviados = resultados.filter((r) => r.ok);
  return {
    ok: enviados.length > 0,
    vencida,
    enviados: enviados.map((r) => r.canal),
    destinos: enviados.map((r) => r.destino),
    // Quando nada saiu, o motivo do primeiro canal explica o porquê.
    motivo: enviados.length ? undefined : resultados[0]?.motivo,
    resultados,
  };
}

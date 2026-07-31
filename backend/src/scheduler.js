import { store } from './entityStore.js';
import { query } from './db.js';
import { emailConfigured } from './email.js';
import { enviarAgendamento } from './relatorioAgendado.js';
import { processarAvisosCobranca } from './cobrancaAviso.js';
import { gerarMensalidadesSeForDia } from './cobrancaMensal.js';
import { verificarInstanciasSilenciosas } from './monitorInstancias.js';

let rodando = false;

// Processa todos os RelatorioAgendado ativos cujo proximo_envio já passou.
export async function processarAgendamentosDue() {
  if (rodando) return;            // evita sobreposição se um ciclo demorar
  if (!emailConfigured()) return; // sem e-mail configurado, não dispara nada
  rodando = true;
  try {
    const agora = new Date().toISOString();
    const todos = await store.filter('RelatorioAgendado', {}, '-created_date', 5000).catch(() => []);
    const due = todos.filter((r) => r.ativa !== false && r.proximo_envio && r.proximo_envio <= agora);
    for (const rel of due) {
      try {
        const res = await enviarAgendamento(rel, { avancar: true });
        console.log('[scheduler] %s -> %s', rel.id, res.success ? `enviado (${res.emailsEnviados?.length || 0})` : `falha: ${res.error}`);
      } catch (e) {
        console.error('[scheduler] erro no relatório', rel.id, e.message);
      }
    }
  } finally {
    rodando = false;
  }
}

// Um ciclo do agendador: relatórios agendados + avisos de vencimento.
// Os avisos são idempotentes (marcam `lembrete_enviado_em`), então rodar a cada
// 5 min não manda e-mail repetido — e garante que um servidor que ficou fora do
// ar recupere o aviso assim que voltar.
// Poda dos logs de integração. Mesmo amostrado, o histórico cresce para sempre —
// e relatório de 2 anos atrás não serve para nada. Roda uma vez por dia, não a
// cada ciclo: é DELETE em tabela que só cresce, não precisa de pressa.
const DIAS_RETENCAO_LOG = Math.max(0, Number(process.env.LOG_INTEGRACAO_DIAS || 90));
let ultimaPoda = 0;

async function podarLogsIntegracao() {
  if (!DIAS_RETENCAO_LOG) return;                       // 0 = guardar tudo
  if (Date.now() - ultimaPoda < 24 * 60 * 60 * 1000) return;
  ultimaPoda = Date.now();

  const { rowCount } = await query(
    `DELETE FROM entity_logintegracao WHERE created_date < NOW() - ($1 || ' days')::interval`,
    [String(DIAS_RETENCAO_LOG)],
  );
  if (rowCount) console.log('[scheduler] logs de integração podados: %d linha(s) com mais de %d dias.', rowCount, DIAS_RETENCAO_LOG);
}

async function ciclo() {
  await processarAgendamentosDue().catch((e) => console.error('[scheduler] relatórios:', e?.message));
  // Gerar ANTES de avisar: cobrança criada hoje já entra na varredura de avisos
  // deste mesmo ciclo, em vez de esperar o próximo.
  await gerarMensalidadesSeForDia().catch((e) => console.error('[scheduler] mensalidades:', e?.message));
  await processarAvisosCobranca().catch((e) => console.error('[scheduler] avisos de cobrança:', e?.message));
  await podarLogsIntegracao().catch((e) => console.error('[scheduler] poda de logs:', e?.message));
}

export function startScheduler() {
  const INTERVALO_MS = 5 * 60 * 1000; // verifica a cada 5 min
  setInterval(() => { ciclo().catch(() => {}); }, INTERVALO_MS);
  // Primeira verificação 30s após subir (dá tempo do banco estabilizar).
  setTimeout(() => { ciclo().catch(() => {}); }, 30 * 1000);

  // VIGILÂNCIA em ciclo próprio, de 1 minuto. No ciclo de 5 min, uma queda
  // levaria até 10 minutos para ser percebida (5 de tolerância + 5 de espera) —
  // tempo demais para algo que existe justamente para você saber antes do
  // cliente. Custa uma consulta por minuto.
  const INTERVALO_MONITOR_MS = 60 * 1000;
  setInterval(() => { verificarInstanciasSilenciosas().catch((e) => console.error('[monitor]', e?.message)); }, INTERVALO_MONITOR_MS);
  // Começa depois de 2 min: subiu agora, ninguém teve tempo de reportar ainda.
  setTimeout(() => { verificarInstanciasSilenciosas().catch(() => {}); }, 2 * 60 * 1000);

  console.log('[scheduler] agendador iniciado (relatórios + cobranças a cada 5 min; vigilância das instalações a cada 1 min)');
}

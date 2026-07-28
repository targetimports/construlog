import { store } from './entityStore.js';
import { emailConfigured } from './email.js';
import { enviarAgendamento } from './relatorioAgendado.js';

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

export function startScheduler() {
  const INTERVALO_MS = 5 * 60 * 1000; // verifica a cada 5 min
  setInterval(() => { processarAgendamentosDue().catch(() => {}); }, INTERVALO_MS);
  // Primeira verificação 30s após subir (dá tempo do banco estabilizar).
  setTimeout(() => { processarAgendamentosDue().catch(() => {}); }, 30 * 1000);
  console.log('[scheduler] agendador de relatórios iniciado (ciclo de 5 min)');
}

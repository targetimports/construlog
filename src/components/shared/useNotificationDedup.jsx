import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * Hook para evitar spam de notificações (toasts)
 * Valida se o mesmo alerta já foi notificado nas últimas 24h
 */
export const useNotificationDedup = () => {
  /**
   * Notifica com deduplicação
   * @param {string} fingerprint - Hash único do alerta
   * @param {string} titulo - Título do toast
   * @param {string} mensagem - Mensagem do toast
   * @param {'success'|'error'|'info'|'warning'} tipo - Tipo do toast
   * @returns {Promise<boolean>} true se foi notificado, false se foi dedup
   */
  const notificarComDedup = async (fingerprint, titulo, mensagem, tipo = 'info') => {
    try {
      // Verificar se já foi notificado nas últimas 24h
      const logs = await base44.entities.NotificationLog.filter({
        fingerprint: fingerprint
      });

      const agora = new Date();
      const umDiaAtras = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

      const jaFoiNotificado = logs.some(log => {
        const logData = new Date(log.last_notified_at || log.created_at);
        return logData >= umDiaAtras && log.notificacao_enviada;
      });

      if (jaFoiNotificado) {
        console.log('Notificação bloqueada por dedup (já foi notificado nas últimas 24h)');
        return false;
      }

      // Se não foi notificado, enviar toast e marcar como notificado
      toast[tipo](titulo, { description: mensagem });

      // Atualizar log (ou criar se não existir)
      if (logs.length > 0) {
        const logMaisRecente = logs[logs.length - 1];
        await base44.entities.NotificationLog.update(logMaisRecente.id, {
          last_notified_at: agora.toISOString(),
          notificacao_enviada: true
        });
      }

      console.log('Notificação enviada com sucesso (dedup validado)');
      return true;

    } catch (error) {
      console.error('Erro ao validar dedup de notificação:', error);
      // Falhar aberto: enviar toast mesmo assim
      toast[tipo](titulo, { description: mensagem });
      return true;
    }
  };

  return { notificarComDedup };
};
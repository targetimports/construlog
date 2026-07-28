import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

// Gerenciador de notificações push
export const NotificacoesTarefas = {
  // Solicitar permissão para notificações
  async solicitarPermissao() {
    if (!('Notification' in window)) {
      console.log('Este navegador não suporta notificações');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  },

  // Enviar notificação
  enviar(titulo, opcoes = {}) {
    if (Notification.permission === 'granted') {
      const notification = new Notification(titulo, {
        icon: '/icon.png',
        badge: '/badge.png',
        ...opcoes
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    }
  },

  // Notificar sobre tarefa atrasada
  notificarAtraso(tarefa) {
    this.enviar('Tarefa Atrasada', {
      body: `"${tarefa.titulo}" passou do prazo`,
      tag: `tarefa-${tarefa.id}`,
      requireInteraction: true
    });
  },

  // Notificar sobre prazo próximo
  notificarPrazoProximo(tarefa, dias) {
    this.enviar('Prazo Próximo', {
      body: `"${tarefa.titulo}" vence em ${dias} dia(s)`,
      tag: `tarefa-${tarefa.id}`
    });
  },

  // Notificar sobre nova tarefa atribuída
  notificarNovaTarefa(tarefa) {
    this.enviar('Nova Tarefa Atribuída', {
      body: `"${tarefa.titulo}" foi atribuída a você`,
      tag: `tarefa-${tarefa.id}`
    });
  },

  // Notificar sobre atualização de status
  notificarAtualizacao(tarefa, novoStatus) {
    const statusLabels = {
      pendente: 'Pendente',
      em_andamento: 'Em Andamento',
      concluida: 'Concluída',
      cancelada: 'Cancelada'
    };

    this.enviar('Tarefa Atualizada', {
      body: `"${tarefa.titulo}" agora está: ${statusLabels[novoStatus]}`,
      tag: `tarefa-${tarefa.id}`
    });
  }
};

// Hook para monitorar tarefas e enviar notificações
export function useNotificacoesTarefas(obraId) {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: tarefas = [] } = useQuery({
    queryKey: ['tarefas-campo', obraId],
    queryFn: () => base44.entities.TarefaCampo.filter({ obra_id: obraId }),
    enabled: !!obraId && navigator.onLine,
    refetchInterval: 60000 // Verificar a cada 1 minuto
  });

  useEffect(() => {
    if (!user || !tarefas.length) return;

    // Solicitar permissão na primeira vez
    NotificacoesTarefas.solicitarPermissao();

    // Verificar tarefas do usuário
    const minhasTarefas = tarefas.filter(t => 
      t.responsaveis?.includes(user.email) || t.responsavel === user.email
    );

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    minhasTarefas.forEach(tarefa => {
      if (!tarefa.data_prazo || tarefa.status === 'concluida') return;

      const prazo = new Date(tarefa.data_prazo);
      prazo.setHours(0, 0, 0, 0);
      
      const diffDias = Math.ceil((prazo - hoje) / (1000 * 60 * 60 * 24));

      // Notificar tarefas atrasadas
      if (diffDias < 0 && tarefa.status !== 'cancelada') {
        const jaNotificou = localStorage.getItem(`notif_atraso_${tarefa.id}`);
        if (!jaNotificou || new Date(jaNotificou).toDateString() !== hoje.toDateString()) {
          NotificacoesTarefas.notificarAtraso(tarefa);
          localStorage.setItem(`notif_atraso_${tarefa.id}`, hoje.toISOString());
        }
      }

      // Notificar prazos próximos (1 dia antes)
      if (diffDias === 1) {
        const jaNotificou = localStorage.getItem(`notif_prazo_${tarefa.id}`);
        if (!jaNotificou) {
          NotificacoesTarefas.notificarPrazoProximo(tarefa, 1);
          localStorage.setItem(`notif_prazo_${tarefa.id}`, hoje.toISOString());
        }
      }
    });
  }, [tarefas, user]);
}

export default function NotificacoesTarefasProvider({ children, obraId }) {
  useNotificacoesTarefas(obraId);
  return children;
}
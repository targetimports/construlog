import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

// Criar e registrar inline service worker
const criarServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return null;

  try {
    // Verificar se já existe
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length > 0) {
      return registrations[0];
    }

    // Criar blob com o código do service worker
    const swCode = `
      self.addEventListener('push', (event) => {
        if (!event.data) return;
        
        let notif = {
          title: 'Supervisor IA',
          body: 'Nova notificação',
          icon: '/icon-192x192.png'
        };
        
        try {
          const data = event.data.json();
          notif = { ...notif, ...data };
        } catch (e) {
          notif.body = event.data.text();
        }
        
        event.waitUntil(
          self.registration.showNotification(notif.title, {
            body: notif.body,
            icon: notif.icon,
            tag: notif.tag || 'default',
            requireInteraction: notif.requireInteraction || false,
            data: notif.data || {}
          })
        );
      });

      self.addEventListener('notificationclick', (event) => {
        event.notification.close();
        const url = event.notification.data?.url || '/';
        event.waitUntil(
          clients.matchAll({ type: 'window' }).then(clientList => {
            for (let client of clientList) {
              if (client.url === url) return client.focus();
            }
            return clients.openWindow(url);
          })
        );
      });
    `;

    const blob = new Blob([swCode], { type: 'application/javascript' });
    const swUrl = URL.createObjectURL(blob);

    // Registrar
    const registration = await navigator.serviceWorker.register(swUrl);
    console.log('Service Worker registrado');
    return registration;
  } catch (error) {
    console.error('Erro ao criar SW:', error);
    return null;
  }
};

export const usePushNotifications = () => {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [registrado, setRegistrado] = useState(false);
  const [erro, setErro] = useState(null);

  const temSuporte = () => {
    return 'Notification' in window;
  };

  const solicitarPermissao = async () => {
    try {
      // Solicita permissão de notificação
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        setErro('Permissão negada pelo usuário');
        return false;
      }

      // Criar service worker
      const registration = await criarServiceWorker();

      // Salvar token no usuário
      const user = await base44.auth.me();
      const tokens = user.push_notification_tokens || [];
      const novoToken = `push_${Date.now()}_${Math.random()}`;

      if (!tokens.includes(novoToken)) {
        tokens.push(novoToken);
        await base44.auth.updateMe({
          push_notification_tokens: tokens.slice(-5)
        });
      }

      setRegistrado(true);
      setPushEnabled(true);
      setErro(null);
      toast.success('Notificações ativadas!');
      
      return true;
    } catch (error) {
      console.error('Erro:', error);
      setErro(error.message);
      toast.error('Erro: ' + error.message);
      return false;
    }
  };

  const desativarPush = async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let reg of registrations) {
        await reg.unregister();
      }

      await base44.auth.updateMe({
        push_notification_tokens: []
      });

      setPushEnabled(false);
      setRegistrado(false);
      toast.success('Notificações desativadas');
    } catch (error) {
      console.error('Erro:', error);
      setErro(error.message);
    }
  };

  // Verificar permissão ao montar
  useEffect(() => {
    if (temSuporte() && Notification.permission === 'granted') {
      setPushEnabled(true);
      setRegistrado(true);
    }
  }, []);

  return {
    temSuporte: temSuporte(),
    pushEnabled,
    registrado,
    erro,
    solicitarPermissao,
    desativarPush
  };
};

export default usePushNotifications;
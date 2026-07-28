import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bell, Check, Trash2, UserCheck, UserX, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function NotificationCenter() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: notificacoes = [], isLoading } = useQuery({
    queryKey: ['notificacoes', user?.email],
    queryFn: () => base44.entities.Notificacao.filter({
      destinatario_email: user.email
    }, '-created_date', 50),
    enabled: !!user?.email,
    refetchInterval: 30000 // Atualiza a cada 30 segundos
  });

  const marcarLidaMutation = useMutation({
    mutationFn: (id) => base44.entities.Notificacao.update(id, { lida: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(['notificacoes']);
    }
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.Notificacao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['notificacoes']);
      toast.success('Notificação removida');
    }
  });

  const marcarTodasLidasMutation = useMutation({
    mutationFn: async () => {
      const naoLidas = notificacoes.filter((n) => !n.lida);
      await Promise.all(naoLidas.map((n) =>
      base44.entities.Notificacao.update(n.id, { lida: true })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notificacoes']);
      toast.success('Todas notificações marcadas como lidas');
    }
  });

  const getIcon = (tipo) => {
    switch (tipo) {
      case 'novo_usuario':return <UserPlus className="w-5 h-5 text-blue-600" />;
      case 'usuario_aprovado':return <UserCheck className="w-5 h-5 text-green-600" />;
      case 'usuario_rejeitado':return <UserX className="w-5 h-5 text-red-600" />;
      case 'lembrete_evento':return <Bell className="w-5 h-5 text-orange-600" />;
      default:return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const naoLidas = notificacoes.filter((n) => !n.lida);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        







      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-900">Notificações</h3>
          {naoLidas.length > 0 &&
          <Button
            variant="ghost"
            size="sm"
            onClick={() => marcarTodasLidasMutation.mutate()}
            disabled={marcarTodasLidasMutation.isPending}>

              <Check className="w-4 h-4 mr-1" />
              Marcar todas como lidas
            </Button>
          }
        </div>

        <ScrollArea className="h-[400px]">
          {isLoading ?
          <div className="p-8 text-center text-gray-500">
              Carregando notificações...
            </div> :
          notificacoes.length === 0 ?
          <div className="p-8 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Nenhuma notificação</p>
            </div> :

          <div className="divide-y">
              {notificacoes.map((notif) => {
              const conteudo =
              <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getIcon(notif.tipo)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm text-gray-900">
                          {notif.titulo}
                        </p>
                        <button
                      onClick={(e) => {e.stopPropagation();e.preventDefault();deletarMutation.mutate(notif.id);}}
                      className="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0">

                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {notif.mensagem}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(notif.created_date), {
                        addSuffix: true,
                        locale: ptBR
                      })}
                        </span>
                        {!notif.lida &&
                    <Badge className="bg-blue-100 text-blue-800 text-xs">
                            Nova
                          </Badge>
                    }
                        {notif.link_acao &&
                    <span className="text-xs text-blue-600 font-medium">Ver →</span>
                    }
                      </div>
                    </div>
                  </div>;


              const handleClick = () => {
                if (!notif.lida) marcarLidaMutation.mutate(notif.id);
                setOpen(false);
                if (notif.link_acao) {
                  // link_acao pode ser "SolicitacoesMaquinas" ou "/SolicitacoesVeiculos"
                  const link = notif.link_acao.startsWith('/') ?
                  notif.link_acao :
                  createPageUrl(notif.link_acao);
                  navigate(link);
                }
              };

              return (
                <div
                  key={notif.id}
                  onClick={handleClick}
                  className={`p-4 transition-colors ${notif.link_acao ? 'cursor-pointer' : ''} ${!notif.lida ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}>

                    {conteudo}
                  </div>);

            })}
            </div>
          }
        </ScrollArea>
      </PopoverContent>
    </Popover>);

}
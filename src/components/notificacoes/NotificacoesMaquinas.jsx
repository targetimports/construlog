import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bell, X } from 'lucide-react';

export default function NotificacoesMaquinas() {
  const [notificacaoAtual, setNotificacaoAtual] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  // Se usuário desativou as notificações, não mostra nada
  if (user?.receberNotificacoesMaquinas === false) {
    return null;
  }

  const { data: notificacoes = [] } = useQuery({
    queryKey: ['notificacoes', user?.email],
    queryFn: () => base44.entities.Notificacao.filter({
      destinatario_email: user?.email,
      lida: false
    }),
    enabled: !!user?.email,
    refetchInterval: 5000
  });

  const { data: solicitacoesNaoLidas = [] } = useQuery({
    queryKey: ['solicitacoes-nao-lidas', user?.email],
    queryFn: async () => {
      const todas = await base44.entities.SolicitacaoMaquina.list();
      return todas.filter(s => 
        s.responsavel_superior_email === user?.email && 
        s.status === 'enviado' &&
        !s.supervisor_notificado
      );
    },
    enabled: !!user?.email,
    refetchInterval: 5000
  });

  // Fila de notificações: combina notificações e solicitações
  const filaNotificacoes = [
    ...notificacoes.map(n => ({ tipo: 'notificacao', dados: n })),
    ...solicitacoesNaoLidas.map(s => ({ tipo: 'solicitacao', dados: s }))
  ];

  // Quando há notificações e não há uma sendo exibida, mostra a primeira
  useEffect(() => {
    if (!notificacaoAtual && filaNotificacoes.length > 0) {
      setNotificacaoAtual(filaNotificacoes[0]);
    }
  }, [filaNotificacoes, notificacaoAtual]);

  const marcarComoLida = async (notificacaoId) => {
    try {
      await base44.entities.Notificacao.update(notificacaoId, { lida: true });
      setNotificacaoAtual(null);
    } catch (e) {
      console.error('Erro ao marcar como lida:', e);
    }
  };

  const handleFechar = async () => {
    if (notificacaoAtual?.tipo === 'solicitacao') {
      try {
        await base44.entities.SolicitacaoMaquina.update(
          notificacaoAtual.dados.id,
          { supervisor_notificado: true }
        );
      } catch (e) {
        console.error('Erro ao marcar notificação como vista:', e);
      }
    }
    setNotificacaoAtual(null);
  };

  const handleNotificacao = (notificacao) => {
    marcarComoLida(notificacao.id);
    window.location.href = notificacao.link_acao;
  };

  if (!notificacaoAtual) {
    return null;
  }

  const { tipo, dados } = notificacaoAtual;

  if (tipo === 'notificacao') {
    return (
      <div className="fixed bottom-4 right-4 max-w-sm z-50">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-in slide-in-from-right">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900">{dados.titulo}</h4>
              <p className="text-sm text-blue-700 mt-1">{dados.mensagem}</p>
              <button
                onClick={() => handleNotificacao(dados)}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 mt-2"
              >
                Ver Solicitação →
              </button>
            </div>
            <button
              onClick={() => marcarComoLida(dados.id)}
              className="text-blue-400 hover:text-blue-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 max-w-sm z-50">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 animate-in slide-in-from-right">
        <div className="flex items-start gap-3">
          <Bell className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-amber-900">Solicitação Aguardando Aprovação</h4>
            <p className="text-sm text-amber-700 mt-1">{dados.titulo}</p>
            <p className="text-xs text-amber-600 mt-1">
              {dados.obra_nome} • {dados.tipo_maquina}
            </p>
            <a
              href="/aprovacao-maquinas"
              onClick={handleFechar}
              className="text-xs font-medium text-amber-600 hover:text-amber-800 mt-2 inline-block"
            >
              Revisar Solicitação →
            </a>
          </div>
          <button
            onClick={handleFechar}
            className="text-amber-400 hover:text-amber-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
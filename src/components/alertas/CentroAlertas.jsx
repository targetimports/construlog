import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Trash2, Bell } from 'lucide-react';

export default function CentroAlertas({ obra_id }) {
  const queryClient = useQueryClient();
  const [filtroNivel, setFiltroNivel] = useState('todos');

  // Buscar alertas ativos
  const { data: alertas = [] } = useQuery({
    queryKey: ['alertas', obra_id, filtroNivel],
    queryFn: async () => {
      const query = { obra_id, status: 'ativo' };
      if (filtroNivel !== 'todos') {
        query.nivel = filtroNivel;
      }
      return base44.entities.AlertaDesvio.filter(query);
    }
  });

  // Mutation para desativar alerta
  const desativarAlerta = useMutation({
    mutationFn: async (alertaId) => {
      return base44.entities.AlertaDesvio.update(alertaId, { status: 'resolvido' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertas'] });
    }
  });

  // Mutation para enviar notificações
  const enviarNotificacoes = useMutation({
    mutationFn: async (alertaId) => {
      const user = await base44.auth.me();
      return base44.functions.invoke('enviarNotificacoesAlertas', {
        alerta_id: alertaId,
        emails_destinatarios: [user.email]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertas'] });
    }
  });

  const getNivelColor = (nivel) => {
    const cores = {
      critico: 'bg-red-100 text-red-800 border-red-300',
      aviso: 'bg-yellow-100 text-yellow-800 border-yellow-300'
    };
    return cores[nivel] || 'bg-gray-100 text-gray-800';
  };

  const getTipoIcon = (tipo) => {
    return tipo === 'estoque' ? '' : tipo === 'financeiro' ? '' : '';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Centro de Alertas
          </CardTitle>
          <div className="flex gap-2">
            {['todos', 'critico', 'aviso'].map(nivel => (
              <Button
                key={nivel}
                variant={filtroNivel === nivel ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroNivel(nivel)}
              >
                {nivel === 'todos' ? 'Todos' : nivel === 'critico' ? 'Críticos' : 'Avisos'}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {alertas.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhum alerta ativo</p>
        ) : (
          alertas.map(alerta => (
            <div
              key={alerta.id}
              className={`p-4 border-l-4 rounded ${getNivelColor(alerta.nivel)} space-y-2`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="text-xl">{getTipoIcon(alerta.tipo)}</span>
                  <div>
                    <h4 className="font-semibold">{alerta.titulo}</h4>
                    <p className="text-sm opacity-90">{alerta.descricao}</p>
                    <p className="text-xs opacity-75 mt-1">
                      {new Date(alerta.data).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
                <Badge>{alerta.tipo}</Badge>
              </div>

              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => enviarNotificacoes.mutate(alerta.id)}
                  className="gap-2"
                >
                  <Bell className="w-3 h-3" />
                  Notificar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => desativarAlerta.mutate(alerta.id)}
                  className="text-green-600 hover:text-green-700 gap-2"
                >
                  <CheckCircle className="w-3 h-3" />
                  Resolver
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
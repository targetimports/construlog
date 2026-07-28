import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, AlertTriangle, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AlertasNotificacoes() {
  const [alertas, setAlertas] = useState([]);

  const { data: contratos = [] } = useQuery({
    queryKey: ['contratos'],
    queryFn: async () => {
      try {
        return await base44.entities.Contrato?.list() || [];
      } catch {
        return [];
      }
    }
  });

  const { data: medicoes = [] } = useQuery({
    queryKey: ['medicoes'],
    queryFn: () => base44.entities.Medicao.list()
  });

  const { data: requisicoes = [] } = useQuery({
    queryKey: ['requisicoes'],
    queryFn: async () => {
      try {
        return await base44.entities.RequisicaoCompra?.list() || [];
      } catch {
        return [];
      }
    }
  });

  useEffect(() => {
    const novaAlertas = [];
    const hoje = new Date();

    // Alertas de contratos vencidos
    contratos.forEach(c => {
      if (c.status === 'vencido') {
        novaAlertas.push({
          id: `contrato-${c.id}`,
          tipo: 'contrato',
          nivel: 'alto',
          titulo: 'Contrato Vencido',
          descricao: `Contrato ${c.numero} com ${c.fornecedor_cliente} venceu`,
          acao: 'Renovar Contrato'
        });
      }
    });

    // Alertas de medições pendentes
    medicoes.filter(m => m.status === 'confirmada').forEach(m => {
      novaAlertas.push({
        id: `medicao-${m.id}`,
        tipo: 'medicao',
        nivel: 'medio',
        titulo: 'Medição Pendente de Processamento',
        descricao: `Medição #${m.numero} aguardando processamento`,
        acao: 'Processar'
      });
    });

    // Alertas de requisições pendentes
    requisicoes.filter(r => r.status === 'aguardando').forEach(r => {
      novaAlertas.push({
        id: `req-${r.id}`,
        tipo: 'compra',
        nivel: 'medio',
        titulo: 'Requisição Aguardando Aprovação',
        descricao: `Requisição pendente de aprovação`,
        acao: 'Aprovar'
      });
    });

    setAlertas(novaAlertas);
  }, [contratos, medicoes, requisicoes]);

  const removerAlerta = (id) => {
    setAlertas(alertas.filter(a => a.id !== id));
  };

  const nivelConfig = {
    'alto': { icon: AlertTriangle, color: 'bg-red-100 text-red-800', border: 'border-red-300' },
    'medio': { icon: Clock, color: 'bg-yellow-100 text-yellow-800', border: 'border-yellow-300' },
    'baixo': { icon: CheckCircle2, color: 'bg-green-100 text-green-800', border: 'border-green-300' }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-5 h-5" />
        <h2 className="font-semibold">Alertas e Notificações</h2>
        <Badge className="bg-red-100 text-red-800">{alertas.length}</Badge>
      </div>

      {alertas.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500">
            ✓ Nenhum alerta no momento
          </CardContent>
        </Card>
      ) : (
        alertas.map(alerta => {
          const config = nivelConfig[alerta.nivel];
          const IconComponent = config.icon;
          return (
            <Card key={alerta.id} className={`border-l-4 ${config.border}`}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <IconComponent className="w-5 h-5 mt-1" />
                    <div>
                      <h3 className="font-semibold">{alerta.titulo}</h3>
                      <p className="text-sm text-gray-600">{alerta.descricao}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">{alerta.acao}</Button>
                    <button
                      onClick={() => removerAlerta(alerta.id)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
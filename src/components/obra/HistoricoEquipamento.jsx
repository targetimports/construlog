import React from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusColors = {
  pendente: 'bg-yellow-100 text-yellow-800',
  aprovado: 'bg-green-100 text-green-800',
  rejeitado: 'bg-red-100 text-red-800',
  em_uso: 'bg-blue-100 text-blue-800',
  finalizado: 'bg-gray-100 text-gray-800'
};

const prioridadeColors = {
  baixa: 'bg-blue-100 text-blue-800',
  media: 'bg-yellow-100 text-yellow-800',
  alta: 'bg-orange-100 text-orange-800',
  critica: 'bg-red-100 text-red-800'
};

export default function HistoricoEquipamento({ obraId }) {
  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ['solicitacoes-equipamento', obraId],
    queryFn: () => base44.entities.SolicitacaoEquipamentoObra.filter({ obra_id: obraId })
  });

  if (isLoading) return <div className="p-4">Carregando...</div>;

  return (
    <div className="space-y-3">
      {solicitacoes.length === 0 ? (
        <p className="text-gray-600 text-center py-8">Nenhuma solicitação de equipamento</p>
      ) : (
        solicitacoes.map(sol => (
          <Card key={sol.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold">{sol.equipamento_nome}</h3>
                  <p className="text-sm text-gray-600">{sol.motivo}</p>
                </div>
                <div className="flex gap-2">
                  <Badge className={statusColors[sol.status]}>
                    {sol.status.replace('_', ' ')}
                  </Badge>
                  <Badge className={prioridadeColors[sol.prioridade]}>
                    {sol.prioridade}
                  </Badge>
                </div>
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <strong>Período:</strong> {format(new Date(sol.data_inicio), 'dd/MM/yyyy', { locale: ptBR })} a {format(new Date(sol.data_fim), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
                {sol.data_inicio_real && (
                  <p>
                    <strong>Uso real:</strong> {format(new Date(sol.data_inicio_real), 'dd/MM/yyyy', { locale: ptBR })} a {sol.data_fim_real ? format(new Date(sol.data_fim_real), 'dd/MM/yyyy', { locale: ptBR }) : 'Em andamento'}
                  </p>
                )}
                {sol.custo_total > 0 && (
                  <p><strong>Custo:</strong> R$ {sol.custo_total.toFixed(2)}</p>
                )}
                {sol.motivo_rejeicao && (
                  <p className="text-red-600"><strong>Motivo da rejeição:</strong> {sol.motivo_rejeicao}</p>
                )}
              </div>

              {sol.observacao && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                  <strong>Obs:</strong> {sol.observacao}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
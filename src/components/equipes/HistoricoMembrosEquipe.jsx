import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ChevronDown } from 'lucide-react';

/**
 * Mostra histórico de alterações em membros da equipe
 * Busca em LogAuditoria com acao = 'equipe_add' | 'equipe_remove' | 'equipe_replace'
 */
export default function HistoricoMembrosEquipe({ equipeId }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['historico-equipe', equipeId],
    queryFn: async () => {
      const todosLogs = await base44.entities.LogAuditoria.filter({
        entidade_id: equipeId
      });
      
      // Filtrar apenas ops de membros e ordenar por data desc
      return (todosLogs || [])
        .filter(l => ['ADD', 'REMOVE', 'REPLACE', 'ADD_NOOP', 'ADD_REATIVAR', 'AUTO_REMOVE_EQUIPES'].includes(l.acao))
        .sort((a, b) => new Date(b.data_hora || b.created_date) - new Date(a.data_hora || a.created_date));
    }
  });

  const getTipoOperacao = (acao) => {
    switch (acao) {
      case 'ADD': return { label: 'Adicionado', color: 'bg-green-100 text-green-800' };
      case 'ADD_NOOP': return { label: 'Já membro', color: 'bg-blue-50 text-blue-700' };
      case 'ADD_REATIVAR': return { label: 'Readicionado', color: 'bg-green-100 text-green-800' };
      case 'REMOVE': return { label: 'Removido', color: 'bg-red-100 text-red-800' };
      case 'REPLACE': return { label: 'Substituído', color: 'bg-blue-100 text-blue-800' };
      case 'AUTO_REMOVE_EQUIPES': return { label: 'Auto-removido', color: 'bg-yellow-100 text-yellow-800' };
      default: return { label: acao, color: 'bg-gray-100 text-gray-800' };
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">Nenhuma alteração registrada</p>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {logs.map((log, idx) => {
        const tipo = getTipoOperacao(log.acao);
        const data = new Date(log.data_hora || log.created_date);
        const dataFormatada = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR');
        const isAuto = log.acao === 'AUTO_REMOVE_EQUIPES';

        return (
          <div key={log.id || idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={`text-xs ${tipo.color}`}>
                    {tipo.label}
                  </Badge>
                  {isAuto && (
                    <Badge variant="outline" className="text-xs bg-yellow-50">
                      AUTOMÁTICO
                    </Badge>
                  )}
                </div>
                <p className="text-gray-900 font-medium">
                  {log.dados_novos?.colaborador_id || 'N/A'}
                </p>
                <p className="text-gray-600 text-xs mt-1">
                  {isAuto ? 'Sistema' : log.user_email}
                </p>
                {log.dados_novos?.motivo && (
                  <p className="text-gray-500 text-xs italic mt-1">
                    {log.dados_novos.motivo}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-xs">{dataFormatada}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
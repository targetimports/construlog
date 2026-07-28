import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, User, FileText, AlertCircle } from 'lucide-react';

/**
 * Componente de Histórico de Auditoria
 * 
 * Exibe trilha de alterações para uma entidade específica
 * 
 * Props:
 * - entidade_tipo: string (ex: 'ContaFinanceira', 'OrdemCompra')
 * - entidade_id: string (ID do registro)
 * - limit: number (padrão 20)
 */
export default function HistoricoAuditoria({ entidade_tipo, entidade_id, limit = 20 }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['auditoria', entidade_tipo, entidade_id],
    queryFn: async () => {
      const query = { entidade: entidade_tipo };
      if (entidade_id) {
        query.entidade_id = entidade_id;
      }
      
      const resultado = await base44.entities.LogAuditoria.filter(query, '-created_date', limit);
      return resultado;
    },
    enabled: !!entidade_tipo
  });

  const getAcaoBadge = (acao) => {
    const config = {
      CREATE: { label: 'Criado', className: 'bg-green-100 text-green-800' },
      UPDATE: { label: 'Editado', className: 'bg-blue-100 text-blue-800' },
      DELETE: { label: 'Excluído', className: 'bg-red-100 text-red-800' },
      APPROVE: { label: 'Aprovado', className: 'bg-purple-100 text-purple-800' },
      RECEIVE: { label: 'Recebido', className: 'bg-cyan-100 text-cyan-800' },
      BAIXA: { label: 'Baixa', className: 'bg-emerald-100 text-emerald-800' },
      AUTO: { label: 'Automático', className: 'bg-gray-100 text-gray-800' },
      IMPORT: { label: 'Importado', className: 'bg-indigo-100 text-indigo-800' },
      EXPORT: { label: 'Exportado', className: 'bg-orange-100 text-orange-800' }
    };
    return config[acao] || { label: acao, className: 'bg-gray-100 text-gray-800' };
  };

  const formatarData = (dataISO) => {
    if (!dataISO) return '-';
    try {
      return new Date(dataISO).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dataISO;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-500" />
          Histórico de Alterações
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            Carregando histórico...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            Nenhum registro de auditoria encontrado
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3 pr-4">
              {logs.map((log) => {
                const { label, className } = getAcaoBadge(log.acao);
                
                return (
                  <div key={log.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={className}>{label}</Badge>
                        <span className="text-xs text-gray-500">
                          {formatarData(log.created_date)}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-900 mb-2">{log.detalhes}</p>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {log.user_email || 'Sistema'}
                      </div>
                      {log.modulo && (
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {log.modulo}
                        </div>
                      )}
                    </div>

                    {/* Dados alterados (expandir) */}
                    {(log.dados_anteriores || log.dados_novos) && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-blue-600 hover:underline">
                          Ver detalhes técnicos
                        </summary>
                        <div className="mt-2 bg-gray-100 rounded p-2 text-xs space-y-2">
                          {log.dados_anteriores && (
                            <div>
                              <p className="font-semibold text-gray-700">Antes:</p>
                              <pre className="text-gray-600 overflow-auto">
                                {JSON.stringify(log.dados_anteriores, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.dados_novos && (
                            <div>
                              <p className="font-semibold text-gray-700">Depois:</p>
                              <pre className="text-gray-600 overflow-auto">
                                {JSON.stringify(log.dados_novos, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
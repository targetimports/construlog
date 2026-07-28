import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, CheckCircle2, XCircle, Clock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusConfig = {
  em_andamento: { label: 'Em Andamento', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Play },
  aprovado: { label: 'Aprovado', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
  rejeitado: { label: 'Rejeitado', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: XCircle },
  cancelado: { label: 'Cancelado', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: XCircle }
};

export default function InstanciasAtivas({ instancias, workflows }) {
  const getWorkflow = (workflowId) => workflows.find(w => w.id === workflowId);

  return (
    <div className="space-y-4">
      {instancias.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-12 text-center">
            <Play className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Nenhuma instância ativa</h3>
            <p className="text-gray-500">Workflows serão iniciados automaticamente quando as condições forem atendidas</p>
          </CardContent>
        </Card>
      ) : (
        instancias.map(instancia => {
          const workflow = getWorkflow(instancia.workflow_id);
          const config = statusConfig[instancia.status] || statusConfig.em_andamento;
          const Icon = config.icon;

          return (
            <Card key={instancia.id} className="bg-gray-900 border-gray-800">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={config.color}>
                        <Icon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>
                      <Badge variant="outline" className="text-xs text-gray-400">
                        {instancia.entidade}
                      </Badge>
                    </div>
                    <h3 className="text-white font-semibold text-lg">{workflow?.nome || 'Workflow'}</h3>
                    <p className="text-gray-500 text-sm mt-1">
                      Iniciado por {instancia.iniciado_por} • {new Date(instancia.created_date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>

                {workflow?.etapas && (
                  <div className="space-y-3">
                    <p className="text-gray-400 text-sm">Progresso do Workflow:</p>
                    <div className="space-y-2">
                      {workflow.etapas.map((etapa, idx) => {
                        const isConcluida = idx < instancia.etapa_atual;
                        const isAtual = idx === instancia.etapa_atual;

                        return (
                          <div
                            key={idx}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg",
                              isAtual ? "bg-blue-500/10 border border-blue-500/20" : 
                              isConcluida ? "bg-emerald-500/10 border border-emerald-500/20" :
                              "bg-gray-800 border border-gray-700"
                            )}
                          >
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center font-semibold",
                              isAtual ? "bg-blue-500 text-white" :
                              isConcluida ? "bg-emerald-500 text-white" :
                              "bg-gray-700 text-gray-500"
                            )}>
                              {isConcluida ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                            </div>
                            <div className="flex-1">
                              <p className={cn(
                                "font-medium",
                                isAtual ? "text-blue-400" :
                                isConcluida ? "text-emerald-400" :
                                "text-gray-400"
                              )}>
                                {etapa.nome}
                              </p>
                              <p className="text-xs text-gray-500">
                                {etapa.tipo} • {etapa.aprovadores?.length || 0} aprovador(es) • {etapa.prazo_dias} dias
                              </p>
                            </div>
                            {isAtual && (
                              <Badge className="bg-blue-500 text-white">Atual</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {instancia.historico_aprovacoes && instancia.historico_aprovacoes.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <p className="text-gray-400 text-sm mb-3">Histórico de Aprovações:</p>
                    <div className="space-y-2">
                      {instancia.historico_aprovacoes.slice(-3).map((hist, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-gray-400">{hist.aprovador}</span>
                          <span className="text-gray-600">•</span>
                          <span className="text-gray-500">{hist.acao}</span>
                          {hist.comentario && (
                            <span className="text-gray-600 italic">"{hist.comentario}"</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
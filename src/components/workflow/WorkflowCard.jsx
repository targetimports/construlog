import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Users, ArrowRight } from 'lucide-react';

const tipoConfig = {
  requisicao_compra: { label: 'Requisição de Compra', color: 'bg-blue-500/10 text-blue-400' },
  ordem_compra: { label: 'Ordem de Compra', color: 'bg-purple-500/10 text-purple-400' },
  medicao: { label: 'Medição', color: 'bg-emerald-500/10 text-emerald-400' },
  orcamento: { label: 'Orçamento', color: 'bg-amber-500/10 text-amber-400' },
  acao_corretiva: { label: 'Ação Corretiva', color: 'bg-red-500/10 text-red-400' },
  desvio_consumo: { label: 'Desvio de Consumo', color: 'bg-orange-500/10 text-orange-400' },
  risco: { label: 'Risco', color: 'bg-pink-500/10 text-pink-400' },
  contrato: { label: 'Contrato', color: 'bg-indigo-500/10 text-indigo-400' }
};

export default function WorkflowCard({ workflow }) {
  const config = tipoConfig[workflow.tipo_entidade] || tipoConfig.requisicao_compra;

  return (
    <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-all">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-white mb-2">{workflow.nome}</CardTitle>
            <Badge className={config.color}>{config.label}</Badge>
          </div>
          <Badge variant={workflow.ativo ? "default" : "outline"} className={workflow.ativo ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : ""}>
            {workflow.ativo ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {workflow.descricao && (
          <p className="text-gray-400 text-sm">{workflow.descricao}</p>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>{workflow.etapas?.length || 0} etapas configuradas</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            <span>Prazo total: {workflow.etapas?.reduce((acc, e) => acc + (e.prazo_dias || 0), 0) || 0} dias</span>
          </div>
        </div>

        {workflow.etapas && workflow.etapas.length > 0 && (
          <div className="pt-4 border-t border-gray-800">
            <p className="text-gray-500 text-xs mb-3">Fluxo:</p>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {workflow.etapas.slice(0, 4).map((etapa, idx) => (
                <React.Fragment key={idx}>
                  <div className="flex-shrink-0 px-3 py-2 bg-gray-800 rounded-lg text-xs text-gray-300">
                    {etapa.nome}
                  </div>
                  {idx < Math.min(workflow.etapas.length - 1, 3) && (
                    <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  )}
                </React.Fragment>
              ))}
              {workflow.etapas.length > 4 && (
                <span className="text-gray-600 text-xs">+{workflow.etapas.length - 4}</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, Database } from 'lucide-react';

export default function DiagnosticoImportacao({ obraId }) {
  const { data: diagnostico, isLoading } = useQuery({
    queryKey: ['diagnostico-importacao', obraId],
    queryFn: async () => {
      const res = await base44.functions.invoke('diagnosticarImportacaoObra', {
        obra_id: obraId
      });
      return res.data || res;
    },
    enabled: !!obraId
  });

  if (!diagnostico) return null;

  const isImportado = diagnostico.obra?.importada_orca_facil;
  const temOrcamento = diagnostico.contagem?.orcamento_items > 0;
  const temCronograma = diagnostico.contagem?.cronograma_itens > 0;

  const statusColor = isImportado ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5';
  const statusIcon = isImportado ? (
    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
  ) : (
    <AlertCircle className="w-5 h-5 text-amber-500" />
  );

  return (
    <Card className={`border ${statusColor}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Database className="w-4 h-4" />
          Diagnóstico de Importação (Dev)
        </CardTitle>
        {statusIcon}
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        {/* Status Geral */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-gray-900/50">
            <p className="text-gray-400 mb-1">Status Importação</p>
            <p className="font-semibold">
              {isImportado ? (
                <span className="text-emerald-400">✓ Importado</span>
              ) : (
                <span className="text-amber-400">✗ Pendente</span>
              )}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-gray-900/50">
            <p className="text-gray-400 mb-1">Import Run ID</p>
            <p className="font-mono text-xs truncate">{diagnostico.obra?.import_run_id || '—'}</p>
          </div>
        </div>

        {/* Contagem de Registros */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-gray-900/50">
            <p className="text-gray-400 mb-1">Orçamento Items</p>
            <p className="text-lg font-bold text-white">{diagnostico.contagem?.orcamento_items || 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-gray-900/50">
            <p className="text-gray-400 mb-1">Cronograma Items</p>
            <p className="text-lg font-bold text-white">{diagnostico.contagem?.cronograma_itens || 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-gray-900/50">
            <p className="text-gray-400 mb-1">Orcamento</p>
            <p className="text-lg font-bold text-white">{diagnostico.contagem?.orcamentos || 0}</p>
          </div>
        </div>

        {/* Valores */}
        <div className="p-3 rounded-lg bg-gray-900/50">
          <p className="text-gray-400 mb-1">Total Orçamento</p>
          <p className="text-sm font-mono text-white">
            {(diagnostico.obra?.total_orcamento || 0).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            })}
          </p>
        </div>

        {/* Alertas */}
        <div className="space-y-2">
          {!temOrcamento && isImportado && (
            <Alert className="border-amber-500/30 bg-amber-500/10">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <AlertDescription className="text-amber-400 text-xs">
                Importação marcada, mas sem OrcamentoItems
              </AlertDescription>
            </Alert>
          )}
          {!temCronograma && isImportado && (
            <Alert className="border-amber-500/30 bg-amber-500/10">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <AlertDescription className="text-amber-400 text-xs">
                Importação marcada, mas sem CronogramaItems
              </AlertDescription>
            </Alert>
          )}
          {temOrcamento && temCronograma && (
            <Alert className="border-emerald-500/30 bg-emerald-500/10">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <AlertDescription className="text-emerald-400 text-xs">
                ✓ Dados de orçamento e cronograma carregados corretamente
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
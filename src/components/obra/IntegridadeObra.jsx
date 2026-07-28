import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, RotateCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * Componente de Integridade da Obra
 * Verifica se todos os dados foram salvos corretamente no banco
 * Mostra status de: Orçamento, Cronograma, Itens Planejados
 */
export default function IntegridadeObra({ obraId, onReprocessarNeeded }) {
  const [status, setStatus] = useState('loading');
  const [dados, setDados] = useState(null);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    verificarIntegridade();
  }, [obraId]);

  const verificarIntegridade = async () => {
    try {
      setStatus('loading');

      // Buscar OrcamentoPlanejado
      const orcs = await base44.entities.OrcamentoPlanejado.filter({ obraId });
      const temOrcamento = orcs && orcs.length > 0;

      // Buscar CronogramaItem
      const cronogramas = await base44.entities.CronogramaItem.filter({ obraId });
      const temCronograma = cronogramas && cronogramas.length > 0;

      // Buscar PlannedCostItem
      const itens = await base44.entities.PlannedCostItem.filter({ obraId });
      const temItens = itens && itens.length > 0;

      const todosOk = temOrcamento && temCronograma && temItens;

      setDados({
        orcamento: {
          ok: temOrcamento,
          valor: temOrcamento ? orcs[0].total_geral : 0,
          count: temOrcamento ? 1 : 0
        },
        cronograma: {
          ok: temCronograma,
          count: cronogramas?.length || 0
        },
        itensPlaj: {
          ok: temItens,
          count: itens?.length || 0
        }
      });

      setStatus(todosOk ? 'ok' : 'alerta');
    } catch (err) {
      console.error('Erro ao verificar integridade:', err);
      setStatus('erro');
      setDados(null);
    }
  };

  const handleReprocessar = async () => {
    setProcessando(true);
    try {
      toast.info('Reprocessando importação...');
      if (onReprocessarNeeded) {
        await onReprocessarNeeded();
      }
      setTimeout(() => verificarIntegridade(), 1000);
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setProcessando(false);
    }
  };

  if (status === 'loading') {
    return <div className="text-sm text-gray-500">Verificando integridade...</div>;
  }

  if (!dados) {
    return null;
  }

  const todosOk = dados.orcamento.ok && dados.cronograma.ok && dados.itensPlaj.ok;

  return (
    <Card className={todosOk ? 'border-green-300 bg-green-50' : 'border-yellow-300 bg-yellow-50'}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {todosOk ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
          )}
          Integridade da Obra
        </CardTitle>
        <CardDescription>
          {todosOk ? 'Todos os dados foram salvos corretamente' : 'Alguns dados estão faltando'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Orçamento */}
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Orçamento Planejado</span>
          {dados.orcamento.ok ? (
            <span className="text-green-700 font-semibold">
              R$ {dados.orcamento.valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
            </span>
          ) : (
            <span className="text-yellow-700 font-semibold">Faltando</span>
          )}
        </div>

        {/* Cronograma */}
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Cronograma</span>
          {dados.cronograma.ok ? (
            <span className="text-green-700 font-semibold">
              {dados.cronograma.count} atividades
            </span>
          ) : (
            <span className="text-yellow-700 font-semibold">Faltando</span>
          )}
        </div>

        {/* Itens Planejados */}
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Itens Planejados</span>
          {dados.itensPlaj.ok ? (
            <span className="text-green-700 font-semibold">
              {dados.itensPlaj.count} itens
            </span>
          ) : (
            <span className="text-yellow-700 font-semibold">Faltando</span>
          )}
        </div>

        {!todosOk && (
          <Alert className="mt-4 border-yellow-400 bg-yellow-100">
            <AlertDescription className="text-yellow-800 text-xs">
              Faltam dados salvos. Execute a ação de reprocessamento abaixo.
            </AlertDescription>
          </Alert>
        )}

        {!todosOk && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleReprocessar}
            disabled={processando}
            className="w-full gap-2"
          >
            <RotateCw className="w-4 h-4" />
            {processando ? 'Processando...' : 'Reprocessar Importação'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
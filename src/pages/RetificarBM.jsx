/**
 * RetificarBM: Tela de retificação com preview
 */

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import RouteGuardWithFallback from '@/components/layout/RouteGuardWithFallback';

export default function RetificarBMPage() {
  return (
    <RouteGuardWithFallback requiredPermissionKey="MEDICOES_EDIT">
      <RetificarBMContent />
    </RouteGuardWithFallback>
  );
}

function RetificarBMContent() {
  const urlParams = new URLSearchParams(window.location.search);
  const bmId = urlParams.get('bm_id');
  const [motivo, setMotivo] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // Buscar BM
  const { data: bm, isLoading: bmLoading, error: bmError } = useQuery({
    queryKey: ['bm', bmId],
    queryFn: () => base44.entities.BM.filter({ id: bmId }).then(r => r?.[0]),
    enabled: !!bmId,
  });

  // Buscar itens
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['bmItems', bmId],
    queryFn: () => base44.entities.BMItem.filter({ bm_id: bmId }) || [],
    enabled: !!bmId && !bmLoading,
  });

  // Buscar ContratoItems para referência
  const { data: contratoItems = [] } = useQuery({
    queryKey: ['contratoItems', bm?.contrato_versao_id],
    queryFn: () => base44.entities.ContratoItem.filter({
      contrato_versao_id: bm.contrato_versao_id,
    }) || [],
    enabled: !!bm?.contrato_versao_id,
  });

  // Mutation retificar
  const retificarMutation = useMutation({
    mutationFn: () => base44.functions.invoke('retificarBM', {
      bm_id: bmId,
      motivo_retificacao: motivo,
    }),
    onSuccess: (response) => {
      toast.success(`BM retificada! Nova BM #${response.data.numero_novo} criada.`);
      setShowConfirm(false);
      // Redirecionar para nova BM após delay
      setTimeout(() => {
        window.location.href = `?page=BMDetalhes&bm_id=${response.data.bm_nova_id}`;
      }, 1500);
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  if (!bmId) {
    return (
      <div className="text-center text-gray-600 py-10">
        BM ID não fornecido.
      </div>
    );
  }

  if (bmLoading || itemsLoading) {
    return <Skeleton className="h-96" />;
  }

  if (bmError) {
    return (
      <div className="text-center text-red-600 py-10">
        Erro: {bmError.message}
      </div>
    );
  }

  if (!bm) {
    return (
      <div className="text-center text-gray-600 py-10">
        BM não encontrada.
      </div>
    );
  }

  if (bm.status !== 'APROVADA') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="w-5 h-5" />
          <p>Apenas BMs APROVADAS podem ser retificadas.</p>
        </div>
        <Button onClick={() => window.history.back()} variant="outline">
          Voltar
        </Button>
      </div>
    );
  }

  const contratoItemsById = Object.fromEntries(contratoItems.map(ci => [ci.id, ci]));

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Retificar BM #{bm.numero}</h1>
          <p className="text-sm text-gray-600">
            Uma nova BM será criada como RASCUNHO. A original será marcada como RETIFICADA.
          </p>
        </div>
      </div>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Resumo da BM Atual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-600 mb-1">Total Acumulado</p>
              <p className="font-bold text-lg">R$ {(bm.total_acumulado || 0).toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-600 mb-1">Saldo</p>
              <p className="font-bold text-lg">R$ {(bm.total_saldo || 0).toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-600 mb-1">% Concluída</p>
              <p className="font-bold text-lg">{(bm.percent_concluida || 0).toFixed(1)}%</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-600 mb-1">Itens</p>
              <p className="font-bold text-lg">{items.length}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">Itens da BM</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-1 text-left">Código</th>
                    <th className="px-2 py-1 text-right">Qtd Período</th>
                    <th className="px-2 py-1 text-right">Qtd Acumulada</th>
                    <th className="px-2 py-1 text-right">Valor Período</th>
                    <th className="px-2 py-1 text-right">Valor Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const ci = contratoItemsById[item.contrato_item_id];
                    return (
                      <tr key={item.id} className="border-b">
                        <td className="px-2 py-1">{ci?.item_codigo}</td>
                        <td className="px-2 py-1 text-right">{(item.qtd_periodo_final || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">{(item.qtd_acumulada || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">R$ {(item.vl_periodo || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">R$ {(item.vl_acumulado || 0).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Motivo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Motivo da Retificação</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: Ajuste de quantidade conforme levantamento de campo..."
            className="h-24"
          />
        </CardContent>
      </Card>

      {/* Confirmação */}
      {!showConfirm && (
        <div className="flex gap-3">
          <Button onClick={() => window.history.back()} variant="outline">
            Cancelar
          </Button>
          <Button
            onClick={() => setShowConfirm(true)}
            className="gap-2 bg-orange-600 hover:bg-orange-700"
          >
            <AlertTriangle className="w-4 h-4" />
            Retificar BM
          </Button>
        </div>
      )}

      {showConfirm && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-sm text-orange-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Retificação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-orange-800">
              Esta ação irá:
            </p>
            <ul className="text-sm text-orange-800 space-y-1 list-disc list-inside">
              <li>Marcar a BM atual #{bm.numero} como RETIFICADA</li>
              <li>Criar nova BM #{bm.numero + 1} como RASCUNHO</li>
              <li>Recalcular todas as BMs posteriores</li>
              <li>Registrar auditoria com motivo</li>
            </ul>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => setShowConfirm(false)}
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => retificarMutation.mutate()}
                disabled={retificarMutation.isPending}
                className="gap-2 bg-red-600 hover:bg-red-700"
              >
                <CheckCircle className="w-4 h-4" />
                {retificarMutation.isPending ? 'Processando...' : 'Confirmar Retificação'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-800">
        <strong>Retificação:</strong> Use para corrigir erros em BMs já aprovadas. Cria nova BM baseada na anterior.
        Útil para ajustes de quantidade, valor ou qualidade após levantamento de campo.
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function RunOperationWithSnapshot({ autoCheckpoint = true }) {
  const [loading, setLoading] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState(null);

  const [selectedAction, setSelectedAction] = useState('PAGAR_CONTA');

  const createSnapshot = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('exportarSnapshotLight', {});
      if (res.data?.ok) {
        setLastSnapshot(res.data);
        toast.success(`✓ Snapshot criado: ${res.data.snapshot_id.substring(0, 8)}...`);
      }
    } catch (e) {
      toast.error('Erro ao criar snapshot');
    }
    setLoading(false);
  };

  const executeOperation = async (actionName) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('executarOperacaoComSnapshot', {
        acao: actionName,
        auto_checkpoint: autoCheckpoint,
        reason: 'User action via UI'
      });
      
      if (res.data?.ok) {
        toast.success(`✓ ${actionName} executado com snapshot pré-criado`);
        if (res.data?.pre_snapshot_id) {
          setLastSnapshot({
            snapshot_id: res.data.pre_snapshot_id,
            ...res.data
          });
        }
      } else {
        toast.error(res.data?.error || 'Operação bloqueada');
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          Auto Snapshot & Operações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Auto Checkpoint: {autoCheckpoint ? 'ON' : 'OFF'}</p>
          <Button onClick={createSnapshot} disabled={loading} variant="outline" className="w-full">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar Snapshot LIGHT Manual
          </Button>
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-semibold mb-3">Operações com Auto Checkpoint:</p>
          <div className="grid gap-2">
            <Button 
              onClick={() => executeOperation('PAGAR_CONTA')}
              disabled={loading}
              variant="outline"
              className="justify-start"
            >
              Pagar Conta
            </Button>
            <Button 
              onClick={() => executeOperation('FATURAR_MEDICAO_OBRA')}
              disabled={loading}
              variant="outline"
              className="justify-start"
            >
              Faturar Medicação Obra
            </Button>
            <Button 
              onClick={() => executeOperation('FATURAR_MEDICAO_CONTRATO')}
              disabled={loading}
              variant="outline"
              className="justify-start"
            >
              Faturar Medicação Contrato
            </Button>
          </div>
        </div>

        {lastSnapshot && (
          <div className="p-4 bg-blue-50 rounded border border-blue-200">
            <div className="text-sm font-semibold mb-2">Último Snapshot:</div>
            <div className="text-xs space-y-1">
              <div>ID: <span className="font-mono">{lastSnapshot.snapshot_id}</span></div>
              <div>Hash: <span className="font-mono">{lastSnapshot.hash}</span></div>
              <div>Tamanho: {lastSnapshot.tamanho_bytes} bytes</div>
              <div>Pre-Snapshot ID: {lastSnapshot.pre_snapshot_id ? lastSnapshot.pre_snapshot_id.substring(0, 8) + '...' : 'N/A'}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
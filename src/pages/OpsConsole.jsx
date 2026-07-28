import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Plus, Lock, Clock, Key } from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import BreakGlassCard from '@/components/ops/BreakGlassCard';
import ExecuteRestoreProdModal from '@/components/ops/ExecuteRestoreProdModal';

import OpsStatusCards from '@/components/ops/OpsStatusCards';
import RunOperationWithSnapshot from '@/components/ops/RunOperationWithSnapshot';
import RollbackJobsTable from '@/components/ops/RollbackJobsTable';
import RollbackConfirmModal from '@/components/ops/RollbackConfirmModal';
import SnapshotIntegrityCard from '@/components/ops/SnapshotIntegrityCard';

export default function OpsConsole() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [autoCheckpoint, setAutoCheckpoint] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [creatingDelta, setCreatingDelta] = useState(false);
  const [guardrails, setGuardrails] = useState(null);
  const [maintenanceWindow, setMaintenanceWindow] = useState(null);
  const [prodModalOpen, setProdModalOpen] = useState(false);

  const { data: opsStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['ops-status'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getOpsStatus', {});
      return res.data?.ops_status || {};
    },
    refetchInterval: 30000
  });

  useEffect(() => {
    const loadGuardrails = async () => {
      try {
        const res = await base44.functions.invoke('puxarOpsGuardrails', {});
        if (res.data?.guardrails) {
          setGuardrails(res.data.guardrails);
        }
      } catch (e) {
        // ignore
      }
    };

    const loadMaintenanceWindow = async () => {
      try {
        const res = await base44.functions.invoke('isDentroJanelaManutencao', {});
        if (res.data?.ok) {
          setMaintenanceWindow(res.data);
        }
      } catch (e) {
        // ignore
      }
    };

    loadGuardrails();
    loadMaintenanceWindow();
  }, []);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const handleArchiveOldSnapshots = async () => {
    setArchiving(true);
    try {
      const res = await base44.functions.invoke('arquivarSnapshotsAntigos', {});
      if (res.data?.ok) {
        toast.success(`Arquivados ${res.data.archived_count} snapshots`);
        refetchStatus();
      }
    } catch (err) {
      toast.error('Erro ao arquivar: ' + err.message);
    } finally {
      setArchiving(false);
    }
  };

  const handleCreateDelta = async () => {
    if (!opsStatus?.last_snapshot?.id) {
      toast.error('Nenhum snapshot base disponível');
      return;
    }
    setCreatingDelta(true);
    try {
      const res = await base44.functions.invoke('exportarSnapshotDelta', {
        base_snapshot_id: opsStatus.last_snapshot.id,
        reason: 'UI_MANUAL'
      });
      if (res.data?.ok) {
        toast.success(`✓ Delta criado: ${res.data.total_records} records`);
        refetchStatus();
      } else {
        toast.error(res.data?.error || 'Erro ao criar delta');
      }
    } catch (err) {
      toast.error('Erro: ' + err.message);
    } finally {
      setCreatingDelta(false);
    }
  };

  if (!user?.role || !['admin', 'programador'].includes(user.role) && user.acesso_global !== true) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 font-semibold">Acesso restrito a administradores</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold">Ops Console</h1>
          <p className="text-gray-600 mt-1">Snapshots, Rollbacks & Circuit Breaker</p>
        </div>
        <Button
          onClick={() => refetchStatus()}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="w-4 h-4 mr-2" /> Recarregar
        </Button>
      </div>

      <OpsStatusCards status={opsStatus} />

      {/* Auto Checkpoint Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Auto Checkpoint
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                Criar snapshot automático antes de operações críticas
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {autoCheckpoint ? 'Ativado' : 'Desativado'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoCheckpoint}
              onChange={(e) => setAutoCheckpoint(e.target.checked)}
              className="w-6 h-6 cursor-pointer"
            />
          </div>
        </CardContent>
      </Card>

      <RunOperationWithSnapshot autoCheckpoint={autoCheckpoint} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Operações com Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Execute operações críticas com proteção automática de snapshot:
          </p>
          <div className="grid md:grid-cols-3 gap-3">
            <Button variant="outline" className="justify-start">
              Pagar Conta
            </Button>
            <Button variant="outline" className="justify-start">
              Faturar Medicao Obra
            </Button>
            <Button variant="outline" className="justify-start">
              Faturar Medicao Contrato
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">↩Restore Snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          {opsStatus?.last_snapshot ? (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded border border-blue-200 text-sm">
                Último: {opsStatus.last_snapshot.nome}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setSelectedSnapshot(opsStatus.last_snapshot.id);
                    setModalOpen(true);
                  }}
                  variant="outline"
                >
                  Dry-run Rollback
                </Button>
                <Button
                  onClick={() => {
                    setSelectedSnapshot(opsStatus.last_snapshot.id);
                    setModalOpen(true);
                  }}
                  variant="destructive"
                >
                  Rollback REAL
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Nenhum snapshot disponível</p>
          )}
        </CardContent>
      </Card>

      {/* Snapshot Retention Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Retenção de Snapshots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-3 bg-blue-50 rounded">
              <p className="text-xs text-gray-600 font-semibold">Total de Snapshots</p>
              <p className="text-2xl font-bold">{opsStatus?.total_snapshots || 0}</p>
              <p className="text-xs text-gray-500 mt-1">
                Ativos: {opsStatus?.total_active_snapshots || 0} | Arquivados: {opsStatus?.total_archived_snapshots || 0}
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded">
              <p className="text-xs text-gray-600 font-semibold">Espaço Usado (Ativos)</p>
              <p className="text-2xl font-bold">
                {opsStatus?.approx_total_bytes_active ? (opsStatus.approx_total_bytes_active / 1024 / 1024).toFixed(2) : 0} MB
              </p>
              <p className="text-xs text-gray-500 mt-1">Limite: 50 MB</p>
            </div>
          </div>
          <Button 
            onClick={handleArchiveOldSnapshots}
            disabled={archiving}
            variant="outline"
            className="w-full"
          >
            {archiving ? 'Arquivando...' : 'Arquivar Snapshots Antigos'}
          </Button>
        </CardContent>
      </Card>

      {/* Delta Snapshots */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Delta Snapshots</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Crie snapshots incrementais apenas com mudanças desde o último snapshot
          </p>
          <Button 
            onClick={handleCreateDelta}
            disabled={creatingDelta || !opsStatus?.last_snapshot}
            className="w-full"
          >
            {creatingDelta ? 'Criando...' : 'Criar Snapshot DELTA'}
          </Button>
        </CardContent>
      </Card>

      {/* Production Guardrails */}
      {guardrails && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="w-4 h-4" /> Governança Produção
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="p-3 bg-orange-50 rounded text-sm">
                <p className="font-semibold">System Mode</p>
                <p className="text-lg font-bold capitalize">{guardrails.system_mode}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded text-sm">
                <p className="font-semibold">Ops Prod Habilitado</p>
                <p className="text-lg font-bold">{guardrails.ops_allow_prod_ops ? '' : ''}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded text-sm">
                <p className="font-semibold">Requer 2-Pessoas</p>
                <p className="text-lg font-bold">{guardrails.ops_prod_requires_approval ? '' : ''}</p>
                <p className="text-xs text-gray-600 mt-1">Expiração: {guardrails.ops_approval_expires_minutes} min</p>
              </div>
              <div className="p-3 bg-blue-50 rounded text-sm">
                <p className="font-semibold">Requer Break-Glass</p>
                <p className="text-lg font-bold">{guardrails.ops_prod_requires_breakglass ? '' : ''}</p>
                <p className="text-xs text-gray-600 mt-1">Expiração: {guardrails.ops_breakglass_expires_minutes} min</p>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => window.location.href = createPageUrl('OpsAprovacoes')}
                className="gap-1"
              >
                Ver Aprovações
              </Button>
              {guardrails.ops_allow_restore_prod && opsStatus?.last_snapshot && (
                <Button
                  onClick={() => setProdModalOpen(true)}
                  className="gap-1 bg-red-600 hover:bg-red-700"
                >
                  Restore em PROD
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Break-Glass Card */}
      <BreakGlassCard />

      {/* Execute Restore Prod Modal */}
      <ExecuteRestoreProdModal 
        open={prodModalOpen}
        onClose={() => setProdModalOpen(false)}
        snapshot={opsStatus?.last_snapshot}
        systemMode={guardrails?.system_mode}
      />

      {/* Maintenance Window */}
      {maintenanceWindow && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-4 h-4" /> Janela de Manutenção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className={`p-4 rounded ${maintenanceWindow.inside ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-sm font-semibold mb-2">Status</p>
                <p className="text-2xl font-bold">
                  {maintenanceWindow.inside ? 'DENTRO' : 'FORA'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded">
                <p className="text-sm font-semibold mb-2">Horário Local</p>
                <p className="text-2xl font-bold">{maintenanceWindow.now_local_hhmm}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {maintenanceWindow.start_hhmm} — {maintenanceWindow.end_hhmm} {maintenanceWindow.tz}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Snapshot Integrity Check */}
      <SnapshotIntegrityCard onSuccess={() => refetchStatus()} />

      <RollbackJobsTable limit={15} />

      <RollbackConfirmModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        snapshotId={selectedSnapshot}
        onSuccess={() => refetchStatus()}
      />
    </div>
  );
}
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Zap, Lock } from 'lucide-react';

export default function OpsStatusCards({ status }) {
  const getStatusBadge = (systemMode, cbEnabled, health) => {
    if (systemMode === 'safe') {
      return <Badge className="bg-red-100 text-red-800">SAFE MODE</Badge>;
    }
    if (cbEnabled && health === 'critical') {
      return <Badge className="bg-yellow-100 text-yellow-800">CIRCUIT BREAKER ON</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">✓ NORMAL</Badge>;
  };

  return (
    <div className="grid md:grid-cols-2 gap-6 mb-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span>Modo:</span>
            <span className="font-semibold">{status?.system_mode || 'staging'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Circuit Breaker:</span>
            <span>{status?.circuit_breaker_enabled ? 'ON' : '✓ OFF'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Runtime Health:</span>
            {getStatusBadge(status?.system_mode, status?.circuit_breaker_enabled, status?.runtime_health)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            QA Gate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {status?.qa_gate_status === 'PASS' ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            )}
            <span className="font-semibold">{status?.qa_gate_status || 'not_run'}</span>
          </div>
        </CardContent>
      </Card>

      {status?.last_snapshot && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              Último Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">{status.last_snapshot.nome}</div>
            <div className="text-xs text-gray-600">{status.last_snapshot.tamanho_bytes} bytes</div>
            <div className="text-xs text-gray-500">{new Date(status.last_snapshot.created_at).toLocaleString('pt-BR')}</div>
          </CardContent>
        </Card>
      )}

      {status?.last_rollback && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              ↩Último Rollback
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={status.last_rollback.status === 'sucesso' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                {status.last_rollback.status}
              </Badge>
              <span className="text-sm">{status.last_rollback.acao}</span>
            </div>
            <div className="text-xs text-gray-500">{new Date(status.last_rollback.initiated_at).toLocaleString('pt-BR')}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
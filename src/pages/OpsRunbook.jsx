import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Clock, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import OutboxPanel from '../components/ops/OutboxPanel';

export default function OpsRunbook() {
  const [checks, setChecks] = useState({});

  const { data: status } = useQuery({
    queryKey: ['opsStatus'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getOpsStatus', {});
      return res.data;
    },
    refetchInterval: 30000
  });

  useEffect(() => {
    const newChecks = {
      qa_gate: status?.qa_gate_status === 'PASS' ? 'pass' : 'fail',
      runtime: status?.runtime_health === 'ok' ? 'pass' : 'fail',
      maintenance_window: status?.in_maintenance_window ? 'warning' : 'pass',
      lock_available: status?.locks_active === 0 ? 'pass' : 'warning',
      snapshot_available: status?.last_snapshot_id ? 'pass' : 'fail',
      system_mode: status?.system_mode === 'production' ? 'warning' : 'pass'
    };
    setChecks(newChecks);
  }, [status]);

  const checkItems = [
    {
      name: 'QA Gate',
      description: 'Todos os testes passando',
      icon: CheckCircle2,
      status: checks.qa_gate,
      details: status?.qa_gate_status || 'Unknown'
    },
    {
      name: 'Runtime Health',
      description: 'Sem erros críticos de runtime',
      icon: CheckCircle2,
      status: checks.runtime,
      details: status?.runtime_health || 'Unknown'
    },
    {
      name: 'Janela de Manutenção',
      description: 'Dentro da janela permitida',
      icon: Clock,
      status: checks.maintenance_window,
      details: status?.in_maintenance_window ? 'Sim' : 'Não'
    },
    {
      name: 'Lock Disponível',
      description: 'Nenhum lock ativo no momento',
      icon: Lock,
      status: checks.lock_available,
      details: `${status?.locks_active || 0} ativo(s)`
    },
    {
      name: 'Snapshot Disponível',
      description: 'Pelo menos um snapshot recente',
      icon: CheckCircle2,
      status: checks.snapshot_available,
      details: status?.last_snapshot_id ? `ID: ${status.last_snapshot_id.substring(0, 8)}...` : 'Nenhum'
    },
    {
      name: 'Modo Sistema',
      description: 'Status do sistema',
      icon: AlertCircle,
      status: checks.system_mode,
      details: `${status?.system_mode || 'unknown'}`
    }
  ];

  const statusColor = {
    pass: 'bg-green-100 text-green-800',
    fail: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800'
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Runbook OPS</h1>
        <p className="text-gray-600 mt-1">Checklist de pré-requisitos para operações críticas</p>
      </div>

      {/* Checklist */}
      <div className="grid gap-4">
        {checkItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.name}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <Icon className={`w-5 h-5 mt-0.5 ${item.status === 'pass' ? 'text-green-600' : item.status === 'warning' ? 'text-yellow-600' : 'text-red-600'}`} />
                    <div>
                      <h3 className="font-semibold">{item.name}</h3>
                      <p className="text-sm text-gray-600">{item.description}</p>
                      <p className="text-xs text-gray-500 mt-1">{item.details}</p>
                    </div>
                  </div>
                  <Badge className={statusColor[item.status]}>
                    {item.status === 'pass' ? '✓ OK' : item.status === 'warning' ? 'Aviso' : '✗ Falha'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Outbox */}
      <OutboxPanel />

      {/* Recomendações */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">Recomendações</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {checks.qa_gate === 'fail' && <p>Falha: QA Gate não passou - não prossiga com operações críticas</p>}
          {checks.runtime === 'fail' && <p>Falha: Há erros de runtime - investigue antes de prosseguir</p>}
          {checks.maintenance_window === 'warning' && <p>Aviso: Fora da janela de manutenção autorizada</p>}
          {checks.lock_available === 'warning' && <p>Aviso: Há locks ativos - aguarde liberação ou estenda TTL</p>}
          {checks.snapshot_available === 'fail' && <p>Falha: Nenhum snapshot disponível - crie um antes de fazer restore</p>}
          {checks.system_mode === 'warning' && <p>Aviso: Sistema em modo production - governança aumentada</p>}
          
          {Object.values(checks).every(c => c === 'pass') && (
            <p className="text-green-700 font-semibold">✓ Todos os pré-requisitos satisfeitos! Você pode prosseguir com operações.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
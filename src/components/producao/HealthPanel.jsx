import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';

export default function HealthPanel() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await base44.functions.invoke('getHealthStatus', {});
        setHealth(response.data);
      } catch (e) {
        setHealth({ status: 'critical', error: e.message });
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-6 flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const statusIcon = {
    ok: <CheckCircle2 className="w-6 h-6 text-green-600" />,
    warning: <AlertTriangle className="w-6 h-6 text-yellow-600" />,
    critical: <AlertCircle className="w-6 h-6 text-red-600" />
  };

  const statusBg = {
    ok: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    critical: 'bg-red-50 border-red-200'
  };

  return (
    <div className={`border rounded-lg p-6 space-y-4 ${statusBg[health?.status || 'critical']} border`}>
      <div className="flex items-center gap-2">
        {statusIcon[health?.status || 'critical']}
        <h2 className="text-2xl font-bold">Saúde do Sistema</h2>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="bg-white rounded p-3 border">
          <p className="text-gray-600 text-xs">Latência Média</p>
          <p className="text-lg font-bold">{health?.latencia?.avg_ms || 0}ms</p>
        </div>
        <div className="bg-white rounded p-3 border">
          <p className="text-gray-600 text-xs">P95</p>
          <p className="text-lg font-bold">{health?.latencia?.p95_ms || 0}ms</p>
        </div>
        <div className="bg-white rounded p-3 border">
          <p className="text-gray-600 text-xs">Erros Recentes</p>
          <p className="text-lg font-bold text-red-600">{health?.erros_recentes || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded p-3 border">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">QA Gate:</span>{' '}
          {health?.qa_gate === 'PASS' ? 'PASS' : health?.qa_gate === 'BLOCKED' ? 'BLOCKED' : 'Not run'}
        </p>
      </div>

      {health?.error && (
        <div className="bg-red-100 text-red-700 p-3 rounded text-sm">
          Erro: {health.error}
        </div>
      )}
    </div>
  );
}
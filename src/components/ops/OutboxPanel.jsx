import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Settings, RotateCcw, Archive, Globe } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

export default function OutboxPanel() {
  const [processing, setProcessing] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [configData, setConfigData] = useState({});
  const [metrics, setMetrics] = useState(null);
  const [testing, setTesting] = useState(false);

  const { data: outbox, refetch, isLoading } = useQuery({
    queryKey: ['outbox'],
    queryFn: async () => {
      const res = await base44.functions.invoke('listarOpsOutbox', {});
      return res.data?.data || [];
    },
    refetchInterval: 30000
  });

  const { data: config } = useQuery({
    queryKey: ['outbox-config'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getOpsOutboxConfig', {});
      return res.data;
    }
  });

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('processarOpsOutbox', { dry_run: dryRun });
      if (res.data?.ok) {
        const msg = dryRun ? `[DRY] ${res.data.processed_count} itens` : `${res.data.sent_count} enviados`;
        toast.success(`✓ ${msg}`);
        refetch();
      } else {
        toast.error(res.data?.error || 'Erro ao processar');
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    }
    setProcessing(false);
  };

  const handleRetry = async (itemId) => {
    try {
      const res = await base44.functions.invoke('retryOpsOutboxItem', { outbox_id: itemId });
      if (res.data?.ok) {
        toast.success(`✓ Retry agendado (${res.data.build_id})`);
        refetch();
      } else {
        toast.error(res.data?.error || 'Erro ao fazer retry');
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleArchive = async () => {
    try {
      const res = await base44.functions.invoke('arquivarOpsOutbox', {});
      if (res.data?.ok) {
        toast.success(`✓ ${res.data.archived_count} arquivados`);
        refetch();
      } else {
        toast.error(res.data?.error || 'Erro ao arquivar');
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleSaveConfig = async () => {
    try {
      const res = await base44.functions.invoke('setOpsOutboxConfig', configData);
      if (res.data?.ok) {
        toast.success(`✓ Config salva (${res.data.saved_keys.join(', ')})`);
        setShowConfig(false);
        setConfigData({});
        refetch();
      } else {
        toast.error(res.data?.error || 'Erro ao salvar config');
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleLoadMetrics = async () => {
    try {
      const res = await base44.functions.invoke('getOpsOutboxMetrics', {});
      if (res.data?.ok) {
        setMetrics(res.data);
        setShowMetrics(true);
      } else {
        toast.error(res.data?.error || 'Erro ao carregar métricas');
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleTestWebhook = async () => {
    setTesting(true);
    try {
      const res = await base44.functions.invoke('testarWebhookOutbox', {
        webhook_url: config?.webhook_url_masked || 'mock://success',
        webhook_secret: configData.webhook_secret_plain || ''
      });
      if (res.data?.ok) {
        toast.success(`✓ Webhook teste: ${res.data.status_code} (${res.data.latency_ms}ms)`);
      } else {
        toast.error(res.data?.error || 'Erro ao testar webhook');
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    }
    setTesting(false);
  };

  const handleResetCB = async () => {
    if (confirm('Resetar circuit breaker? (confirm=RESET)')) {
      try {
        const res = await base44.functions.invoke('resetOutboxCircuitBreaker', { confirm: 'RESET' });
        if (res.data?.ok) {
          toast.success(`✓ CB resetado: ${res.data.cb_state}`);
          handleLoadMetrics();
        } else {
          toast.error(res.data?.error || 'Erro ao resetar CB');
        }
      } catch (e) {
        toast.error('Erro: ' + e.message);
      }
    }
  };

  const statusColor = {
    queued: 'bg-yellow-100 text-yellow-800',
    sent: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    deadletter: 'bg-purple-100 text-purple-800',
    archived: 'bg-gray-100 text-gray-800'
  };

  return (
    <div className="space-y-4">
      {/* Webhook Status Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Status Webhook</CardTitle>
          <div className="flex gap-2">
            <Button
              onClick={handleTestWebhook}
              disabled={testing}
              size="sm"
              variant="outline"
            >
              {testing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Globe className="w-4 h-4 mr-2" />
              Testar
            </Button>
            <Button
              onClick={handleResetCB}
              size="sm"
              variant="outline"
              className="text-orange-600"
            >
              Reset CB
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {metrics ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Circuit Breaker</p>
                <p className="font-semibold text-lg">{metrics.circuit_breaker?.state || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600">Queue Depth</p>
                <p className="font-semibold text-lg">{metrics.queue_depth}</p>
              </div>
              <div>
                <p className="text-gray-600">P95 Latency</p>
                <p className="font-semibold">{metrics.latency?.p95_ms ? `${metrics.latency.p95_ms}ms` : 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600">Últimas Falhas</p>
                <p className="font-semibold">{metrics.errors?.total_unique || 0} tipos</p>
              </div>
            </div>
          ) : (
            <Button onClick={handleLoadMetrics} className="w-full">
              Carregar Métricas
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Config Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Configuração Outbox</CardTitle>
          <Button
            onClick={() => setShowConfig(!showConfig)}
            size="sm"
            variant="outline"
          >
            <Settings className="w-4 h-4 mr-2" />
            {showConfig ? 'Fechar' : 'Abrir'}
          </Button>
        </CardHeader>
        {showConfig && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="font-semibold">Webhook URL</label>
                <input
                  type="text"
                  placeholder="https://... ou mock://success"
                  value={configData.webhook_url || config?.webhook_url_masked || ''}
                  onChange={(e) => setConfigData({ ...configData, webhook_url: e.target.value })}
                  className="w-full mt-1 px-2 py-1 border rounded text-xs"
                />
              </div>
              <div>
                <label className="font-semibold">Secret (plain)</label>
                <input
                  type="password"
                  placeholder="Só enviado, nunca armazenado"
                  value={configData.webhook_secret_plain || ''}
                  onChange={(e) => setConfigData({ ...configData, webhook_secret_plain: e.target.value })}
                  className="w-full mt-1 px-2 py-1 border rounded text-xs"
                />
              </div>
              <div>
                <label className="font-semibold">Max Retries</label>
                <input
                  type="number"
                  value={configData.max_retries || config?.max_retries || 5}
                  onChange={(e) => setConfigData({ ...configData, max_retries: parseInt(e.target.value) })}
                  className="w-full mt-1 px-2 py-1 border rounded text-xs"
                />
              </div>
              <div>
                <label className="font-semibold">Habilitado</label>
                <select
                  value={configData.enabled !== undefined ? configData.enabled : config?.enabled ? 'true' : 'false'}
                  onChange={(e) => setConfigData({ ...configData, enabled: e.target.value === 'true' })}
                  className="w-full mt-1 px-2 py-1 border rounded text-xs"
                >
                  <option value="true">Sim</option>
                  <option value="false">Não</option>
                </select>
              </div>
            </div>
            <Button onClick={handleSaveConfig} className="w-full">
              Salvar Configuração
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Process Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Processar Outbox</CardTitle>
          <div className="flex gap-2">
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="mr-1"
              />
              Dry-run
            </label>
            <Button
              onClick={handleProcess}
              disabled={processing || isLoading}
              size="sm"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Send className="w-4 h-4 mr-2" />
              Processar
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Items Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Itens ({outbox?.length || 0})</CardTitle>
          <div className="flex gap-2">
            <Button
              onClick={handleArchive}
              size="sm"
              variant="outline"
            >
              <Archive className="w-4 h-4 mr-2" />
              Arquivar enviados
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-600">Carregando...</p>
            </div>
          ) : outbox && outbox.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {outbox.slice(0, 10).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded text-sm border">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{item.tipo}</p>
                    <p className="text-xs text-gray-600">
                      {new Date(item.created_at_iso).toLocaleString()} • Tentativa {item.attempts || 0}/{item.max_attempts || 5}
                    </p>
                    {item.last_error && (
                      <p className="text-xs text-red-600 mt-1">{item.last_error.substring(0, 50)}...</p>
                    )}
                  </div>
                  <div className="ml-2 flex items-center gap-2 flex-shrink-0">
                    <Badge className={statusColor[item.status] || 'bg-gray-100'}>
                      {item.status}
                    </Badge>
                    {['deadletter', 'failed'].includes(item.status) && (
                      <Button
                        onClick={() => handleRetry(item.id)}
                        size="sm"
                        variant="outline"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600 text-center py-4">Sem itens na fila</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
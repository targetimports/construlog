import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2, AlertCircle, XCircle, Zap, Archive, RefreshCw,
  Database, Activity, ShieldAlert, ToggleLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function SaudeSistema() {
  const [observabilidadLoading, setObservabilidadLoading] = useState(false);
  const [testRunId, setTestRunId] = useState(`T15-${Date.now()}`);
  const [includeTest, setIncludeTest] = useState(false);
  const [runtimeErrors, setRuntimeErrors] = useState([]);
  const [windowMinutes] = useState(120);

  const { data: health, isLoading: healthLoading, refetch } = useQuery({
    queryKey: ['health-status', includeTest],
    queryFn: async () => {
      const healthRes = await base44.functions.invoke('getHealthStatus', { include_test: includeTest });
      const sysRes = await base44.functions.invoke('getSystemConfig', {});
      return {
        ...healthRes.data,
        system_mode: sysRes.data?.config?.system_mode,
        circuit_breaker_enabled: sysRes.data?.config?.circuit_breaker_enabled,
        flags: sysRes.data?.config?.flags_modulos,
      };
    },
    refetchInterval: 30000,
  });

  const { data: user } = useQuery({ queryKey: ['user'], queryFn: () => base44.auth.me() });

  const gerarTeste = async (severidade) => {
    setObservabilidadLoading(true);
    try {
      const res = await base44.functions.invoke('testRuntimeHealthBatch', { count: 1, severidade, test_run_id: testRunId });
      if (res.data?.ok) {
        toast.success(`✓ 1 ${severidade.toUpperCase()} criado (${testRunId})`);
        setTimeout(() => { refetch(); carregarRuntimeErrors(); }, 800);
      }
    } catch (e) { toast.error(`Erro ao gerar ${severidade}`); }
    setObservabilidadLoading(false);
  };

  const arquivarTestRunId = async () => {
    setObservabilidadLoading(true);
    try {
      const res = await base44.functions.invoke('arquivarRuntimeErrors', { test_run_id: testRunId, include_test: true });
      if (res.data?.ok) {
        toast.success(`✓ ${res.data.archived_count} erro(s) arquivado(s)`);
        setTimeout(() => { refetch(); carregarRuntimeErrors(); }, 800);
      }
    } catch (e) { toast.error('Erro ao arquivar'); }
    setObservabilidadLoading(false);
  };

  const carregarRuntimeErrors = async () => {
    try {
      const res = await base44.functions.invoke('listarRuntimeErrors', { minutes: windowMinutes, include_test: includeTest, include_archived: false, limit: 20 });
      if (res.data?.ok) setRuntimeErrors(res.data.items || []);
    } catch (e) { /* silencioso */ }
  };

  const setConfig = async (updates, msg) => {
    try {
      await base44.functions.invoke('setSystemConfig', { updates });
      if (msg) toast.success(msg);
      setTimeout(() => refetch(), 800);
    } catch (e) { toast.error('Erro ao salvar configuração'); }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'programador';

  // ── Config visual por status ──
  const STATUS_CFG = {
    ok: { label: 'Sistema saudável', cls: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2, iconCls: 'text-emerald-600', dot: 'bg-emerald-500' },
    warning: { label: 'Atenção — há avisos', cls: 'border-amber-200 bg-amber-50', text: 'text-amber-700', icon: AlertCircle, iconCls: 'text-amber-600', dot: 'bg-amber-500' },
    critical: { label: 'Crítico — requer ação', cls: 'border-red-200 bg-red-50', text: 'text-red-700', icon: XCircle, iconCls: 'text-red-600', dot: 'bg-red-500' },
  };
  const st = STATUS_CFG[health?.status] || STATUS_CFG.ok;
  const StatusIcon = st.icon;

  const healthBadge = (status) => {
    const map = { ok: 'bg-emerald-100 text-emerald-700', warn: 'bg-amber-100 text-amber-700', critical: 'bg-red-100 text-red-700' };
    const label = { ok: 'OK', warn: 'Aviso', critical: 'Crítico' };
    return <Badge className={cn('border-0', map[status] || 'bg-gray-100 text-gray-600')}>{label[status] || '—'}</Badge>;
  };

  // ── Card de KPI reutilizável ──
  const StatCard = ({ icon: Icon, iconBg, iconColor, label, children }) => (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <div className="mt-2">{children}</div>
          </div>
          <div className={cn('p-2.5 rounded-lg flex-shrink-0', iconBg)}>
            <Icon className={cn('w-5 h-5', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saúde do Sistema</h1>
          <p className="text-gray-500 mt-1">Monitoramento de saúde, runtime e configuração do sistema</p>
        </div>
        <Button
          variant="outline"
          onClick={() => { refetch(); carregarRuntimeErrors(); }}
          className="gap-2 border-gray-300 text-gray-700"
        >
          <RefreshCw className={cn('w-4 h-4', healthLoading && 'animate-spin')} /> Atualizar
        </Button>
      </div>

      {/* Banner de status geral */}
      <div className={cn('rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3', st.cls)}>
        <div className="flex items-center gap-3">
          <StatusIcon className={cn('w-6 h-6 flex-shrink-0', st.iconCls)} />
          <div>
            <p className={cn('font-semibold', st.text)}>{st.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Banco {health?.db_ok ? 'conectado' : 'inacessível'} · {health?.erros_recentes || 0} erro(s) recente(s)
              {health?.runtime_critical_recent > 0 ? ` (${health.runtime_critical_recent} crítico)` : ''}
            </p>
          </div>
        </div>
        <span className="text-xs text-gray-400">verificado em {health?.duracao_ms ?? '—'}ms</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Banco de Dados" icon={Database} iconBg="bg-blue-500/10" iconColor="text-blue-600">
          {health?.db_ok
            ? <Badge className="border-0 bg-emerald-100 text-emerald-700">Conectado</Badge>
            : <Badge className="border-0 bg-red-100 text-red-700">Inacessível</Badge>}
        </StatCard>

        <StatCard label="QA Gate" icon={Zap} iconBg="bg-violet-500/10" iconColor="text-violet-600">
          <div className="flex items-center gap-2">
            {health?.qa_gate === 'PASS'
              ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              : <AlertCircle className="w-4 h-4 text-amber-600" />}
            <span className="text-lg font-bold text-gray-900">{health?.qa_gate || '—'}</span>
          </div>
          {health?.last_qa_build && <p className="text-xs text-gray-400 mt-1">build {health.last_qa_build}</p>}
        </StatCard>

        <StatCard label="Runtime Health" icon={Activity} iconBg="bg-cyan-500/10" iconColor="text-cyan-600">
          <div className="flex items-center gap-2">
            {healthBadge(health?.runtime_health)}
            <span className="text-xs text-gray-500">{health?.erros_recentes || 0} erro(s)</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">janela de {health?.thresholds?.window_minutes || 60}min</p>
        </StatCard>

        <StatCard label="Modo de Operação" icon={ShieldAlert} iconBg="bg-amber-500/10" iconColor="text-amber-600">
          {health?.system_mode === 'safe'
            ? <Badge className="border-0 bg-red-100 text-red-700">SAFE (read-only)</Badge>
            : <Badge className="border-0 bg-emerald-100 text-emerald-700 capitalize">{health?.system_mode || 'staging'}</Badge>}
        </StatCard>
      </div>

      {/* Modo Operação (admin) */}
      {isAdmin && (
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-gray-400" /> Modo de Operação</CardTitle>
            <CardDescription>Controle de safe mode e circuit breaker</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm" variant="destructive"
                onClick={() => setConfig({ system_mode: 'safe', safe_mode_reason: 'manual', safe_mode_auto: false }, '✓ SAFE MODE ativado')}
              >
                Ativar SAFE MODE
              </Button>
              <Button
                size="sm" variant="outline" className="border-gray-300 text-gray-700"
                onClick={() => setConfig({ system_mode: 'staging', safe_mode_reason: '', safe_mode_auto: false }, '✓ Voltando ao normal')}
              >
                Voltar ao normal
              </Button>
            </div>
            <label className="flex items-center gap-2.5 pt-3 border-t border-gray-100 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked={health?.circuit_breaker_enabled !== false}
                onChange={(e) => setConfig({ circuit_breaker_enabled: e.target.checked }, e.target.checked ? '✓ Circuit Breaker ativado' : '✓ Circuit Breaker desativado')}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm font-medium text-gray-700">Circuit Breaker</span>
              <span className="text-xs text-gray-400">— interrompe operações em cascata sob falha</span>
            </label>
          </CardContent>
        </Card>
      )}

      {/* Feature Flags (admin) */}
      {isAdmin && (
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><ToggleLeft className="w-5 h-5 text-gray-400" /> Feature Flags</CardTitle>
            <CardDescription>Ligar/desligar módulos do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {['compras', 'financeiro', 'estoque', 'bi', 'rh', 'agenda', 'producao'].map((modulo) => (
                <label key={modulo} className="flex items-center gap-2.5 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    defaultChecked={health?.flags?.[modulo] !== false}
                    onChange={(e) => setConfig({ flags_modulos: { ...(health?.flags || {}), [modulo]: e.target.checked } }, `${modulo} ${e.target.checked ? 'ativado' : 'desativado'}`)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-700 capitalize">{modulo}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Observabilidade (admin) */}
      {isAdmin && (
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Activity className="w-5 h-5 text-gray-400" /> Observabilidade de Runtime</CardTitle>
            <CardDescription>Gere, liste e arquive erros de teste isolados por <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">test_run_id</code></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="sm:col-span-1">
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Test Run ID</label>
                <input
                  type="text"
                  value={testRunId}
                  onChange={(e) => setTestRunId(e.target.value)}
                  className="w-full h-10 border border-gray-300 rounded-md px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <label className="flex items-center gap-2 h-10 sm:col-span-2 sm:justify-end cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTest}
                  onChange={(e) => setIncludeTest(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">Incluir testes na contagem de saúde</span>
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="border-gray-300 text-gray-700" onClick={() => gerarTeste('warn')} disabled={observabilidadLoading}>
                Gerar WARN (teste)
              </Button>
              <Button size="sm" variant="destructive" onClick={() => gerarTeste('critical')} disabled={observabilidadLoading}>
                Gerar CRITICAL (teste)
              </Button>
              <Button size="sm" variant="secondary" onClick={arquivarTestRunId} disabled={observabilidadLoading} className="gap-1">
                <Archive className="w-4 h-4" /> Arquivar este run
              </Button>
              <Button size="sm" variant="ghost" className="gap-1 text-gray-500" onClick={() => { refetch(); carregarRuntimeErrors(); }}>
                <RefreshCw className="w-4 h-4" /> Recarregar
              </Button>
            </div>

            {/* Tabela de erros */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Hora</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Severidade</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Teste</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">test_run_id</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Arquivado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {runtimeErrors.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-gray-400 text-sm">
                          Nenhum erro nos últimos {windowMinutes} min
                        </td>
                      </tr>
                    ) : (
                      runtimeErrors.map((err, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{err.created_date ? new Date(err.created_date).toLocaleTimeString('pt-BR') : '—'}</td>
                          <td className="px-4 py-3">
                            <Badge className={cn('border-0', err.severidade === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                              {err.severidade}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{err.is_test ? 'Sim' : 'Não'}</td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-xs">{err.test_run_id || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{err.archived ? 'Sim' : 'Não'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

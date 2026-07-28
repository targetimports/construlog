import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Loader2, Play, CheckCircle2, XCircle, Clock, Shield, FlaskConical, Info } from 'lucide-react';

const TEST_SUITES = [
  {
    id: 'testarIntegridadeSistema',
    nome: 'Integridade de Dados',
    descricao:
      'Banco conectável + round-trip CRUD (criar → ler → atualizar → excluir) com cleanup automático + filtro $in.',
    function_name: 'testarIntegridadeSistema',
  },
  {
    id: 'testarEntidadesCore',
    nome: 'Entidades Essenciais',
    descricao:
      'Verifica se as tabelas das entidades centrais (Obra, Insumo, Medição, Financeiro, Fornecedor…) respondem.',
    function_name: 'testarEntidadesCore',
  },
];

function TestResultCard({ result }) {
  if (!result) return null;
  const { resumo, all_passed, elapsed_ms, executado_por, results = [], error } = result;

  if (error) {
    return (
      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2 text-red-700 font-semibold mb-2 text-sm">
          <XCircle className="w-4 h-4" /> Erro na execução
        </div>
        <pre className="text-xs text-red-800 whitespace-pre-wrap bg-red-100 rounded p-3 overflow-x-auto">{error}</pre>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'mt-3 rounded-lg border p-4',
        all_passed ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40',
      )}
    >
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 min-w-0">
          {all_passed ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span className="truncate">{resumo}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {elapsed_ms}ms
          </span>
          {executado_por && <span className="hidden sm:inline">{executado_por}</span>}
        </div>
      </div>
      <div className="space-y-1.5">
        {results.map((r, i) => (
          <div
            key={i}
            className={cn(
              'flex items-start gap-2 px-3 py-2 rounded-md text-sm bg-white border',
              r.status === 'PASS' ? 'border-emerald-100' : 'border-red-100',
            )}
          >
            {r.status === 'PASS' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            )}
            <div className="min-w-0">
              <span className="font-mono text-xs font-semibold text-gray-800">{r.test}</span>
              <p className="text-xs text-gray-600 mt-0.5">{r.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FerramentasAdmin() {
  const [running, setRunning] = useState(null);
  const [runningAll, setRunningAll] = useState(false);
  const [results, setResults] = useState({});

  const { data: user } = useQuery({
    queryKey: ['user-ferramentas'],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'programador';

  const runTest = async (suite) => {
    setRunning(suite.id);
    try {
      const resp = await base44.functions.invoke(suite.function_name, {});
      setResults((prev) => ({ ...prev, [suite.id]: resp.data }));
    } catch (err) {
      setResults((prev) => ({ ...prev, [suite.id]: { error: err.message || 'Erro desconhecido' } }));
    } finally {
      setRunning(null);
    }
  };

  const runAll = async () => {
    setRunningAll(true);
    try {
      for (const suite of TEST_SUITES) {
        // eslint-disable-next-line no-await-in-loop
        await runTest(suite);
      }
    } finally {
      setRunningAll(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md bg-white border-gray-200 shadow-sm">
          <CardContent className="py-12 text-center">
            <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-lg text-gray-700">Acesso Restrito</h3>
            <p className="text-sm text-gray-500 mt-2">
              Esta página é acessível apenas para administradores e programadores.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const busy = running !== null || runningAll;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-blue-600" />
            Ferramentas Admin
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Testes automatizados e diagnósticos do sistema — apenas admin/programador.
          </p>
        </div>
        <Button
          onClick={runAll}
          disabled={busy}
          variant="outline"
          className="gap-2 border-gray-300 text-gray-700 hover:bg-gray-50 shrink-0"
        >
          {runningAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Executar todos
        </Button>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Suites de Teste</h2>

        {TEST_SUITES.map((suite) => {
          const res = results[suite.id];
          const statusBadge = res
            ? res.error
              ? { cls: 'bg-red-100 text-red-700', txt: 'Erro' }
              : res.all_passed
                ? { cls: 'bg-emerald-100 text-emerald-700', txt: res.resumo }
                : { cls: 'bg-amber-100 text-amber-700', txt: res.resumo }
            : null;

          return (
            <Card key={suite.id} className="bg-white border-gray-200 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{suite.nome}</h3>
                      {statusBadge && (
                        <Badge className={cn('border-0', statusBadge.cls)}>{statusBadge.txt}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{suite.descricao}</p>
                    <Badge variant="outline" className="mt-2 text-xs font-mono border-gray-200 text-gray-500">
                      {suite.function_name}
                    </Badge>
                  </div>
                  <Button
                    onClick={() => runTest(suite)}
                    disabled={busy}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                    size="sm"
                  >
                    {running === suite.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Executando…
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" /> Executar
                      </>
                    )}
                  </Button>
                </div>

                <TestResultCard result={res} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-blue-800 font-semibold text-sm mb-2">
            <Info className="w-4 h-4" /> Como funciona
          </div>
          <ul className="space-y-1 text-xs text-blue-700">
            <li>• Cada suite executa verificações reais contra o backend em produção.</li>
            <li>• Dados temporários de teste são criados e removidos automaticamente (cleanup).</li>
            <li>• Nenhum dado de produção é alterado.</li>
            <li>• Disponível apenas para admin/programador.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

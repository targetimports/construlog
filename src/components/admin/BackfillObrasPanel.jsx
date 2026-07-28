import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, FileSearch, Wrench, ChevronDown, ChevronRight } from 'lucide-react';

function ObraBackfillRow({ item }) {
  const [open, setOpen] = useState(false);

  const statusColor = {
    corrigido: 'bg-green-100 text-green-800',
    simulado: 'bg-blue-100 text-blue-800',
    sem_alteracao: 'bg-gray-100 text-gray-600',
    erro: 'bg-red-100 text-red-800',
  };

  return (
    <div className="border rounded-lg mb-2">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {open ? <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-400" /> : <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-400" />}
          <span className="font-medium text-gray-900 truncate">{item.nome || item.id}</span>
          {item.acoes?.length > 0 && (
            <span className="text-xs text-gray-500">{item.acoes.length} correção(ões)</span>
          )}
          {item.pendencias?.length > 0 && (
            <span className="text-xs text-amber-600">{item.pendencias.length} pendência(s)</span>
          )}
        </div>
        <Badge className={`ml-2 flex-shrink-0 ${statusColor[item.status] || 'bg-gray-100 text-gray-600'}`}>
          {item.status || '—'}
        </Badge>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t bg-gray-50">
          <p className="text-xs text-gray-500 pt-3 font-mono">ID: {item.id}</p>

          {item.acoes?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Correções aplicadas
              </p>
              <ul className="text-xs text-green-800 space-y-0.5 list-disc list-inside">
                {item.acoes.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          {item.pendencias?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Pendências (sem dados fonte)
              </p>
              <ul className="text-xs text-amber-800 space-y-0.5 list-disc list-inside">
                {item.pendencias.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}

          {item.erro && (
            <div>
              <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Erro
              </p>
              <p className="text-xs text-red-800 font-mono bg-red-50 rounded p-2">{item.erro}</p>
            </div>
          )}

          {!item.acoes?.length && !item.pendencias?.length && !item.erro && (
            <p className="text-xs text-gray-500 pt-1">Dados já consistentes — nenhuma alteração necessária.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function BackfillObrasPanel() {
  const [resultado, setResultado] = useState(null);
  const [lastDryRun, setLastDryRun] = useState(null);

  const executar = useMutation({
    mutationFn: (dry_run) => base44.functions.invoke('backfillObrasImportadas', { dry_run }),
    onSuccess: (res, dry_run) => {
      const data = res.data;
      setResultado(data);
      if (dry_run) setLastDryRun(data);
      const r = data.relatorio;
      toast.success(
        dry_run
          ? `Simulação: ${r.corrigidas} seriam corrigidas, ${r.sem_alteracao} OK, ${r.erros} erros`
          : `Backfill concluído: ${r.corrigidas} corrigidas, ${r.sem_alteracao} sem alteração, ${r.erros} erros`
      );
    },
    onError: (err) => {
      toast.error(`Erro no backfill: ${err.response?.data?.error || err.message}`);
    }
  });

  const relatorio = resultado?.relatorio;

  const downloadRelatorio = () => {
    if (!relatorio) return;
    const blob = new Blob([JSON.stringify(relatorio, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backfill-obras-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-800 flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Backfill — Corrigir Obras Importadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-blue-700">
            Esta rotina varre todas as obras importadas via OrçaFascio e corrige inconsistências:
            <strong> cliente fallback, endereço parcial, totais de orçamento divergentes</strong>.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => executar.mutate(true)}
              disabled={executar.isPending}
              className="flex items-center gap-2"
            >
              <FileSearch className="w-4 h-4" />
              {executar.isPending ? 'Simulando...' : 'Simular (Dry Run)'}
            </Button>

            <Button
              onClick={() => executar.mutate(false)}
              disabled={executar.isPending}
              className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {executar.isPending ? 'Executando...' : 'Executar Correção'}
            </Button>
          </div>

          <p className="text-xs text-blue-600">
            Use <strong>Simular</strong> primeiro para ver o que será alterado sem aplicar mudanças.
          </p>
        </CardContent>
      </Card>

      {relatorio && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-gray-900">
                Relatório {resultado.dry_run ? '(Simulação)' : '(Executado)'}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={downloadRelatorio}>
                Baixar JSON
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Resumo */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Total', value: relatorio.total, color: 'text-gray-700' },
                { label: resultado.dry_run ? 'Seriam Corrigidas' : 'Corrigidas', value: relatorio.corrigidas, color: 'text-green-700' },
                { label: 'Sem Alteração', value: relatorio.sem_alteracao, color: 'text-gray-500' },
                { label: 'Erros', value: relatorio.erros, color: 'text-red-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3 text-center border">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* Lista de obras */}
            <div className="max-h-[500px] overflow-y-auto space-y-1">
              {relatorio.obras?.map(item => (
                <ObraBackfillRow key={item.id} item={item} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
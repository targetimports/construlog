import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function QaGateCard({ onResult }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const handleRunQaGate = async () => {
    setRunning(true);
    try {
      const response = await base44.functions.invoke('runQaGate', {});
      const data = response.data;
      setResult(data);
      if (onResult) onResult(data.qa_gate_status);
    } catch (e) {
      setResult({ ok: false, error: e.message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6 space-y-4">
      <h2 className="text-2xl font-bold">QA Gate</h2>

      {result && (
        <div className={`p-4 rounded ${result.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            {result.ok ? (
              <>
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <span className="font-bold text-green-900">PASS </span>
              </>
            ) : (
              <>
                <XCircle className="w-6 h-6 text-red-600" />
                <span className="font-bold text-red-900">BLOCKED </span>
              </>
            )}
          </div>
          {result.qa_result?.summary && (
            <div className="text-sm text-gray-600 space-y-1">
              <p>Testes: {result.qa_result.summary.total}</p>
              <p className="text-green-700">Passou: {result.qa_result.summary.passed}</p>
              <p className="text-red-700">Falhou: {result.qa_result.summary.failed}</p>
            </div>
          )}
          {result.error && (
            <p className="text-sm text-red-700 mt-2">Erro: {result.error}</p>
          )}
        </div>
      )}

      <Button
        onClick={handleRunQaGate}
        disabled={running}
        className="w-full bg-purple-600 hover:bg-purple-700"
      >
        {running ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Rodando...
          </>
        ) : (
          'Rodar QA Gate'
        )}
      </Button>
    </div>
  );
}
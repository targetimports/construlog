import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import QaRunPanel from '../components/qa/QaRunPanel';
import QaResultsTable from '../components/qa/QaResultsTable';
import { Card } from '@/components/ui/card';

export default function QaConsole() {
  const [running, setRunning] = useState(false);
  const [regressionResults, setRegressionResults] = useState(null);
  const [loadResults, setLoadResults] = useState(null);

  const handleRunRegression = async (modo, obraId) => {
    setRunning(true);
    try {
      const response = await base44.functions.invoke('runRegressionSuite', {
        modo,
        obra_id_opcional: obraId,
      });
      setRegressionResults(response.data);
    } catch (e) {
      console.error('Erro ao rodar regressão:', e);
      setRegressionResults({ error: e.message });
    } finally {
      setRunning(false);
    }
  };

  const handleRunLoad = async (loops) => {
    setRunning(true);
    try {
      const response = await base44.functions.invoke('runLoadSuite', {
        loops,
        concurrency: 1,
        obra_ids_max: 5,
      });
      setLoadResults(response.data);
    } catch (e) {
      console.error('Erro ao rodar carga:', e);
      setLoadResults({ error: e.message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold">QA Console</h1>
        <p className="text-gray-600 text-sm mt-2">
          Teste de regressão + carga (somente leitura, sem alteração de dados)
        </p>
      </div>

      <QaRunPanel onRunRegression={handleRunRegression} onRunLoad={handleRunLoad} running={running} />

      {regressionResults && (
        <Card>
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-2xl font-bold">Resultados: Regressão</h2>
              <p className="text-xs text-gray-500 mt-1">
                Build: {regressionResults.build_id} | Duração: {regressionResults.duration_ms}ms
              </p>
            </div>
            <QaResultsTable results={regressionResults} />
          </div>
        </Card>
      )}

      {loadResults && (
        <Card>
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-2xl font-bold">Resultados: Carga</h2>
              <p className="text-xs text-gray-500 mt-1">
                Build: {loadResults.build_id} | Duração: {loadResults.duration_ms}ms
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {Object.entries(loadResults.metrics || {}).map(([key, metric]) => (
                <div key={key} className="bg-gray-50 border border-gray-200 rounded p-4">
                  <p className="text-sm font-semibold text-gray-700">{key}</p>
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Calls:</span>
                      <span className="font-mono">{metric.calls}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg:</span>
                      <span className={`font-mono ${metric.avg_ms > 2000 ? 'text-red-600' : 'text-green-600'}`}>
                        {metric.avg_ms}ms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">P95:</span>
                      <span className="font-mono">{metric.p95_ms}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Errors:</span>
                      <span className={`font-mono ${metric.errors > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {metric.errors}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {loadResults.notes && loadResults.notes.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-sm font-semibold text-blue-900">Notas</p>
                <ul className="text-sm text-blue-800 mt-2 space-y-1">
                  {loadResults.notes.map((note, i) => (
                    <li key={i}>• {note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {!regressionResults && !loadResults && (
        <div className="text-center text-gray-400 py-12">
          <p>Clique em "Rodar Regressão" ou "Rodar Carga" para começar</p>
        </div>
      )}
    </div>
  );
}
import React from 'react';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export default function QaResultsTable({ results }) {
  if (!results || !results.tests) {
    return <div className="text-gray-500 p-4">Nenhum resultado</div>;
  }

  return (
    <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
      <div className="bg-gray-100 border-b border-gray-300 p-4 grid grid-cols-12 gap-2 text-sm font-semibold">
        <div className="col-span-1">ID</div>
        <div className="col-span-4">Nome</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2">Tempo (ms)</div>
        <div className="col-span-3">Detalhes</div>
      </div>

      <div className="divide-y divide-gray-200">
        {results.tests.map((test, i) => (
          <div key={i} className="p-4 grid grid-cols-12 gap-2 text-sm items-center hover:bg-gray-50">
            <div className="col-span-1 font-mono text-xs">{test.id}</div>
            <div className="col-span-4">{test.name}</div>
            <div className="col-span-2 flex items-center gap-1">
              {test.ok === true && (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-green-600 font-semibold">PASS</span>
                </>
              )}
              {test.ok === false && (
                <>
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-red-600 font-semibold">FAIL</span>
                </>
              )}
            </div>
            <div className="col-span-2 text-gray-600">{test.ms || '-'}</div>
            <div className="col-span-3 text-xs text-gray-600 truncate">
              {test.error ? (
                <span className="text-red-600">{test.error}</span>
              ) : (
                <span className="text-green-600">{test.evidence || 'OK'}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 border-t border-gray-300 p-4 text-sm">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-gray-600">Total</p>
            <p className="text-lg font-bold">{results.summary.total}</p>
          </div>
          <div>
            <p className="text-gray-600">Passou</p>
            <p className="text-lg font-bold text-green-600">{results.summary.passed}</p>
          </div>
          <div>
            <p className="text-gray-600">Falhou</p>
            <p className="text-lg font-bold text-red-600">{results.summary.failed}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
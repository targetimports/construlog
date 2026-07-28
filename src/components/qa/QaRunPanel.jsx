import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function QaRunPanel({ onRunRegression, onRunLoad, running }) {
  const [modo, setModo] = useState('quick');
  const [loops, setLoops] = useState(5);
  const [obraId, setObraId] = useState('');

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6 space-y-4">
      <div className="flex items-center gap-2 text-amber-700 bg-amber-50 p-3 rounded">
        <AlertTriangle className="w-5 h-5" />
        <span className="text-sm font-semibold">QA CONSOLE (Somente Leitura)</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2">Modo Regressão</label>
          <select
            value={modo}
            onChange={(e) => setModo(e.target.value)}
            className="w-full border rounded px-3 py-2"
            disabled={running}
          >
            <option value="quick">Quick (12 testes)</option>
            <option value="full">Full (25 testes)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">Loops (Carga)</label>
          <Input
            type="number"
            value={loops}
            onChange={(e) => setLoops(parseInt(e.target.value) || 5)}
            min="1"
            max="50"
            disabled={running}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2">Obra ID (Opcional)</label>
        <Input
          value={obraId}
          onChange={(e) => setObraId(e.target.value)}
          placeholder="deixar vazio para auto"
          disabled={running}
        />
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => onRunRegression(modo, obraId)}
          disabled={running}
          className="flex-1 bg-blue-600 hover:bg-blue-700"
        >
          {running ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Rodando...
            </>
          ) : (
            'Rodar Regressão'
          )}
        </Button>
        <Button
          onClick={() => onRunLoad(loops)}
          disabled={running}
          className="flex-1 bg-purple-600 hover:bg-purple-700"
        >
          {running ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Rodando...
            </>
          ) : (
            'Rodar Carga'
          )}
        </Button>
      </div>
    </div>
  );
}
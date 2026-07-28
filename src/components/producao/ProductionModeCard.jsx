import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function ProductionModeCard({ currentMode, qaGateStatus, onModeChange }) {
  const [loading, setLoading] = useState(false);

  const handleActivateProduction = async () => {
    if (qaGateStatus !== 'PASS') {
      alert('QA Gate BLOCKED - Cannot activate production');
      return;
    }

    setLoading(true);
    try {
      const response = await base44.functions.invoke('setProductionMode', {
        mode: 'production',
        require_qa_pass: true
      });
      onModeChange(response.data.mode);
      alert('Produção ativada');
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateStaging = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('setProductionMode', {
        mode: 'staging',
        require_qa_pass: false
      });
      onModeChange(response.data.mode);
      alert('Staging ativado');
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Modo Produção</h2>
        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${currentMode === 'production' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
          {currentMode === 'production' ? 'PRODUÇÃO' : 'STAGING'}
        </div>
      </div>

      <div className={`p-4 rounded border-l-4 ${qaGateStatus === 'PASS' ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
        <div className="flex items-center gap-2">
          {qaGateStatus === 'PASS' ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-900">QA Gate: PASS </span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="font-semibold text-red-900">QA Gate: BLOCKED </span>
            </>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {qaGateStatus === 'PASS' 
            ? 'Sistema passou em todos os testes. Produção pode ser ativada.' 
            : 'Sistema falhou em testes críticos. Produção está bloqueada.'}
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleActivateProduction}
          disabled={qaGateStatus !== 'PASS' || loading || currentMode === 'production'}
          className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400"
        >
          {loading ? 'Processando...' : 'Ativar Produção'}
        </Button>
        <Button
          onClick={handleActivateStaging}
          disabled={loading || currentMode === 'staging'}
          className="flex-1 bg-blue-600 hover:bg-blue-700"
        >
          {loading ? 'Processando...' : 'Voltar para Staging'}
        </Button>
      </div>
    </div>
  );
}
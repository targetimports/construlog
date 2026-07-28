import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import IAUpload from '../components/medicao-ia/IAUpload';
import IASuggestionsTable from '../components/medicao-ia/IASuggestionsTable';
import IAResumo from '../components/medicao-ia/IAResumo';
import IAAlerts from '../components/medicao-ia/IAAlerts';
import { Card, CardContent } from '@/components/ui/card';

export default function IAMedicoes() {
  const params = new URLSearchParams(window.location.search);
  const bmId = params.get('bm_id');
  const obraId = params.get('obra_id');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [resumo, setResumo] = useState('');

  const refreshSuggestions = async () => {
    if (!bmId) return;
    setLoading(true); setError('');
    try {
      const list = await base44.entities.IASugestaoBMItem.filter({ bm_id: bmId });
      setSuggestions(list);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Falha ao carregar sugestões');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshSuggestions(); }, [bmId]);

  if (!bmId || !obraId) {
    return <Card><CardContent className="text-sm text-red-600">Informe bm_id e obra_id na URL.</CardContent></Card>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4 text-sm text-gray-600">Módulo IA Medições — A IA apenas sugere valores; você decide aplicar.</div>
      <IAUpload obraId={obraId} bmId={bmId} onExtracted={(data) => { setResumo(data?.resumo_texto || ''); refreshSuggestions(); }} />
      {loading && <div className="text-sm text-gray-600">Carregando sugestões…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <IAResumo resumoTexto={resumo} />
      <IAAlerts suggestions={suggestions} />
      <IASuggestionsTable bmId={bmId} suggestions={suggestions} onApplied={() => refreshSuggestions()} />
    </div>
  );
}
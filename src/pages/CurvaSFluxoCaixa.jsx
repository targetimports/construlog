import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';
import CurvaSChart from '../components/bi/CurvaSChart';
import FluxoCaixaChart from '../components/bi/FluxoCaixaChart';
import { createPageUrl } from '@/utils';
import { TableSkeleton } from '@/components/shared/Skeletons';

export default function CurvaSFluxoCaixaPage() {
  const [filtros, setFiltros] = useState({ obra_id: null, de: null, ate: null });
  const [filtrosAtivos, setFiltrosAtivos] = useState(false);
  const [tab, setTab] = useState('curva_s');
  const [obraId, setObraId] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-list'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: curvaSData, isLoading: curvaSLoading } = useQuery({
    queryKey: ['curvaSObra', filtros],
    queryFn: () => base44.functions.invoke('getCurvaSObra', filtros),
    enabled: !!filtros.obra_id
  });

  const { data: fluxoCaixaData, isLoading: fluxoLoading } = useQuery({
    queryKey: ['fluxoCaixaObra', filtros],
    queryFn: () => base44.functions.invoke('getFluxoCaixaObra', filtros),
    enabled: !!filtros.obra_id
  });

  const handleAplicarFiltros = () => {
    setFiltros({
      obra_id: obraId,
      de: de || undefined,
      ate: ate || undefined
    });
    setFiltrosAtivos(true);
  };

  const handleLimpar = () => {
    setObraId('');
    setDe('');
    setAte('');
    setFiltros({ obra_id: null, de: null, ate: null });
    setFiltrosAtivos(false);
  };

  const handleDrillDown = (periodo, campo) => {
    if (!obraId) return;

    let destino = '';
    const params = `?obra_id=${obraId}&de=${periodo.de}&ate=${periodo.ate}`;

    if (campo === 'real_receita' || campo === 'entradas') {
      destino = createPageUrl('ContasReceber') + `${params}&status=pago,parcial`;
    } else if (campo === 'real_materiais' || campo === 'saidas') {
      destino = createPageUrl('MovimentacoesEstoque') + `${params}&tipo=saida_consumo,saida`;
    } else if (campo === 'real_custo_total') {
      destino = createPageUrl('ContasPagar') + `${params}&status=pago,parcial`;
    }

    if (destino) {
      window.location.href = destino;
    }
  };

  const curvaS = curvaSData?.data;
  const fluxo = fluxoCaixaData?.data;

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Curva S & Fluxo de Caixa</h1>
        <p className="text-gray-500 text-sm mt-1">Análise de Execução Financeira por Obra</p>
      </div>

      {/* Filtros */}
      <FiltrosColapsaveis
        ativos={(obraId ? 1 : 0) + (de ? 1 : 0) + (ate ? 1 : 0)}
        onLimpar={handleLimpar}
        rodape={
          <Button onClick={handleAplicarFiltros} className="w-full sm:w-auto h-9 bg-blue-600 hover:bg-blue-700" disabled={!obraId}>
            Aplicar
          </Button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Obra</Label>
            <ComboboxBusca
              options={obras.map(o => ({ value: o.id, label: o.nome || o.codigo || o.id }))}
              value={obraId}
              onSelect={(v) => setObraId(v || '')}
              placeholder="Selecionar obra..."
              searchPlaceholder="Buscar obra..."
              emptyMessage="Nenhuma obra."
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">De</Label>
            <Input className="h-11" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Até</Label>
            <Input className="h-11" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
        </div>
      </FiltrosColapsaveis>

      {filtrosAtivos && (curvaSLoading || fluxoLoading) && (
        <TableSkeleton rows={8} cols={4} />
      )}

      {filtrosAtivos && curvaS && fluxo && (
        <>
          {/* Avisos */}
          {(curvaS.warnings?.length > 0 || fluxo.alertas?.length > 0) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                {curvaS.warnings?.map((w, idx) => (
                  <p key={idx} className="text-sm text-yellow-700">• {w}</p>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex gap-4">
              <button
                onClick={() => setTab('curva_s')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  tab === 'curva_s'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Curva S
              </button>
              <button
                onClick={() => setTab('fluxo_caixa')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  tab === 'fluxo_caixa'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Fluxo de Caixa
              </button>
            </div>
          </div>

          {/* Conteúdo das Abas */}
          {tab === 'curva_s' && (
            <CurvaSChart
              data={curvaS.serie || []}
              onDrillDown={handleDrillDown}
            />
          )}

          {tab === 'fluxo_caixa' && (
            <FluxoCaixaChart
              data={fluxo.serie || []}
              alertas={fluxo.alertas || []}
              onDrillDown={handleDrillDown}
            />
          )}
        </>
      )}

      {!filtrosAtivos && (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500">
            Selecione uma obra nos filtros acima para visualizar a Curva S e Fluxo de Caixa
          </CardContent>
        </Card>
      )}
    </div>
  );
}
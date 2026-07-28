import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import GerenciadorEtapas from './GerenciadorEtapas';
import TabelaPlanejamentoInsumos from './TabelaPlanejamentoInsumos';

export default function PlanejamentoInsumosTab({ obraId }) {
  const [etapaSelecionada, setEtapaSelecionada] = useState(null);
  const [mostrarFormEtapa, setMostrarFormEtapa] = useState(false);

  // Buscar etapas da obra
  const { data: etapas = [], isLoading: loadingEtapas, refetch: refetchEtapas } = useQuery({
    queryKey: ['etapas-obra', obraId],
    queryFn: async () => {
      const items = await base44.entities.EtapaObra.filter(
        { obra_id: obraId, ativo: true },
        'ordem'
      );
      return items || [];
    },
    enabled: !!obraId
  });

  // Buscar insumos da etapa selecionada
  const { data: insumos = [], isLoading: loadingInsumos, refetch: refetchInsumos } = useQuery({
    queryKey: ['insumos-etapa', etapaSelecionada],
    queryFn: async () => {
      if (!etapaSelecionada) return [];
      const items = await base44.entities.PlanejamentoInsumoEtapa.filter(
        { etapa_obra_id: etapaSelecionada },
        'created_date'
      );
      return items || [];
    },
    enabled: !!etapaSelecionada
  });

  const handleEtapaCriada = () => {
    setMostrarFormEtapa(false);
    refetchEtapas();
  };

  const handleEtapaAtualizada = () => {
    refetchEtapas();
  };

  const handleInsumoAdicionado = () => {
    refetchInsumos();
  };

  const handleInsumoRemovido = () => {
    refetchInsumos();
  };

  if (loadingEtapas) {
    return <div className="text-center py-8 text-gray-500">Carregando etapas...</div>;
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Planejamento de Insumos</h2>
          <p className="text-gray-600 text-sm mt-1">Defina os insumos planejados por etapa</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* COLUNA ESQUERDA: ETAPAS */}
        <div className="lg:col-span-1">
          <GerenciadorEtapas
            obraId={obraId}
            etapas={etapas}
            etapaSelecionada={etapaSelecionada}
            onEtapaSelect={setEtapaSelecionada}
            onEtapaCriada={handleEtapaCriada}
            onEtapaAtualizada={handleEtapaAtualizada}
            mostrarForm={mostrarFormEtapa}
            onToggleForm={() => setMostrarFormEtapa(!mostrarFormEtapa)}
          />
        </div>

        {/* COLUNA DIREITA: INSUMOS */}
        <div className="lg:col-span-3">
          {!etapaSelecionada ? (
            <Card className="bg-blue-50 border border-blue-200">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-blue-900 font-medium">Selecione uma etapa</p>
                    <p className="text-blue-700 text-sm">Escolha uma etapa à esquerda para gerenciar seus insumos.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {loadingInsumos ? (
                <div className="text-center py-8 text-gray-500">Carregando insumos...</div>
              ) : (
                <TabelaPlanejamentoInsumos
                  obraId={obraId}
                  etapaId={etapaSelecionada}
                  insumos={insumos}
                  onInsumoAdicionado={handleInsumoAdicionado}
                  onInsumoRemovido={handleInsumoRemovido}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
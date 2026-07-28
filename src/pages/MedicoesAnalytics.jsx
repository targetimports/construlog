import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { createPageUrl } from '@/utils';
import CurvaSChart from '@/components/medicao/CurvaSChart';
import DesviosMedicaoAlerts from '@/components/medicao/DesviosMedicaoAlerts';
import AnaliseComparativaChart from '@/components/medicao/AnaliseComparativaChart';
import RouteGuardWithFallback from '@/components/layout/RouteGuardWithFallback';

function MedicoesAnalyticsContent() {
  const [selectedObra, setSelectedObra] = useState(null);
  const [selectedContrato, setSelectedContrato] = useState(null);

  // Buscar obras
  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('-updated_date', 50)
  });

  // Buscar contratos da obra selecionada
  const { data: contratos = [] } = useQuery({
    queryKey: ['contratos', selectedObra],
    queryFn: () => selectedObra 
      ? base44.entities.ContratoVersao.filter({ obra_id: selectedObra })
      : Promise.resolve([]),
    enabled: !!selectedObra
  });

  const obraSelect = useMemo(() => 
    obras.find(o => o.id === selectedObra), 
    [obras, selectedObra]
  );

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => window.location.href = createPageUrl('Medicoes')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold">Analytics — Medições</h1>
          </div>
          <p className="text-sm text-gray-600 mt-1">Análise de curva S, desvios e comparativos</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Obra</label>
            <Select value={selectedObra || ''} onValueChange={setSelectedObra}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma obra..." />
              </SelectTrigger>
              <SelectContent>
                {obras.map(obra => (
                  <SelectItem key={obra.id} value={obra.id}>
                    {obra.nome} ({obra.codigo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedObra && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Contrato (Opcional)</label>
              <Select value={selectedContrato || ''} onValueChange={setSelectedContrato}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os contratos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos os contratos</SelectItem>
                  {contratos.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      Versão {c.numero_versao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Estado vazio */}
      {!selectedObra && (
        <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-600 text-sm">Selecione uma obra para visualizar analytics</p>
        </div>
      )}

      {selectedObra && (
        <>
          {/* Tabs de análise */}
          <Tabs defaultValue="curva-s" className="space-y-4">
            <TabsList>
              <TabsTrigger value="curva-s">Curva S</TabsTrigger>
              <TabsTrigger value="desvios">Desvios</TabsTrigger>
              <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
            </TabsList>

            {/* Curva S */}
            <TabsContent value="curva-s">
              <CurvaSChart 
                obra_id={selectedObra}
                contrato_versao_id={selectedContrato}
              />
            </TabsContent>

            {/* Desvios */}
            <TabsContent value="desvios">
              <DesviosMedicaoAlerts obra_id={selectedObra} />
            </TabsContent>

            {/* Comparativo */}
            <TabsContent value="comparativo">
              <AnaliseComparativaChart 
                obra_id={selectedObra}
                contrato_versao_id={selectedContrato}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

export default function MedicoesAnalytics() {
  return (
    <RouteGuardWithFallback requiredPermissionKey="MEDICOES_VIEW">
      <MedicoesAnalyticsContent />
    </RouteGuardWithFallback>
  );
}
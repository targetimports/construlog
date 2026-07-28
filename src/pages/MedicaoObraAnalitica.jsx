import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, BarChart3, ClipboardList, TrendingUp } from 'lucide-react';
import MedicaoComAutomacao from '../components/medicoes/MedicaoComAutomacao';

export default function MedicaoObraAnalitica() {
  const [obraAtiva, setObraAtiva] = useState(null);

  const { data: obras } = useQuery({
    queryKey: ['obras-ativas'],
    queryFn: () => base44.entities.Obra.filter({ status: 'ativa' })
  });

  const { data: resumoObra } = useQuery({
    queryKey: ['resumo-obra', obraAtiva?.id],
    queryFn: () => base44.entities.ResumoObra.filter({ obra_id: obraAtiva.id }),
    enabled: !!obraAtiva
  });

  if (!obraAtiva) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="page-title">Medição Analítica de Obras</h1>
            <p className="page-subtitle">Lançar medições com vínculo obrigatório ao orçamento e consumo automático</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Selecione uma Obra</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {obras?.map(obra => (
                  <button
                    key={obra.id}
                    onClick={() => setObraAtiva(obra)}
                    className="border rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 transition text-left"
                  >
                    <h3 className="font-medium text-gray-900">{obra.nome}</h3>
                    <p className="text-sm text-gray-600 mt-1">{obra.endereco}</p>
                    <p className="text-xs text-gray-500 mt-2">Status: {obra.status}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="page-title">{obraAtiva.nome}</h1>
            <p className="page-subtitle">Medição Analítica com Consumo Automático</p>
          </div>
          <Button variant="outline" onClick={() => setObraAtiva(null)}>
            Mudar Obra
          </Button>
        </div>

        {/* KPIs Rápidos */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Custo Orçado</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                R$ {((resumoObra?.[0]?.orcamento_total || 0)).toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Custo Realizado</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                R$ {((resumoObra?.[0]?.custo_realizado_total || 0)).toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Saldo Disponível</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                R$ {((resumoObra?.[0]?.orcamento_total || 0) - (resumoObra?.[0]?.custo_realizado_total || 0)).toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Execução</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {(
                  (resumoObra?.[0]?.custo_realizado_total || 0) / 
                  (resumoObra?.[0]?.orcamento_total || 1) * 100
                ).toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Abas Principais */}
        <Tabs defaultValue="lancador" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="lancador" className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Lançar Medição
            </TabsTrigger>
          </TabsList>

          {/* Aba 1: Lançador de Medição */}
          <TabsContent value="lancador" className="space-y-6 mt-6">
            <MedicaoComAutomacao obra_id={obraAtiva.id} />
          </TabsContent>

        </Tabs>

        {/* Footer com Informações */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Fluxo de Processamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="bg-blue-100 text-blue-700 rounded-full w-10 h-10 flex items-center justify-center mx-auto font-bold mb-2">1</div>
                <p className="text-xs font-medium">Lançar Medição</p>
              </div>
              <div className="flex items-center justify-center">
                <div className="text-gray-400">→</div>
              </div>
              <div className="text-center">
                <div className="bg-blue-100 text-blue-700 rounded-full w-10 h-10 flex items-center justify-center mx-auto font-bold mb-2">2</div>
                <p className="text-xs font-medium">Consumir Insumos</p>
              </div>
              <div className="flex items-center justify-center">
                <div className="text-gray-400">→</div>
              </div>
              <div className="text-center">
                <div className="bg-green-100 text-green-700 rounded-full w-10 h-10 flex items-center justify-center mx-auto font-bold mb-2">3</div>
                <p className="text-xs font-medium">Gerar Custo Real</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
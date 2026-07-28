import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GanttChartObra from '../components/obra/GanttChartObra';
import GestaoFasesObra from '../components/obra/GestaoFasesObra';
import ProgressoObraFases from '../components/obra/ProgressoObraFases';
import GestorDocumentosObra from '../components/documentos/GestorDocumentosObra';
import DashboardObraIntegrado from '../components/obra/DashboardObraIntegrado';
import ValidadorIntegridadeObra from '../components/obra/ValidadorIntegridadeObra';
import { useSearchParams } from 'react-router-dom';

export default function GestaoObraDetalhada() {
  const [searchParams] = useSearchParams();
  const obra_id = searchParams.get('obra_id');
  const [faseAberta, setFaseAberta] = useState(null);

  const { data: obra } = useQuery({
    queryKey: ['obra', obra_id],
    queryFn: () => base44.entities.Obra.filter({ id: obra_id }),
    enabled: !!obra_id
  });

  if (!obra_id) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Nenhuma obra selecionada</p>
      </div>
    );
  }

  const obraData = obra?.[0];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="page-title">{obraData?.nome || 'Carregando...'}</h1>
          <p className="page-subtitle">Cronograma, Fases e Marcos</p>
        </div>
        {obra_id && <ValidadorIntegridadeObra obra_id={obra_id} />}
      </div>

      {/* TABS */}
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="flex w-full overflow-x-auto justify-start md:grid md:grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="gantt">Cronograma</TabsTrigger>
          <TabsTrigger value="progresso">Progresso</TabsTrigger>
          <TabsTrigger value="fases">Fases</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardObraIntegrado obra_id={obra_id} />
        </TabsContent>

        <TabsContent value="gantt" className="mt-6">
          <GanttChartObra obra_id={obra_id} />
        </TabsContent>

        <TabsContent value="progresso" className="mt-6">
          <ProgressoObraFases obra_id={obra_id} />
        </TabsContent>

        <TabsContent value="fases" className="mt-6">
          <GestaoFasesObra obra_id={obra_id} />
        </TabsContent>

        <TabsContent value="documentos" className="mt-6">
          <GestorDocumentosObra obra_id={obra_id} fase_id={faseAberta} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
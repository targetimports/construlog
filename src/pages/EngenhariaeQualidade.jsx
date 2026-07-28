import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, AlertTriangle, ClipboardList, TrendingUp, Plus } from 'lucide-react';
import { toast } from 'sonner';
import ErrorBoundary from '@/components/layout/ErrorBoundary';
import { createPageUrl } from '@/utils';
import { PageSkeleton } from '@/components/shared/Skeletons';

// Componentes internos
import PainelChecklistQualidade from '@/components/qualidade/PainelChecklistQualidade';
import ListaNaoConformidades from '@/components/qualidade/ListaNaoConformidades';
import DashboardQualidade from '@/components/qualidade/DashboardQualidade';
import FormNaoConformidade from '@/components/qualidade/FormNaoConformidade';

export default function EngenhariaeQualidade() {
  const [user, setUser] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('dashboard');
  const [usuarioLoading, setUsuarioLoading] = useState(true);
  const [mostrarFormNC, setMostrarFormNC] = useState(false);
  const queryClient = useQueryClient();

  // Carrega usuário
  React.useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setUsuarioLoading(false);
    }).catch(() => {
      setUsuarioLoading(false);
    });
  }, []);

  // Buscar data de checklists
  const { data: checklists = [], isLoading: checklistsLoading } = useQuery({
    queryKey: ['checklists-qualidade'],
    queryFn: () => base44.entities.ChecklistQualidade?.list('-updated_date', 100) || [],
    staleTime: 2 * 60 * 1000
  });

  // Buscar não-conformidades
  const { data: naoConformidades = [], isLoading: ncLoading } = useQuery({
    queryKey: ['nao-conformidades'],
    queryFn: () => base44.entities.NaoConformidade?.list('-updated_date', 100) || [],
    staleTime: 2 * 60 * 1000
  });

  // Calcular KPIs
  const kpis = useMemo(() => {
    const total = checklists.length;
    const completos = checklists.filter(c => c.status === 'concluído').length;
    const ncAbertos = naoConformidades.filter(nc => nc.status === 'aberto').length;
    const ncResolvidos = naoConformidades.filter(nc => nc.status === 'resolvido').length;

    return {
      totalChecklists: total,
      checklistsConcluidos: completos,
      taxaConclusao: total > 0 ? ((completos / total) * 100).toFixed(1) : 0,
      ncAbertos,
      ncResolvidos,
      totalNC: naoConformidades.length
    };
  }, [checklists, naoConformidades]);

  if (usuarioLoading) {
    return <div className="max-w-7xl mx-auto"><PageSkeleton /></div>;
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="page-title">Engenharia & Qualidade</h1>
              <p className="page-subtitle">Gerenciamento de checklists, não-conformidades e controle de qualidade</p>
            </div>
            <Button
              onClick={() => setMostrarFormNC(true)}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> Registrar Não-Conformidade
            </Button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="stat-label">Checklists</p>
                    <p className="stat-value">{kpis.checklistsConcluidos}/{kpis.totalChecklists}</p>
                    <p className="text-xs text-gray-600 mt-1">{kpis.taxaConclusao}% concluídos</p>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-green-600 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="stat-label">Não-Conformidades</p>
                    <p className="stat-value text-red-600">{kpis.ncAbertos}</p>
                    <p className="text-xs text-gray-600 mt-1">abertos</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-600 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="stat-label">Resolvidos</p>
                    <p className="stat-value text-blue-600">{kpis.ncResolvidos}</p>
                    <p className="text-xs text-gray-600 mt-1">de {kpis.totalNC}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-600 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="stat-label">Taxa Efetividade</p>
                    <p className="stat-value text-purple-600">
                      {kpis.totalNC > 0 ? ((kpis.ncResolvidos / kpis.totalNC) * 100).toFixed(0) : 0}%
                    </p>
                    <p className="text-xs text-gray-600 mt-1">resoluções</p>
                  </div>
                  <ClipboardList className="w-8 h-8 text-purple-600 opacity-20" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Card>
            <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
              <TabsList className="w-full justify-start border-b bg-white rounded-none p-0 h-auto">
                <TabsTrigger value="dashboard" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600">
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="checklists" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600">
                  Checklists ({checklists.length})
                </TabsTrigger>
                <TabsTrigger value="nao-conformidades" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600">
                  Não-Conformidades ({naoConformidades.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard" className="p-6">
                <ErrorBoundary>
                  <DashboardQualidade
                    checklists={checklists}
                    naoConformidades={naoConformidades}
                    loading={checklistsLoading || ncLoading}
                  />
                </ErrorBoundary>
              </TabsContent>

              <TabsContent value="checklists" className="p-6">
                <ErrorBoundary>
                  <PainelChecklistQualidade
                    checklists={checklists}
                    loading={checklistsLoading}
                    onRefresh={() => queryClient.invalidateQueries({ queryKey: ['checklists-qualidade'] })}
                  />
                </ErrorBoundary>
              </TabsContent>

              <TabsContent value="nao-conformidades" className="p-6">
                <ErrorBoundary>
                  <ListaNaoConformidades
                    naoConformidades={naoConformidades}
                    loading={ncLoading}
                    onRefresh={() => queryClient.invalidateQueries({ queryKey: ['nao-conformidades'] })}
                  />
                </ErrorBoundary>
              </TabsContent>
            </Tabs>
          </Card>

          {/* Modal - Registrar NC */}
          {mostrarFormNC && (
          <ErrorBoundary>
           <FormNaoConformidade
             open={mostrarFormNC}
             onClose={() => setMostrarFormNC(false)}
             onSuccess={() => {
               queryClient.invalidateQueries({ queryKey: ['nao-conformidades'] });
               setMostrarFormNC(false);
             }}
           />
          </ErrorBoundary>
          )}
          </div>
          </ErrorBoundary>
  );
}
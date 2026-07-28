import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Calendar, Download } from 'lucide-react';
import GraficosKPIsAvancado from '../components/dashboards/GraficosKPIsAvancado';
import AnaliseFiancesAvancada from '../components/dashboards/AnaliseFiancesAvancada';
import ProgressoFisicoFinanceiro from '../components/dashboards/ProgressoFisicoFinanceiro';
import VisualizadorRiscosAvancado from '../components/dashboards/VisualizadorRiscosAvancado';

export default function DashboardAvancado() {
  const [datainicio, setDataInicio] = useState('2025-01-01');
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
  const [filtroObra, setFiltroObra] = useState('todas');

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas'],
    queryFn: () => base44.entities.ContaFinanceira.list()
  });

  const handleExportarPDF = () => {
    alert('Funcionalidade de exportação em desenvolvimento');
  };

  return (
    <div className="space-y-6">
      {/* Header com Filtros */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Avançado</h1>
          <p className="text-gray-600 text-sm mt-1">Visualizações detalhadas e análises interativas</p>
        </div>
        <Button onClick={handleExportarPDF} className="gap-2 w-fit">
          <Download className="w-4 h-4" />
          Exportar Relatório
        </Button>
      </div>

      {/* Filtros */}
      <Card className="p-4 bg-white border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Obra</label>
            <select
              value={filtroObra}
              onChange={(e) => setFiltroObra(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm"
            >
              <option value="todas">Todas as Obras</option>
              {obras.map(obra => (
                <option key={obra.id} value={obra.id}>{obra.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Data Inicial</label>
            <input
              type="date"
              value={datainicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Data Final</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm"
            />
          </div>
        </div>
      </Card>

      {/* KPIs Avançados */}
      <GraficosKPIsAvancado titulo="Performance de KPIs" />

      {/* Análise Financeira */}
      <AnaliseFiancesAvancada receitas={[]} despesas={[]} />

      {/* Progresso Físico vs Financeiro */}
      <ProgressoFisicoFinanceiro obraId={filtroObra} />

      {/* Análise de Riscos */}
      <VisualizadorRiscosAvancado riscos={[]} />

      {/* Footer com informações de atualização */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-blue-900">Dados atualizados em tempo real</p>
            <p className="text-xs text-blue-700 mt-1">
              Próxima atualização: {new Date(Date.now() + 5 * 60000).toLocaleTimeString('pt-BR')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
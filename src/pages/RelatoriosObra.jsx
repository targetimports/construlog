import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  FileText, 
  Download, 
  Calendar,
  TrendingUp,
  DollarSign,
  Building2,
  FileSpreadsheet,
  Loader2,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/ui/PageHeader';
import RelatorioProgressoFinanceiro from '@/components/relatorios-obra/RelatorioProgressoFinanceiro';
import RelatorioCustosCentroCusto from '@/components/relatorios-obra/RelatorioCustosCentroCusto';
import RelatorioStatusObras from '@/components/relatorios-obra/RelatorioStatusObras';
import { toast } from 'sonner';

export default function RelatoriosObra() {
  const [obraFiltro, setObraFiltro] = useState('todas');
  const [tipoRelatorio, setTipoRelatorio] = useState('financeiro');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [exportando, setExportando] = useState(false);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const handleExportarExcel = async (tipo) => {
    try {
      setExportando(true);
      
      const response = await base44.functions.invoke('gerarRelatorioExcelObra', {
        tipo,
        obra_id: obraFiltro === 'todas' ? null : obraFiltro
      });

      if (!response?.data) {
        throw new Error('Nenhum dado de Excel recebido');
      }

      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-${tipo}-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Excel baixado com sucesso!');
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao exportar: ' + error.message);
    } finally {
      setExportando(false);
    }
  };

  const handleExportarCSV = async (tipoRelatorio) => {
    try {
      setExportando(true);
      const response = await base44.functions.invoke('gerarRelatorioCSVObra', {
        tipo: tipoRelatorio,
        obra_id: obraFiltro === 'todas' ? null : obraFiltro,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim
      });

      const csvData = response?.data;
      if (!csvData) {
        throw new Error('Nenhum dado de CSV recebido');
      }

      // Download do CSV
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-${tipoRelatorio}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success('Relatório CSV exportado com sucesso!');
    } catch (error) {
      toast.error('Erro ao exportar CSV: ' + error.message);
      console.error('Erro ao exportar:', error);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios de Obras"
        subtitle="Analise dados, visualize tendências e exporte relatórios completos"
      />

      {/* Filtros Globais */}
      <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 shadow-lg">
        <CardHeader className="pb-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Filter className="w-5 h-5 text-blue-400" />
            </div>
            <CardTitle className="text-lg font-bold text-white">Filtros de Relatório</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Tipo</label>
              <Select value={tipoRelatorio} onValueChange={setTipoRelatorio}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="financeiro">Progresso Financeiro</SelectItem>
                  <SelectItem value="custos">Custos por Centro</SelectItem>
                  <SelectItem value="status">Status das Obras</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Obra</label>
              <Select value={obraFiltro} onValueChange={setObraFiltro}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Obras</SelectItem>
                  {obras.map(obra => (
                    <SelectItem key={obra.id} value={obra.id}>
                      {obra.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wide">De</label>
              <input
                type="date"
                value={periodoInicio}
                onChange={(e) => setPeriodoInicio(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-slate-600 bg-slate-700 text-white text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Até</label>
              <input
                type="date"
                value={periodoFim}
                onChange={(e) => setPeriodoFim(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-slate-600 bg-slate-700 text-white text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Abas de Relatórios */}
      <Tabs value={tipoRelatorio} onValueChange={setTipoRelatorio} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 bg-slate-100 border border-slate-200 p-1">
          <TabsTrigger value="financeiro" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-600">
            <DollarSign className="w-4 h-4" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="custos" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-600">
            <TrendingUp className="w-4 h-4" />
            Custos
          </TabsTrigger>
          <TabsTrigger value="status" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-600">
            <Building2 className="w-4 h-4" />
            Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro">
          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 pb-6">
              <CardTitle className="text-white text-lg">Progresso Financeiro</CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleExportarExcel('financeiro')}
                  disabled={exportando}
                  className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold"
                >
                  {exportando ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {exportando ? 'Exportando...' : 'Exportar Excel'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportarCSV('financeiro')}
                  disabled={exportando}
                  className="border-white text-white hover:bg-blue-500"
                >
                  {exportando ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                  )}
                  CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <RelatorioProgressoFinanceiro 
                obraId={obraFiltro === 'todas' ? null : obraFiltro}
                periodoInicio={periodoInicio}
                periodoFim={periodoFim}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custos">
          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 pb-6">
              <CardTitle className="text-white text-lg">Custos por Centro de Custo</CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleExportarExcel('custos')}
                  disabled={exportando}
                  className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold"
                >
                  {exportando ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {exportando ? 'Exportando...' : 'Exportar Excel'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportarCSV('custos')}
                  disabled={exportando}
                  className="border-white text-white hover:bg-blue-500"
                >
                  {exportando ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                  )}
                  CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <RelatorioCustosCentroCusto 
                obraId={obraFiltro === 'todas' ? null : obraFiltro}
                periodoInicio={periodoInicio}
                periodoFim={periodoFim}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status">
          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 pb-6">
              <CardTitle className="text-white text-lg">Status de Todas as Obras Ativas</CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleExportarExcel('status')}
                  disabled={exportando}
                  className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold"
                >
                  {exportando ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {exportando ? 'Exportando...' : 'Exportar Excel'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportarCSV('status')}
                  disabled={exportando}
                  className="border-white text-white hover:bg-blue-500"
                >
                  {exportando ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                  )}
                  CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <RelatorioStatusObras 
                periodoInicio={periodoInicio}
                periodoFim={periodoFim}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
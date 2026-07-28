import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function RelatorioGraficoDiario({ open, onClose }) {
  const [periodo, setPeriodo] = useState({
    dataInicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dataFim: new Date().toISOString().split('T')[0],
    obra_id: ''
  });

  const [visualizacao, setVisualizacao] = useState('registros'); // registros | horas | ocorrencias

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-grafico'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: diarios = [], isLoading } = useQuery({
    queryKey: ['diarios-grafico', periodo],
    queryFn: async () => {
      const query = {};
      if (periodo.obra_id) query.obra_id = periodo.obra_id;
      const result = await base44.entities.DiarioObra.filter(query, '-data', 500);
      
      // Filtrar por período no frontend (como fallback)
      return result.filter(d => {
        if (!d.data) return false;
        return d.data >= periodo.dataInicio && d.data <= periodo.dataFim;
      });
    },
    enabled: open && !!periodo.dataInicio && !!periodo.dataFim
  });

  const processarDados = () => {
    if (!diarios || diarios.length === 0) return null;

    // Agrupar por data
    const dadosPorData = {};
    diarios.forEach(d => {
      const data = d.data;
      if (!dadosPorData[data]) {
        dadosPorData[data] = {
          data,
          registros: 0,
          horas: 0,
          ocorrencias: 0,
          funcionarios: 0
        };
      }
      dadosPorData[data].registros += 1;
      dadosPorData[data].horas += d.qtd_funcionarios || 0; // Aproximação: funcionários como proxy de horas
      dadosPorData[data].ocorrencias += (d.ocorrencias || d.ocorrencias_detalhadas?.length) ? 1 : 0;
      dadosPorData[data].funcionarios += d.qtd_funcionarios || 0;
    });

    // Converter para array e ordenar
    return Object.values(dadosPorData)
      .sort((a, b) => a.data.localeCompare(b.data))
      .map(d => ({
        ...d,
        dataFormatada: new Date(String(d.data).length === 10 ? d.data + 'T00:00:00' : d.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      }));
  };

  const dadosProcessados = processarDados();

  const renderGrafico = () => {
    // Degradação segura: sempre mostrar "Registros por dia" se não houver outros dados
    if (!dadosProcessados || dadosProcessados.length === 0) {
      return (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
            <p className="text-yellow-800 font-medium">Sem dados para o período selecionado</p>
            <p className="text-yellow-600 text-sm mt-1">
              Ajuste o período ou selecione uma obra específica
            </p>
          </CardContent>
        </Card>
      );
    }

    const temHoras = dadosProcessados.some(d => d.horas > 0);
    const temOcorrencias = dadosProcessados.some(d => d.ocorrencias > 0);

    // Se não tiver dados de horas/ocorrências, forçar para "registros"
    const visualizacaoSegura = 
      (visualizacao === 'horas' && !temHoras) ||
      (visualizacao === 'ocorrencias' && !temOcorrencias)
        ? 'registros'
        : visualizacao;

    const configs = {
      registros: {
        titulo: 'Registros por Dia',
        chave: 'registros',
        cor: '#3B82F6',
        tipo: 'bar'
      },
      horas: {
        titulo: 'Total de Funcionários por Dia',
        chave: 'funcionarios',
        cor: '#10B981',
        tipo: 'line'
      },
      ocorrencias: {
        titulo: 'Ocorrências por Dia',
        chave: 'ocorrencias',
        cor: '#EF4444',
        tipo: 'bar'
      }
    };

    const config = configs[visualizacaoSegura];

    return (
      <div>
        <ResponsiveContainer width="100%" height={300}>
          {config.tipo === 'bar' ? (
            <BarChart data={dadosProcessados}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dataFormatada" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={config.chave} fill={config.cor} name={config.titulo} />
            </BarChart>
          ) : (
            <LineChart data={dadosProcessados}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dataFormatada" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey={config.chave} stroke={config.cor} name={config.titulo} />
            </LineChart>
          )}
        </ResponsiveContainer>

        {/* Avisos de dados ausentes */}
        {!temHoras && visualizacao === 'horas' && (
          <p className="text-sm text-yellow-600 mt-2 text-center">
            Dados de horas não disponíveis. Mostrando registros.
          </p>
        )}
        {!temOcorrencias && visualizacao === 'ocorrencias' && (
          <p className="text-sm text-yellow-600 mt-2 text-center">
            Nenhuma ocorrência registrada no período.
          </p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Relatório Gráfico - Diário de Obra</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Data Início *</label>
              <Input
                type="date"
                value={periodo.dataInicio}
                onChange={(e) => setPeriodo({ ...periodo, dataInicio: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Data Fim *</label>
              <Input
                type="date"
                value={periodo.dataFim}
                onChange={(e) => setPeriodo({ ...periodo, dataFim: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Obra (opcional)</label>
              <select
                value={periodo.obra_id}
                onChange={(e) => setPeriodo({ ...periodo, obra_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Todas</option>
                {obras.map(o => (
                  <option key={o.id} value={o.id}>{o.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tipo de Visualização */}
          <div className="flex gap-2">
            <Button
              variant={visualizacao === 'registros' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setVisualizacao('registros')}
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              Registros
            </Button>
            <Button
              variant={visualizacao === 'horas' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setVisualizacao('horas')}
            >
              <TrendingUp className="w-4 h-4 mr-1" />
              Funcionários
            </Button>
            <Button
              variant={visualizacao === 'ocorrencias' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setVisualizacao('ocorrencias')}
            >
              <AlertCircle className="w-4 h-4 mr-1" />
              Ocorrências
            </Button>
          </div>

          {/* Gráfico */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            renderGrafico()
          )}

          {/* Resumo */}
          {dadosProcessados && dadosProcessados.length > 0 && (
            <div className="grid grid-cols-3 gap-3 pt-3 border-t">
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-gray-600">Total de Registros</p>
                  <p className="text-2xl font-bold text-blue-600">{dadosProcessados.reduce((s, d) => s + d.registros, 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-gray-600">Dias Registrados</p>
                  <p className="text-2xl font-bold text-green-600">{dadosProcessados.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-gray-600">Total Ocorrências</p>
                  <p className="text-2xl font-bold text-red-600">{dadosProcessados.reduce((s, d) => s + d.ocorrencias, 0)}</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
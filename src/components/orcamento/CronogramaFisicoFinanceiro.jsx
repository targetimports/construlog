import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Calendar, TrendingUp, AlertCircle, Edit2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

export default function CronogramaFisicoFinanceiro({ orcamentoId, obraId }) {
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState({});
  const queryClient = useQueryClient();

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ['orcamento-cronograma', orcamentoId],
    queryFn: async () => {
      return base44.entities.OrcamentoItem.filter({ orcamento_id: orcamentoId });
    },
    enabled: !!orcamentoId
  });

  const updateMutation = useMutation({
    mutationFn: async (updates) => {
      await Promise.all(
        updates.map(({ id, data }) => base44.entities.OrcamentoItem.update(id, data))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['orcamento-cronograma']);
      setEditMode(false);
      setEditedData({});
      toast.success('Cronograma atualizado');
    }
  });

  // Agrupa itens por mês
  const itensPorMes = itens.reduce((acc, item) => {
    const mes = item.mes_previsto || 1;
    if (!acc[mes]) {
      acc[mes] = { mes, itens: [], previsto: 0, realizado: 0 };
    }
    acc[mes].itens.push(item);
    acc[mes].previsto += item.custo_total || 0;
    acc[mes].realizado += item.valor_realizado || 0;
    return acc;
  }, {});

  // Calcula Curva S (acumulado)
  const mesesOrdenados = Object.keys(itensPorMes).sort((a, b) => a - b);
  let acumuladoPrevisto = 0;
  let acumuladoRealizado = 0;

  const dadosCurvaS = mesesOrdenados.map(mes => {
    acumuladoPrevisto += itensPorMes[mes].previsto;
    acumuladoRealizado += itensPorMes[mes].realizado;
    
    return {
      mes: `Mês ${mes}`,
      previsto: acumuladoPrevisto,
      realizado: acumuladoRealizado,
      previstoPercentual: 0,
      realizadoPercentual: 0
    };
  });

  const valorTotalOrcamento = itens.reduce((sum, item) => sum + (item.custo_total || 0), 0);
  const valorTotalRealizado = itens.reduce((sum, item) => sum + (item.valor_realizado || 0), 0);

  // Calcula percentuais
  dadosCurvaS.forEach(d => {
    d.previstoPercentual = (d.previsto / valorTotalOrcamento) * 100;
    d.realizadoPercentual = (d.realizado / valorTotalOrcamento) * 100;
  });

  // Dados mensais (não acumulados)
  const dadosMensais = mesesOrdenados.map(mes => ({
    mes: `Mês ${mes}`,
    previsto: itensPorMes[mes].previsto,
    realizado: itensPorMes[mes].realizado
  }));

  // Agrupa por etapa
  const itensPorEtapa = itens.reduce((acc, item) => {
    const etapa = item.etapa || 'Sem etapa';
    if (!acc[etapa]) {
      acc[etapa] = { etapa, previsto: 0, realizado: 0 };
    }
    acc[etapa].previsto += item.custo_total || 0;
    acc[etapa].realizado += item.valor_realizado || 0;
    return acc;
  }, {});

  const dadosEtapas = Object.values(itensPorEtapa);

  const handleEdit = (itemId, field, value) => {
    setEditedData(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const handleSave = () => {
    const updates = Object.entries(editedData).map(([id, data]) => ({ id, data }));
    updateMutation.mutate(updates);
  };

  if (isLoading) {
    return <div className="p-6">Carregando cronograma...</div>;
  }

  if (itens.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Nenhum item no orçamento</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Valor Total Previsto</p>
            <p className="text-2xl font-bold text-blue-600">
              {valorTotalOrcamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Valor Realizado</p>
            <p className="text-2xl font-bold text-emerald-600">
              {valorTotalRealizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Execução Física</p>
            <p className="text-2xl font-bold text-purple-600">
              {((valorTotalRealizado / valorTotalOrcamento) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Desvio</p>
            <p className={`text-2xl font-bold ${valorTotalRealizado > valorTotalOrcamento ? 'text-red-600' : 'text-emerald-600'}`}>
              {((valorTotalRealizado - valorTotalOrcamento) / valorTotalOrcamento * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Curva S */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Curva S - Previsto vs Realizado (Acumulado)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosCurvaS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" stroke="#6B7280" fontSize={12} />
                <YAxis 
                  stroke="#6B7280" 
                  fontSize={12}
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                />
                <Tooltip
                  formatter={(value, name) => [
                    `${value.toFixed(1)}%`,
                    name === 'previstoPercentual' ? 'Previsto' : 'Realizado'
                  ]}
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="previstoPercentual" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  name="Previsto (%)"
                  dot={{ fill: '#3B82F6', r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="realizadoPercentual" 
                  stroke="#10B981" 
                  strokeWidth={3}
                  name="Realizado (%)"
                  dot={{ fill: '#10B981', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Desembolso Mensal */}
      <Card>
        <CardHeader>
          <CardTitle>Desembolso Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosMensais}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" stroke="#6B7280" fontSize={12} />
                <YAxis 
                  stroke="#6B7280" 
                  fontSize={12}
                  tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar dataKey="previsto" fill="#3B82F6" name="Previsto" radius={[8, 8, 0, 0]} />
                <Bar dataKey="realizado" fill="#10B981" name="Realizado" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Custo por Etapa */}
      <Card>
        <CardHeader>
          <CardTitle>Custo por Etapa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosEtapas} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  type="number" 
                  stroke="#6B7280" 
                  fontSize={12}
                  tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
                />
                <YAxis dataKey="etapa" type="category" stroke="#6B7280" fontSize={11} width={150} />
                <Tooltip
                  formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar dataKey="previsto" fill="#3B82F6" name="Previsto" radius={[0, 8, 8, 0]} />
                <Bar dataKey="realizado" fill="#10B981" name="Realizado" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Edição */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Planejamento por Item</CardTitle>
            {!editMode ? (
              <Button onClick={() => setEditMode(true)} variant="outline" size="sm">
                <Edit2 className="w-4 h-4 mr-2" />
                Editar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleSave} size="sm" disabled={updateMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </Button>
                <Button onClick={() => { setEditMode(false); setEditedData({}); }} variant="outline" size="sm">
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-semibold text-gray-900">Item</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-900">Etapa</th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-900">Mês</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-900">Custo Total</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-900">% Período</th>
                </tr>
              </thead>
              <tbody>
                {itens.slice(0, 20).map(item => {
                  const edited = editedData[item.id] || {};
                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2 text-gray-700 max-w-xs truncate">
                        {item.composicao_snapshot?.descricao || 'Item'}
                      </td>
                      <td className="py-3 px-2">
                        {editMode ? (
                          <Input
                            value={edited.etapa !== undefined ? edited.etapa : (item.etapa || '')}
                            onChange={(e) => handleEdit(item.id, 'etapa', e.target.value)}
                            className="h-8 text-sm"
                            placeholder="Ex: Fundação"
                          />
                        ) : (
                          <Badge variant="outline">{item.etapa || '-'}</Badge>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {editMode ? (
                          <Input
                            type="number"
                            min="1"
                            max="36"
                            value={edited.mes_previsto !== undefined ? edited.mes_previsto : (item.mes_previsto || 1)}
                            onChange={(e) => handleEdit(item.id, 'mes_previsto', parseInt(e.target.value))}
                            className="h-8 text-sm w-20 mx-auto"
                          />
                        ) : (
                          <Badge>{item.mes_previsto || 1}</Badge>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right font-semibold text-gray-900">
                        {(item.custo_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {editMode ? (
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={edited.percentual_periodo !== undefined ? edited.percentual_periodo : (item.percentual_periodo || 0)}
                            onChange={(e) => handleEdit(item.id, 'percentual_periodo', parseFloat(e.target.value))}
                            className="h-8 text-sm w-20 ml-auto"
                          />
                        ) : (
                          <span className="text-gray-700">{(item.percentual_periodo || 0).toFixed(1)}%</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {itens.length > 20 && (
            <p className="text-sm text-gray-500 mt-4 text-center">
              Mostrando 20 de {itens.length} itens
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
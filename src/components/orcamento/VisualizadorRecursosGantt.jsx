import React, { useMemo } from 'react';
import { AlertCircle, Users, Zap, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

export default function VisualizadorRecursosGantt({ alocacoes, itensOrcamento }) {
  const analiseRecursos = useMemo(() => {
    if (!alocacoes || alocacoes.length === 0) return null;

    const dataGrafico = [];
    let custo = 0;
    let sobrecargaCount = 0;
    const recursosPorTipo = { mao_obra: 0, equipamento: 0, material: 0 };

    alocacoes.forEach(aloc => {
      const item = itensOrcamento?.find(i => i.id === aloc.item_orcamento_id);
      
      dataGrafico.push({
        descricao: item?.descricao || 'Item ' + aloc.item_orcamento_id.slice(0, 8),
        carga: aloc.carga_trabalho_diaria,
        limite: aloc.limite_capacidade,
        eficiencia: aloc.eficiencia_estimada
      });

      custo += aloc.custo_total_alocado || 0;
      if (aloc.aviso_sobrecarga) sobrecargaCount++;

      aloc.recursos_alocados?.forEach(rec => {
        recursosPorTipo[rec.tipo_recurso]++;
      });
    });

    return {
      dataGrafico,
      custoTotal: custo,
      sobrecargaCount,
      recursosPorTipo,
      eficienciaMedia: alocacoes.reduce((acc, a) => acc + (a.eficiencia_estimada || 100), 0) / alocacoes.length
    };
  }, [alocacoes, itensOrcamento]);

  if (!analiseRecursos) {
    return (
      <Card className="bg-gray-50">
        <CardContent className="py-8 text-center">
          <p className="text-gray-600">Sem alocações de recursos</p>
        </CardContent>
      </Card>
    );
  }

  const { dataGrafico, custoTotal, sobrecargaCount, recursosPorTipo, eficienciaMedia } = analiseRecursos;

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
              <Users className="w-4 h-4" /> Mão de Obra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{recursosPorTipo.mao_obra}</p>
            <p className="text-xs text-gray-500 mt-1">recursos alocados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Equipamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{recursosPorTipo.equipamento}</p>
            <p className="text-xs text-gray-500 mt-1">alocados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Sobrecarga
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn(
              "text-2xl font-bold",
              sobrecargaCount > 0 ? "text-red-600" : "text-green-600"
            )}>
              {sobrecargaCount}
            </p>
            <p className="text-xs text-gray-500 mt-1">itens com sobrecarga</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Eficiência Média</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn(
              "text-2xl font-bold",
              eficienciaMedia >= 80 ? "text-green-600" : 
              eficienciaMedia >= 60 ? "text-yellow-600" : 
              "text-red-600"
            )}>
              {eficienciaMedia.toFixed(0)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">utilização</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Carga */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Carga de Trabalho por Item</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dataGrafico}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="descricao" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="carga" fill="#3b82f6" name="Carga Atual" />
              <Bar dataKey="limite" fill="#ef4444" name="Limite" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detalhes de Alocações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Detalhes de Alocações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {alocacoes.map((aloc) => {
              const item = itensOrcamento?.find(i => i.id === aloc.item_orcamento_id);
              const percentualCarga = (aloc.carga_trabalho_diaria / aloc.limite_capacidade) * 100;
              
              return (
                <div key={aloc.id} className={cn(
                  'border border-gray-200 rounded p-3',
                  aloc.aviso_sobrecarga ? 'bg-red-50 border-red-300' : 'bg-gray-50'
                )}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-sm">
                        {item?.descricao || 'Item desconhecido'}
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        {aloc.data_inicio} até {aloc.data_fim}
                      </p>
                    </div>
                    {aloc.aviso_sobrecarga && (
                      <Badge className="bg-red-100 text-red-800">Sobrecarga</Badge>
                    )}
                  </div>

                  {/* Carga de Trabalho */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">Carga: {aloc.carga_trabalho_diaria.toFixed(1)}h</span>
                      <span className={cn(
                        "font-semibold",
                        percentualCarga > 100 ? "text-red-600" : "text-gray-900"
                      )}>
                        {percentualCarga.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={Math.min(percentualCarga, 100)} className="h-2" />
                  </div>

                  {/* Recursos */}
                  {aloc.recursos_alocados && aloc.recursos_alocados.length > 0 && (
                    <div className="space-y-2 text-xs border-t border-gray-200 pt-2 mt-2">
                      {aloc.recursos_alocados.map((rec, idx) => (
                        <div key={idx} className="flex justify-between items-center text-gray-600">
                          <span>
                            {rec.tipo_recurso === 'mao_obra' ? '' : rec.tipo_recurso === 'equipamento' ? '' : ''} 
                            {' '}{rec.descricao}
                          </span>
                          <span className="font-semibold text-gray-900">
                            {rec.quantidade} {rec.unidade}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Custo */}
                  <div className="mt-3 pt-2 border-t border-gray-200 flex justify-between text-sm">
                    <span className="text-gray-600">Custo Alocado:</span>
                    <span className="font-semibold text-gray-900">
                      R$ {(aloc.custo_total_alocado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Resumo Financeiro */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">Custo Total de Recursos Alocados</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                R$ {custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <Package className="w-12 h-12 text-blue-300" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
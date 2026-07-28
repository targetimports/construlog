import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, Package, AlertCircle } from 'lucide-react';

export default function PrevisaoDemanda({ dados }) {
  if (!dados) {
    return <div className="text-gray-500">Sem dados de previsão</div>;
  }

  const tendenciaIcons = {
    crescente: <TrendingUp className="w-5 h-5 text-red-500" />,
    estável: <Package className="w-5 h-5 text-blue-500" />,
    decrescente: <TrendingUp className="w-5 h-5 text-green-500 rotate-180" />
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Consumo Médio Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dados.media_mensal}</p>
            <p className="text-xs text-gray-500">unidades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Tendência</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {tendenciaIcons[dados.tendencia]}
              <Badge className={dados.tendencia === 'crescente' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}>
                {dados.tendencia}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Ordens Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dados.ordens_pendentes}</p>
            <p className="text-xs text-gray-500">unidades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Próximo Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dados.mes_proximo_estimado}</p>
            <p className="text-xs text-gray-500">estimado</p>
          </CardContent>
        </Card>
      </div>

      {dados.historico_consumo && dados.historico_consumo.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Consumo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dados.historico_consumo}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="consumo" fill="#3B82F6" name="Consumo (unidades)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
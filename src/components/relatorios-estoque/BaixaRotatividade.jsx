import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock } from 'lucide-react';

export default function BaixaRotatividade({ dados }) {
  if (!dados || dados.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-green-600">✓ Todos os materiais têm boa rotatividade</div>
        </CardContent>
      </Card>
    );
  }

  const criticar = dados.filter(d => d.diasInativo > 180);
  const atencao = dados.filter(d => d.diasInativo > 90 && d.diasInativo <= 180);

  return (
    <div className="space-y-6">
      {criticar.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Crítico - Acima de 180 dias ({criticar.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {criticar.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-white rounded border border-red-200">
                  <div>
                    <p className="font-medium text-gray-900">{m.nome}</p>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <Clock className="w-4 h-4" /> {m.diasInativo} dias inativo
                    </p>
                  </div>
                  <Badge className="bg-red-600">Descontinuar</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {atencao.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-900 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Atenção - 90 a 180 dias ({atencao.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {atencao.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-white rounded border border-yellow-200">
                  <div>
                    <p className="font-medium text-gray-900">{m.nome}</p>
                    <p className="text-sm text-gray-600">{m.diasInativo} dias sem movimento</p>
                  </div>
                  <Badge className="bg-yellow-600">Revisar</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Todos os Itens Inativos</CardTitle>
          <p className="text-sm text-gray-600">Acima de 90 dias sem movimentação</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Material</th>
                  <th className="text-right py-2">Dias Inativo</th>
                  <th className="text-right py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {dados.map(m => (
                  <tr key={m.id} className="border-b hover:bg-gray-50">
                    <td className="py-3">{m.nome}</td>
                    <td className="text-right">{m.diasInativo} dias</td>
                    <td className="text-right">
                      <Badge className={m.diasInativo > 180 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                        {m.diasInativo > 180 ? 'Crítico' : 'Atenção'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
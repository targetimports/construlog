import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export default function TabelaMateriais({ depositoFiltro }) {
  const [busca, setBusca] = useState('');

  const { data: materiais = [] } = useQuery({
    queryKey: ['materiais'],
    queryFn: () => base44.entities.Material?.list?.() || []
  });

  const materiaisFiltrados = materiais.filter(m => 
    m.nome.toLowerCase().includes(busca.toLowerCase()) ||
    m.categoria.toLowerCase().includes(busca.toLowerCase())
  );

  const getStatusBadge = (material) => {
    if (material.estoque_atual === 0) {
      return <Badge className="bg-red-100 text-red-800 gap-1"><TrendingDown className="w-3 h-3" /> Zerado</Badge>;
    }
    if (material.estoque_atual <= material.estoque_minimo) {
      return <Badge className="bg-orange-100 text-orange-800 gap-1"><AlertTriangle className="w-3 h-3" /> Alerta</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">OK</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Materiais em Estoque</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Busca */}
        <Input
          placeholder="Buscar material..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="text-sm h-8"
        />

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-2 text-left">Material</th>
                <th className="p-2 text-right">Estoque</th>
                <th className="p-2 text-right">Mínimo</th>
                <th className="p-2 text-right">Preço Médio</th>
                <th className="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {materiaisFiltrados.map(m => (
                <tr key={m.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">
                    <p className="font-medium">{m.nome}</p>
                    <p className="text-gray-500">{m.categoria}</p>
                  </td>
                  <td className="p-2 text-right">
                    <p className="font-bold">{m.estoque_atual}</p>
                    <p className="text-gray-500">{m.unidade}</p>
                  </td>
                  <td className="p-2 text-right">{m.estoque_minimo}</td>
                  <td className="p-2 text-right">R$ {m.preco_medio?.toFixed(2) || '0.00'}</td>
                  <td className="p-2 text-center">{getStatusBadge(m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {materiaisFiltrados.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-4">Nenhum material encontrado</p>
        )}
      </CardContent>
    </Card>
  );
}
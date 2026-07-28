import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Package, Warehouse, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function DashboardEstoque() {
  const [depositoFiltro, setDepositoFiltro] = useState('todos');

  const { data: materiais = [] } = useQuery({
    queryKey: ['materiais'],
    queryFn: () => base44.entities.Material?.list?.() || []
  });

  const { data: depositos = [] } = useQuery({
    queryKey: ['depositos'],
    queryFn: () => base44.entities.LocalEstoque?.list?.() || []
  });

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['movimentacoes-estoque'],
    queryFn: () => base44.entities.MovimentacaoEstoque?.filter?.({}) || []
  });

  // Calcular KPIs
  const materiaisAlerta = materiais.filter(m => 
    m.estoque_atual <= m.estoque_minimo && m.estoque_atual > 0
  );

  const materiaisZerados = materiais.filter(m => m.estoque_atual === 0);

  const valorTotalEstoque = materiais.reduce((acc, m) => 
    acc + (m.estoque_atual * m.preco_medio || 0), 0
  );

  const movimentacoesHoje = movimentacoes.filter(m => {
    const data = new Date(m.data_movimento);
    const hoje = new Date();
    return data.toDateString() === hoje.toDateString();
  });

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-600">Total de Itens</p>
            <p className="text-2xl font-bold text-blue-600">{materiais.length}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-600">Alertas</p>
                <p className="text-2xl font-bold text-red-600">{materiaisAlerta.length}</p>
              </div>
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-600">Zerados</p>
            <p className="text-2xl font-bold text-orange-600">{materiaisZerados.length}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-600">Valor Total</p>
            <p className="text-lg font-bold text-green-600">R$ {(valorTotalEstoque / 1000).toFixed(1)}k</p>
          </CardContent>
        </Card>
      </div>

      {/* Materiais com Alerta */}
      {materiaisAlerta.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              Materiais Abaixo do Mínimo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {materiaisAlerta.slice(0, 5).map(m => (
                <div key={m.id} className="flex justify-between items-center p-2 bg-white rounded border-l-4 border-orange-500">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{m.nome}</p>
                    <p className="text-xs text-gray-600">{m.categoria}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-orange-600">{m.estoque_atual} {m.unidade}</p>
                    <p className="text-xs text-gray-500">Min: {m.estoque_minimo}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Movimentações Recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Movimentações Hoje ({movimentacoesHoje.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {movimentacoesHoje.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma movimentação hoje</p>
          ) : (
            <div className="space-y-2">
              {movimentacoesHoje.slice(0, 5).map((m, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 border-b text-xs">
                  <div className="flex-1">
                    <Badge variant={m.tipo === 'entrada' ? 'default' : 'destructive'} className="mb-1">
                      {m.tipo}
                    </Badge>
                    <p className="text-gray-700">{m.material_id}</p>
                  </div>
                  <span className={`font-bold ${m.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                    {m.tipo === 'entrada' ? '+' : '-'} {Math.abs(m.quantidade)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
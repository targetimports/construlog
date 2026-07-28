import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { ArrowDownLeft, ArrowUpRight, Repeat2 } from 'lucide-react';

export default function RelatorioMovimentacoes({ movimentacoes, ativos }) {
  const movimentosPorMes = useMemo(() => {
    const grupos = {};
    
    movimentacoes.forEach(mov => {
      const data = new Date(mov.created_date);
      const mes = `${data.getMonth() + 1}/${data.getFullYear()}`;
      grupos[mes] = (grupos[mes] || 0) + 1;
    });

    return Object.entries(grupos)
      .sort((a, b) => {
        const [mesA, anoA] = a[0].split('/').map(Number);
        const [mesB, anoB] = b[0].split('/').map(Number);
        return anoA - anoB || mesA - mesB;
      })
      .slice(-12)
      .map(([mes, count]) => ({ mes, quantidade: count }));
  }, [movimentacoes]);

  const movimentosPorTipo = useMemo(() => {
    const tipos = {
      saida: movimentacoes.filter(m => m.tipo === 'saida').length,
      entrada: movimentacoes.filter(m => m.tipo === 'entrada').length,
      transferencia: movimentacoes.filter(m => m.tipo === 'transferencia').length,
      manutencao: movimentacoes.filter(m => m.tipo === 'manutencao').length
    };
    return tipos;
  }, [movimentacoes]);

  const ativosMaisMovimentados = useMemo(() => {
    const contagem = {};
    movimentacoes.forEach(mov => {
      const ativo = ativos.find(a => a.id === mov.ativo_id);
      if (ativo) {
        contagem[ativo.id] = (contagem[ativo.id] || 0) + 1;
      }
    });

    return Object.entries(contagem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ativoId, qty]) => {
        const ativo = ativos.find(a => a.id === ativoId);
        return { nome: ativo?.nome?.substring(0, 15) || 'Desconhecido', movimentacoes: qty };
      });
  }, [movimentacoes, ativos]);

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ArrowUpRight className="w-6 h-6 text-emerald-500" />
              <div>
                <div className="text-sm text-gray-500">Entradas</div>
                <div className="text-lg sm:text-2xl font-bold text-gray-900">{movimentosPorTipo.entrada}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ArrowDownLeft className="w-6 h-6 text-red-500" />
              <div>
                <div className="text-sm text-gray-500">Saídas</div>
                <div className="text-lg sm:text-2xl font-bold text-gray-900">{movimentosPorTipo.saida}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Repeat2 className="w-6 h-6 text-blue-500" />
              <div>
                <div className="text-sm text-gray-500">Transferências</div>
                <div className="text-lg sm:text-2xl font-bold text-gray-900">{movimentosPorTipo.transferencia}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div>
              <div className="text-sm text-gray-500">Total Movimentações</div>
              <div className="text-lg sm:text-2xl font-bold text-gray-900">{movimentacoes.length}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Movimentações nos Últimos 12 Meses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={movimentosPorMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="quantidade" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Distribuição por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-500">Entradas</span>
                <Badge className="bg-emerald-100 text-emerald-700 border-0">{movimentosPorTipo.entrada}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-500">Saídas</span>
                <Badge className="bg-red-100 text-red-700 border-0">{movimentosPorTipo.saida}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-500">Transferências</span>
                <Badge className="bg-blue-100 text-blue-700 border-0">{movimentosPorTipo.transferencia}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-500">Manutenção</span>
                <Badge className="bg-amber-100 text-amber-700 border-0">{movimentosPorTipo.manutencao}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ativos Mais Movimentados */}
      {ativosMaisMovimentados.length > 0 && (
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Top 10 Ativos Mais Movimentados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ativosMaisMovimentados} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" stroke="#9CA3AF" />
                  <YAxis dataKey="nome" type="category" stroke="#9CA3AF" fontSize={11} width={100} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                  <Bar dataKey="movimentacoes" fill="#3B82F6" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
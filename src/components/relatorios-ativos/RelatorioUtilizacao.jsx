import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';

export default function RelatorioUtilizacao({ ativos, movimentacoes }) {
  const totalAtivos = ativos.length;
  const emUso = ativos.filter(a => a.status === 'em_uso').length;
  const disponivel = ativos.filter(a => a.status === 'disponivel').length;
  const manutencao = ativos.filter(a => a.status === 'manutencao').length;

  const taxaUtilizacao = totalAtivos > 0 ? ((emUso / totalAtivos) * 100).toFixed(1) : 0;
  const taxaDisponibilidade = totalAtivos > 0 ? ((disponivel / totalAtivos) * 100).toFixed(1) : 0;

  // Análise de movimentação por ativo
  const utilizacaoPorAtivo = useMemo(() => {
    const movimentacaoPorAtivo = {};
    
    movimentacoes.forEach(mov => {
      const ativoId = mov.ativo_id;
      movimentacaoPorAtivo[ativoId] = (movimentacaoPorAtivo[ativoId] || 0) + 1;
    });

    return ativos.map(ativo => ({
      nome: ativo.nome || 'Sem nome',
      movimentacoes: movimentacaoPorAtivo[ativo.id] || 0,
      status: ativo.status,
      emUso: ativo.status === 'em_uso' ? 'Sim' : 'Não'
    }))
    .sort((a, b) => b.movimentacoes - a.movimentacoes)
    .slice(0, 15);
  }, [ativos, movimentacoes]);

  // Ativos ociosos (nunca movimentados)
  const ativosOciosos = useMemo(() => {
    const movimentacaoPorAtivo = {};
    
    movimentacoes.forEach(mov => {
      const ativoId = mov.ativo_id;
      movimentacaoPorAtivo[ativoId] = (movimentacaoPorAtivo[ativoId] || 0) + 1;
    });

    return ativos
      .filter(a => !movimentacaoPorAtivo[a.id] && a.status !== 'inativo')
      .map(a => ({ nome: a.nome || 'Sem nome', status: a.status }))
      .slice(0, 10);
  }, [ativos, movimentacoes]);

  // Gráfico temporal de utilização
  const utilizacaoTemporal = useMemo(() => {
    const dados = {};
    
    movimentacoes.forEach(mov => {
      const data = new Date(mov.created_date);
      const mes = `${data.getMonth() + 1}/${data.getFullYear()}`;
      
      if (!dados[mes]) {
        dados[mes] = { mes, saidas: 0, entradas: 0, transferencias: 0 };
      }
      
      if (mov.tipo === 'saida') dados[mes].saidas++;
      else if (mov.tipo === 'entrada') dados[mes].entradas++;
      else if (mov.tipo === 'transferencia') dados[mes].transferencias++;
    });

    return Object.values(dados)
      .sort((a, b) => {
        const [mesA, anoA] = a.mes.split('/').map(Number);
        const [mesB, anoB] = b.mes.split('/').map(Number);
        return anoA - anoB || mesA - mesB;
      })
      .slice(-6);
  }, [movimentacoes]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div>
              <div className="text-sm text-gray-500">Total de Ativos</div>
              <div className="text-lg sm:text-2xl font-bold text-gray-900">{totalAtivos}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div>
              <div className="text-sm text-gray-500">Taxa de Utilização</div>
              <div className="text-lg sm:text-2xl font-bold text-blue-600">{taxaUtilizacao}%</div>
              <div className="text-xs text-gray-500 mt-1">{emUso} em uso</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div>
              <div className="text-sm text-gray-500">Disponibilidade</div>
              <div className="text-lg sm:text-2xl font-bold text-emerald-600">{taxaDisponibilidade}%</div>
              <div className="text-xs text-gray-500 mt-1">{disponivel} disponíveis</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div>
              <div className="text-sm text-gray-500">Em Manutenção</div>
              <div className="text-lg sm:text-2xl font-bold text-amber-600">{manutencao}</div>
              <div className="text-xs text-gray-500 mt-1">{totalAtivos > 0 ? ((manutencao/totalAtivos)*100).toFixed(1) : 0}% do total</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico Temporal */}
      {utilizacaoTemporal.length > 0 && (
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Movimentações nos Últimos 6 Meses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={utilizacaoTemporal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="saidas" stroke="#EF4444" strokeWidth={2} name="Saídas" />
                  <Line type="monotone" dataKey="entradas" stroke="#10B981" strokeWidth={2} name="Entradas" />
                  <Line type="monotone" dataKey="transferencias" stroke="#3B82F6" strokeWidth={2} name="Transferências" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mais Utilizados */}
        {utilizacaoPorAtivo.length > 0 && (
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                Top 15 Ativos Mais Utilizados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {utilizacaoPorAtivo.map((ativo, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                    <div className="flex-1">
                      <div className="text-gray-900 truncate">{ativo.nome.substring(0, 20)}</div>
                      <div className="text-xs text-gray-500">{ativo.status}</div>
                    </div>
                    <Badge className="bg-blue-100 text-blue-700 border-0">{ativo.movimentacoes}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ativos Ociosos */}
        {ativosOciosos.length > 0 && (
          <Card className="bg-white border-amber-200">
            <CardHeader>
              <CardTitle className="text-amber-600">Ativos Ociosos (Não Movimentados)</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Ativos que nunca foram movimentados</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {ativosOciosos.map((ativo, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-amber-50 rounded-lg text-sm border border-amber-200">
                    <div className="flex-1">
                      <div className="text-gray-900 truncate">{ativo.nome.substring(0, 20)}</div>
                      <div className="text-xs text-amber-600">{ativo.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
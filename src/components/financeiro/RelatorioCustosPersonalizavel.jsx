import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { exportarXLSXBranded } from '@/lib/xlsxBrand';
import { useEmpresaBranding } from '@/components/shared/useBranding';

const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#EC4899'];

const LABEL_AGRUPAMENTO = { obra: 'Obra', categoria: 'Categoria', centro_custo: 'Centro de Custo' };

export default function RelatorioCustosPersonalizavel({ contas, obras }) {
  const [agrupamento, setAgrupamento] = useState('obra');
  const { empresa, branding } = useEmpresaBranding(undefined);

  const dadosAgrupados = useMemo(() => {
    let grupos = {};
    // "Total de Custos": considera só contas a PAGAR (exclui receitas e canceladas).
    const custos = (contas || []).filter((c) => c.tipo === 'pagar' && c.status !== 'cancelado');

    if (agrupamento === 'obra') {
      custos.forEach(conta => {
        const obraId = conta.obra_id;
        const obra = obras.find(o => o.id === obraId);
        const nomeObra = obra?.nome || 'Sem obra';

        if (!grupos[nomeObra]) {
          grupos[nomeObra] = 0;
        }
        grupos[nomeObra] += conta.valor;
      });
    } else if (agrupamento === 'categoria') {
      custos.forEach(conta => {
        const categoria = conta.categoria || 'Outro';

        if (!grupos[categoria]) {
          grupos[categoria] = 0;
        }
        grupos[categoria] += conta.valor;
      });
    } else if (agrupamento === 'centro_custo') {
      custos.forEach(conta => {
        const cc = conta.centro_custo || 'Sem centro de custo';

        if (!grupos[cc]) {
          grupos[cc] = 0;
        }
        grupos[cc] += conta.valor;
      });
    }

    return Object.entries(grupos)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [contas, agrupamento, obras]);

  const total = useMemo(() => {
    return dadosAgrupados.reduce((acc, item) => acc + item.valor, 0);
  }, [dadosAgrupados]);

  // Exporta EXCEL branded com exatamente o que está agrupado na tela.
  const exportarExcel = () => {
    if (!dadosAgrupados.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      exportarXLSXBranded(`relatorio-custos-${new Date().toISOString().split('T')[0]}`, [{
        nome: 'Custos',
        titulo: 'Relatório de Custos',
        subtitulo: `Agrupado por ${LABEL_AGRUPAMENTO[agrupamento] || agrupamento}`,
        headers: ['Agrupamento', 'Valor', 'Percentual'],
        rows: dadosAgrupados.map((item) => [
          item.nome,
          Number(item.valor) || 0,
          `${(total ? (item.valor / total) * 100 : 0).toFixed(1)}%`,
        ]),
        moeda: [1],
      }], { empresa, branding });
      toast.success('Excel exportado');
    } catch (e) {
      toast.error('Erro ao exportar: ' + (e?.message || 'tente novamente'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Controles */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-64">
          <label className="text-sm text-gray-500 block mb-2">Agrupar por</label>
          <Select value={agrupamento} onValueChange={setAgrupamento}>
            <SelectTrigger className="bg-white border-gray-300 text-gray-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-300">
              <SelectItem value="obra">Obra</SelectItem>
              <SelectItem value="categoria">Categoria</SelectItem>
              <SelectItem value="centro_custo">Centro de Custo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <button
          onClick={exportarExcel}
          className="mt-6 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Download className="w-4 h-4" />
          Exportar Excel
        </button>
      </div>

      {/* Total */}
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-2">Total de Custos</div>
            <div className="text-3xl font-bold text-gray-900">
              {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Barras */}
      {dadosAgrupados.length > 0 && (
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900 capitalize">Distribuição por {agrupamento}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosAgrupados} layout="vertical" margin={{ left: 150 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" stroke="#9CA3AF" tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                  <YAxis dataKey="nome" type="category" stroke="#9CA3AF" fontSize={11} width={140} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '12px' }}
                    formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  />
                  <Bar dataKey="valor" fill="#F59E0B" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráfico Pizza */}
      {dadosAgrupados.length > 0 && (
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Proporção de Custos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosAgrupados}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      dataKey="valor"
                    >
                      {dadosAgrupados.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 overflow-y-auto max-h-64">
                {dadosAgrupados.map((item, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        <span className="text-gray-500 text-sm truncate">{item.nome}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-gray-900 text-sm font-bold">
                          {item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {((item.valor / total) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
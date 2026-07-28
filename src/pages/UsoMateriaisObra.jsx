import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import PageHeader from '../components/ui/PageHeader';

export default function UsoMateriaisObra() {
  const [obraFiltro, setObraFiltro] = useState('todas');

  const { data: usoMateriais = [] } = useQuery({
    queryKey: ['uso-material-obra'],
    queryFn: () => base44.entities.UsoMaterialObra.list('-data_uso', 200)
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const usosFiltrados = obraFiltro === 'todas'
    ? usoMateriais
    : usoMateriais.filter(u => u.obra_id === obraFiltro);

  // Agrupar por material
  const usoPorMaterial = {};
  usosFiltrados.forEach(uso => {
    if (!usoPorMaterial[uso.material_id]) {
      usoPorMaterial[uso.material_id] = {
        nome: uso.material_nome,
        usado: 0,
        orcado: 0,
        custo: 0
      };
    }
    usoPorMaterial[uso.material_id].usado += uso.quantidade_usada || 0;
    usoPorMaterial[uso.material_id].orcado += uso.quantidade_orcada || 0;
    usoPorMaterial[uso.material_id].custo += uso.custo_total || 0;
  });

  const dadosGrafico = Object.values(usoPorMaterial)
    .sort((a, b) => b.custo - a.custo)
    .slice(0, 10)
    .map(m => ({
      material: m.nome,
      usado: m.usado,
      orcado: m.orcado
    }));

  const totalCusto = Object.values(usoPorMaterial).reduce((sum, m) => sum + m.custo, 0);
  const materiaisComVariacao = Object.values(usoPorMaterial).filter(m => {
    const variacao = ((m.usado - m.orcado) / m.orcado) * 100;
    return Math.abs(variacao) > 10;
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Uso de Materiais por Obra"
        subtitle="Controle e comparação com orçamento"
        actionIcon={Package}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-slate-800/40 to-slate-900/20 border border-slate-700/50">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-white mb-1">{Object.keys(usoPorMaterial).length}</div>
            <div className="text-sm text-slate-400">Materiais Utilizados</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-800/30 to-emerald-900/20 border border-emerald-700/30">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-emerald-400 mb-1">
              R$ {totalCusto.toLocaleString('pt-BR')}
            </div>
            <div className="text-sm text-slate-400">Custo Total</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-800/30 to-amber-900/20 border border-amber-700/30">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-amber-400 mb-1">{materiaisComVariacao}</div>
            <div className="text-sm text-slate-400">Materiais com Variação &gt;10%</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-br from-slate-800/40 to-slate-900/20 border border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white">Top 10 Materiais - Usado vs Orçado</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dadosGrafico}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="material" stroke="#9CA3AF" angle={-45} textAnchor="end" height={100} />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#F3F4F6' }}
              />
              <Bar dataKey="usado" fill="#3B82F6" name="Usado" />
              <Bar dataKey="orcado" fill="#10B981" name="Orçado" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-slate-800/40 to-slate-900/20 border border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={obraFiltro} onValueChange={setObraFiltro}>
            <SelectTrigger className="bg-slate-800/60 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="todas">Todas as Obras</SelectItem>
              {obras.map(o => (
                <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {Object.entries(usoPorMaterial).map(([materialId, dados]) => {
          const variacao = dados.orcado > 0 ? ((dados.usado - dados.orcado) / dados.orcado) * 100 : 0;
          const variacaoPositiva = variacao > 0;

          return (
            <Card key={materialId} className="bg-gradient-to-br from-slate-800/40 to-slate-900/20 border border-slate-700/50">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-3">{dados.nome}</h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-slate-500 text-sm">Quantidade Usada</p>
                        <p className="text-blue-400 font-bold">{dados.usado.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-sm">Quantidade Orçada</p>
                        <p className="text-emerald-400 font-bold">{dados.orcado.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-sm">Variação</p>
                        <p className={`font-bold ${Math.abs(variacao) > 10 ? 'text-red-400' : 'text-slate-400'}`}>
                          {variacaoPositiva ? <TrendingUp className="inline w-4 h-4" /> : <TrendingDown className="inline w-4 h-4" />}
                          {variacao.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-sm">Custo Total</p>
                        <p className="text-white font-bold">R$ {dados.custo.toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
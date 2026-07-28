import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Package,
  TrendingUp,
  AlertTriangle,
  Shield,
  FileText,
  Users,
  BarChart3,
  Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, LineChart, Line } from 'recharts';
import { cn } from '@/lib/utils';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/dashboard/StatCard';
import AlertasFraude from '../components/suprimentos/AlertasFraude';
import AnaliseFornecedores from '../components/suprimentos/AnaliseFornecedores';

export default function SuprimentosAvancado() {
  const [searchTerm, setSearchTerm] = useState('');
  const [obraFilter, setObraFilter] = useState('todas');

  const { data: materiais = [] } = useQuery({
    queryKey: ['materiais'],
    queryFn: () => base44.entities.Material.list()
  });

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['movimentacoes'],
    queryFn: () => base44.entities.MovimentacaoEstoque.list('-data', 500)
  });

  const { data: desvios = [] } = useQuery({
    queryKey: ['desvios-consumo'],
    queryFn: () => base44.entities.DesvioConsumo.list('-created_date', 200)
  });

  const { data: ordens = [] } = useQuery({
    queryKey: ['ordens-compra'],
    queryFn: () => base44.entities.OrdemCompra.list('-created_date', 200)
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.list()
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  // Estatísticas
  const desviosPendentes = desvios.filter(d => d.status === 'pendente_justificativa').length;
  const desviosAltos = desvios.filter(d => Math.abs(d.percentual_desvio) > 20).length;
  
  // Análise de consumo por material
  const consumoPorMaterial = materiais.map(material => {
    const movsMaterial = movimentacoes.filter(m => m.material_id === material.id && m.tipo === 'saida');
    const consumoTotal = movsMaterial.reduce((acc, m) => acc + (m.quantidade || 0), 0);
    
    const desviosMaterial = desvios.filter(d => d.material_id === material.id);
    const desvioMedio = desviosMaterial.length > 0
      ? desviosMaterial.reduce((acc, d) => acc + (d.percentual_desvio || 0), 0) / desviosMaterial.length
      : 0;

    return {
      material: material.nome,
      consumo: consumoTotal,
      desvioMedio: desvioMedio.toFixed(1),
      numeroDesvios: desviosMaterial.length
    };
  }).sort((a, b) => Math.abs(b.desvioMedio) - Math.abs(a.desvioMedio)).slice(0, 10);

  // Análise de compras anômalas (preços muito acima da média)
  const comprasAnomalas = [];
  fornecedores.forEach(fornecedor => {
    const ordensF = ordens.filter(o => o.fornecedor_id === fornecedor.id);
    ordensF.forEach(ordem => {
      if (!ordem.valor_total || !ordem.quantidade) return;
      const precoUnitario = ordem.valor_total / ordem.quantidade;
      
      // Comparar com outras compras do mesmo material
      const outrasCompras = ordens.filter(o => 
        o.descricao?.toLowerCase() === ordem.descricao?.toLowerCase() && 
        o.id !== ordem.id &&
        o.valor_total && o.quantidade
      );
      
      if (outrasCompras.length > 0) {
        const precosMedios = outrasCompras.map(o => o.valor_total / o.quantidade);
        const precoMedio = precosMedios.reduce((a, b) => a + b, 0) / precosMedios.length;
        const desvioPreco = ((precoUnitario - precoMedio) / precoMedio) * 100;
        
        if (desvioPreco > 30) {
          comprasAnomalas.push({
            ordem,
            fornecedor: fornecedor.nome,
            precoUnitario,
            precoMedio,
            desvioPreco: desvioPreco.toFixed(1)
          });
        }
      }
    });
  });

  // Evolução de desvios por mês
  const desviosPorMes = {};
  desvios.forEach(d => {
    if (!d.created_date) return;
    const mes = new Date(d.created_date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    if (!desviosPorMes[mes]) {
      desviosPorMes[mes] = { excesso: 0, economia: 0 };
    }
    if (d.tipo_desvio === 'excesso') {
      desviosPorMes[mes].excesso += 1;
    } else {
      desviosPorMes[mes].economia += 1;
    }
  });

  const dadosEvolucao = Object.entries(desviosPorMes).map(([mes, data]) => ({
    mes,
    excesso: data.excesso,
    economia: data.economia
  }));

  // Filtrar desvios
  const desviosFiltrados = desvios.filter(d => {
    const material = materiais.find(m => m.id === d.material_id);
    const matchSearch = material?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchObra = obraFilter === 'todas' || d.obra_id === obraFilter;
    return matchSearch && matchObra;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suprimentos Avançado"
        subtitle="Análise de consumo, desvios e detecção de fraudes"
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Desvios Identificados"
          value={desvios.length}
          subtitle={`${desviosAltos} críticos`}
          icon={TrendingUp}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
        />
        <StatCard
          title="Pendentes Justificativa"
          value={desviosPendentes}
          icon={FileText}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-500"
        />
        <StatCard
          title="Compras Anômalas"
          value={comprasAnomalas.length}
          subtitle="Preço acima da média"
          icon={AlertTriangle}
          iconBg="bg-red-500/10"
          iconColor="text-red-500"
        />
        <StatCard
          title="Fornecedores Ativos"
          value={fornecedores.filter(f => f.status === 'ativo').length}
          icon={Users}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
        />
      </div>

      {/* Alertas de Fraude */}
      <AlertasFraude 
        comprasAnomalas={comprasAnomalas}
        desvios={desvios}
        materiais={materiais}
      />

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Materiais com Maior Desvio */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-500" />
              Materiais com Maior Desvio Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={consumoPorMaterial} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9CA3AF" fontSize={12} />
                  <YAxis dataKey="material" type="category" stroke="#9CA3AF" fontSize={11} width={100} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '12px',
                      color: '#fff'
                    }}
                    formatter={(value) => `${value}%`}
                  />
                  <Bar dataKey="desvioMedio" fill="#F59E0B" radius={[0, 8, 8, 0]} name="Desvio Médio (%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Evolução de Desvios */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Evolução de Desvios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dadosEvolucao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="mes" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '12px',
                      color: '#fff'
                    }}
                  />
                  <Line type="monotone" dataKey="excesso" stroke="#EF4444" strokeWidth={2} name="Excessos" />
                  <Line type="monotone" dataKey="economia" stroke="#10B981" strokeWidth={2} name="Economias" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Análise de Fornecedores */}
      <AnaliseFornecedores 
        fornecedores={fornecedores}
        ordens={ordens}
        comprasAnomalas={comprasAnomalas}
      />

      {/* Lista de Desvios */}
      <Card>
        <CardHeader>
          <CardTitle>Desvios de Consumo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Buscar material..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={obraFilter} onValueChange={setObraFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas Obras</SelectItem>
                {obras.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {desviosFiltrados.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum desvio identificado</p>
          ) : (
            <div className="space-y-3">
              {desviosFiltrados.map(desvio => {
                const material = materiais.find(m => m.id === desvio.material_id);
                const obra = obras.find(o => o.id === desvio.obra_id);

                const statusConfig = {
                  pendente_justificativa: { color: 'bg-red-50 text-red-700 border-red-200', label: 'Pendente' },
                  justificado: { color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Justificado' },
                  em_analise: { color: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Em Análise' },
                  aprovado: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Aprovado' },
                  rejeitado: { color: 'bg-red-50 text-red-700 border-red-200', label: 'Rejeitado' }
                };

                const config = statusConfig[desvio.status];
                const isExcesso = desvio.tipo_desvio === 'excesso';

                return (
                  <div key={desvio.id} className={cn(
                    "p-4 rounded-xl border",
                    isExcesso ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"
                  )}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-gray-900 font-medium">{material?.nome || 'Material desconhecido'}</p>
                          <Badge className={cn("border text-xs", config.color)}>
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-gray-600 text-sm">{obra?.nome || 'Obra não identificada'}</p>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-xl font-bold",
                          isExcesso ? "text-red-600" : "text-emerald-600"
                        )}>
                          {isExcesso ? '+' : ''}{desvio.percentual_desvio?.toFixed(1)}%
                        </p>
                        <p className="text-gray-600 text-xs">{desvio.tipo_desvio === 'excesso' ? 'Excesso' : 'Economia'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-2 text-sm">
                      <div>
                        <span className="text-gray-600">Planejado:</span>
                        <span className="text-gray-900 ml-2">{desvio.quantidade_planejada}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Real:</span>
                        <span className="text-gray-900 ml-2">{desvio.quantidade_real}</span>
                      </div>
                    </div>
                    {desvio.justificativa && (
                      <div className="mt-3 p-3 bg-gray-100 rounded-lg">
                        <p className="text-gray-600 text-xs mb-1">Justificativa:</p>
                        <p className="text-gray-700 text-sm">{desvio.justificativa}</p>
                        {desvio.justificado_por && (
                          <p className="text-gray-500 text-xs mt-1">Por: {desvio.justificado_por}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
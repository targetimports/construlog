import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, AlertTriangle, Package, DollarSign } from 'lucide-react';

export default function DashboardObraIntegrado({ obra_id }) {
  // Buscar dados da obra
  const { data: obras } = useQuery({
    queryKey: ['obra', obra_id],
    queryFn: () => base44.entities.Obra.filter({ id: obra_id }),
    enabled: !!obra_id
  });

  // Buscar necessidades previstas (OrçaFascio)
  const { data: necessidades } = useQuery({
    queryKey: ['necessidades-obra', obra_id],
    queryFn: () => base44.entities.NecessidadeMaterialObra.filter({ obra_id }),
    enabled: !!obra_id
  });

  // Buscar estoque real da obra
  const { data: estoques } = useQuery({
    queryKey: ['estoque-obra', obra_id],
    queryFn: () => base44.entities.EstoqueObra.filter({ obra_id }),
    enabled: !!obra_id
  });

  // Buscar contas financeiras
  const { data: contas } = useQuery({
    queryKey: ['contas-obra', obra_id],
    queryFn: () => base44.entities.ContaFinanceira.filter({ obra_id }),
    enabled: !!obra_id
  });

  const obra = obras?.[0];

  // FONTE ÚNICA: total_orcamento da obra (mesmo campo da importação)
  const valorOrcado = obra?.total_orcamento || 0;
  
  // Calcular custos realizados
  const custoRealizado = contas
    ?.filter(c => c.tipo === 'pagar' && c.status === 'pago')
    .reduce((sum, c) => sum + (c.valor || 0), 0) || 0;

  // Calcular receita (contrato/medições)
  const receitaTotal = contas
    ?.filter(c => c.tipo === 'receber')
    .reduce((sum, c) => sum + (c.valor || 0), 0) || 0;

  // REGRA MARGEM: só calcular se tiver receita
  const temReceita = receitaTotal > 0;
  const margem = temReceita ? receitaTotal - custoRealizado : 0;
  const margemPct = temReceita && receitaTotal > 0
    ? ((margem / receitaTotal) * 100).toFixed(1)
    : null;

  // Necessidade Prevista (OrçaFascio)
  const valorNecessidadePrevista = necessidades?.reduce((sum, n) => sum + (n.valor_total_previsto || 0), 0) || 0;
  const qtdItensNecessidade = necessidades?.length || 0;

  // Estoque Real (tratar como 0 se não houver)
  const valorEstoqueReal = estoques?.reduce((sum, e) => {
    const qtd = e.quantidade_atual || 0;
    const valor = e.valor_unitario || (e.preco_unitario || 0);
    return sum + (qtd * valor);
  }, 0) || 0;
  const qtdItensEstoque = estoques?.filter(e => (e.quantidade_atual || 0) > 0).length || 0;
  
  // Alertas de estoque
  const alertasEstoque = estoques?.filter(e => e.status_alerta !== 'ok') || [];
  const itensAlerta = alertasEstoque.filter(e => e.status_alerta === 'alerta').length;
  const itensCriticos = alertasEstoque.filter(e => e.status_alerta === 'critico').length;

  // Dados financeiros para gráfico
  const dadosFinanceiros = [
    { nome: 'Orçado', valor: valorOrcado, fill: '#3b82f6' },
    { nome: 'Realizado', valor: custoRealizado, fill: '#ef4444' }
  ];

  if (temReceita) {
    dadosFinanceiros.push({ nome: 'Receita', valor: receitaTotal, fill: '#10b981' });
  }

  // Dados distribuição estoque
  const dadosEstoque = [
    { name: 'OK', value: (estoques?.length || 0) - alertasEstoque.length, fill: '#10b981' },
    { name: 'Alerta', value: itensAlerta, fill: '#f59e0b' },
    { name: 'Crítico', value: itensCriticos, fill: '#ef4444' }
  ];

  const progressoGeral = obra?.percentual_concluido || 0;

  return (
    <div className="space-y-6">
      {/* ALERTAS CRÍTICOS */}
      {(itensCriticos > 0 || (temReceita && margemPct < 10)) && (
        <Card className={`border-2 ${itensCriticos > 0 ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
          <CardContent className="pt-6 flex gap-3">
            <AlertTriangle className={`w-6 h-6 flex-shrink-0 ${itensCriticos > 0 ? 'text-red-600' : 'text-amber-600'}`} />
            <div>
              {itensCriticos > 0 && <p className="text-sm text-red-800"><strong>{itensCriticos} item(ns) em estoque crítico</strong></p>}
              {temReceita && margemPct < 10 && <p className="text-sm text-amber-800"><strong>Margem baixa: {margemPct}%</strong></p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs PRINCIPAIS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Progresso Geral */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">Progresso Geral</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">{progressoGeral}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600 opacity-30" />
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${progressoGeral}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Margem */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">Margem</p>
                {temReceita ? (
                  <>
                    <p className={`text-3xl font-bold mt-1 ${margemPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {margemPct}%
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      R$ {Math.abs(margem).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg text-gray-400 mt-1">—</p>
                    <p className="text-xs text-gray-500 mt-1">Cadastre contrato/receita</p>
                  </>
                )}
              </div>
              <DollarSign className={`w-8 h-8 opacity-30 ${temReceita && margemPct >= 0 ? 'text-green-600' : 'text-gray-400'}`} />
            </div>
          </CardContent>
        </Card>

        {/* Necessidade Prevista (OrçaFascio) */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">Necessidade Prevista</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">
                  R$ {(valorNecessidadePrevista / 1000).toFixed(1)}k
                </p>
              </div>
              <Package className="w-8 h-8 text-blue-600 opacity-30" />
            </div>
            <p className="text-xs text-gray-600 mt-2">{qtdItensNecessidade} itens planejados</p>
          </CardContent>
        </Card>

        {/* Estoque Real */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">Estoque Disponível</p>
                <p className="text-3xl font-bold text-purple-600 mt-1">
                  R$ {(valorEstoqueReal / 1000).toFixed(1)}k
                </p>
              </div>
              <Package className="w-8 h-8 text-purple-600 opacity-30" />
            </div>
            <p className="text-xs text-gray-600 mt-2">{qtdItensEstoque} itens reais</p>
          </CardContent>
        </Card>

        {/* Itens em Alerta */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">Alertas Estoque</p>
                <div className="flex gap-2 mt-2">
                  <div>
                    <p className="text-sm font-bold text-amber-600">{itensAlerta}</p>
                    <p className="text-xs text-gray-600">Alerta</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-600">{itensCriticos}</p>
                    <p className="text-xs text-gray-600">Crítico</p>
                  </div>
                </div>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-600 opacity-30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico Financeiro */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Status Financeiro</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosFinanceiros}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" />
                <YAxis />
                <Tooltip
                  formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />
                <Bar dataKey="valor" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Orçado:</span>
                <span className="font-bold">R$ {valorOrcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Realizado:</span>
                <span className="font-bold">R$ {custoRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              {temReceita && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Receita:</span>
                    <span className="font-bold text-green-600">R$ {receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="text-gray-600">Margem:</span>
                    <span className={`font-bold ${margem >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      R$ {margem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({margemPct}%)
                    </span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Gráfico Estoque */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Distribuição Estoque</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dadosEstoque}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dadosEstoque.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Card Comparativo: Necessidade x Estoque */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Necessidade Prevista vs Estoque Real</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Necessidade Prevista</p>
              <p className="text-2xl font-bold text-blue-600">
                R$ {(valorNecessidadePrevista / 1000).toFixed(1)}k
              </p>
              <p className="text-xs text-gray-500 mt-1">{qtdItensNecessidade} itens</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Estoque Disponível</p>
              <p className="text-2xl font-bold text-purple-600">
                R$ {(valorEstoqueReal / 1000).toFixed(1)}k
              </p>
              <p className="text-xs text-gray-500 mt-1">{qtdItensEstoque} itens</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Pendência de Compra</p>
              <p className="text-2xl font-bold text-amber-600">
                R$ {((valorNecessidadePrevista - valorEstoqueReal) / 1000).toFixed(1)}k
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {Math.max(0, qtdItensNecessidade - qtdItensEstoque)} itens
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
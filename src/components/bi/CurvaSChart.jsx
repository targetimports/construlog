import React, { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';

const fmtBRL0 = (v) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

export default function CurvaSChart({ data = [], onDrillDown }) {
  const { paginatedItems: dataPag, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(data, 12);
  const formatarValor = (val) => {
    return `R$ ${(val / 1000).toFixed(1)}k`;
  };

  const handleClick = (dataPoint, campo) => {
    if (onDrillDown) {
      onDrillDown(dataPoint, campo);
    }
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Curva S - Planejado vs Real</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Sem dados disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Curva S - Planejado vs Real (Mensal)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Gráfico de Receita */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Receita: Planejado vs Realizado</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
              <YAxis tickFormatter={formatarValor} />
              <Tooltip formatter={(value) => formatarValor(value)} />
              <Legend />
              <Bar
                dataKey="planejado_receita"
                fill="#3b82f6"
                name="Planejado"
                onClick={(data) => handleClick(data, 'planejado_receita')}
              />
              <Line
                type="monotone"
                dataKey="real_receita"
                stroke="#10b981"
                name="Realizado"
                strokeWidth={2}
                onClick={(data) => handleClick(data, 'real_receita')}
                cursor="pointer"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico de Custo */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Custo Total: Planejado vs Realizado</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
              <YAxis tickFormatter={formatarValor} />
              <Tooltip formatter={(value) => formatarValor(value)} />
              <Legend />
              <Bar
                dataKey="planejado_custo"
                fill="#f59e0b"
                name="Planejado"
                onClick={(data) => handleClick(data, 'planejado_custo')}
              />
              <Line
                type="monotone"
                dataKey="real_custo_total"
                stroke="#ef4444"
                name="Realizado"
                strokeWidth={2}
                onClick={(data) => handleClick(data, 'real_custo_total')}
                cursor="pointer"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico de Saldo Acumulado */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Saldo Acumulado (Resultado)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
              <YAxis tickFormatter={formatarValor} />
              <Tooltip formatter={(value) => formatarValor(value)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="saldo_acumulado"
                stroke="#8b5cf6"
                name="Saldo Acumulado"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tabela de Breakdown de Custos */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Custos por Categoria (Mensais)</h3>

          {/* Cards mobile */}
          <div className="md:hidden flex flex-col gap-2">
            {dataPag.map((row, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-gray-200 space-y-1">
                <p className="font-medium text-gray-900">{row.periodo}</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                  <div><span className="text-gray-400">Materiais: </span>{fmtBRL0(row.real_materiais)}</div>
                  <div><span className="text-gray-400">Serviços: </span>{fmtBRL0(row.real_servicos)}</div>
                  <div><span className="text-gray-400">Mão de obra: </span>{fmtBRL0(row.real_mao_obra)}</div>
                  <div><span className="text-gray-400">Impostos: </span>{fmtBRL0(row.real_impostos)}</div>
                  <div><span className="text-gray-400">Adm.: </span>{fmtBRL0(row.real_adm)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Período</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Materiais</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Serviços</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Mão de Obra</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Impostos</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Administrativos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dataPag.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{row.periodo}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmtBRL0(row.real_materiais)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmtBRL0(row.real_servicos)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmtBRL0(row.real_mao_obra)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmtBRL0(row.real_impostos)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmtBRL0(row.real_adm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
        </div>
      </CardContent>
    </Card>
  );
}
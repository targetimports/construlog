import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { AlertCircle } from 'lucide-react';

const fmtBRL2 = (v) => 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',');

export default function FluxoCaixaChart({ data = [], alertas = [], onDrillDown }) {
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
          <CardTitle>Fluxo de Caixa</CardTitle>
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
        <CardTitle>Fluxo de Caixa (Mensal)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Alertas */}
        {alertas.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex gap-2 items-start">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 text-sm">Avisos de Caixa</p>
                {alertas.map((alerta, idx) => (
                  <p key={idx} className="text-sm text-red-700">
                    {alerta.periodo}: Saldo acumulado negativo de R$ {Math.abs(alerta.valor).toFixed(2)}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Gráfico de Entradas/Saídas */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Entradas vs Saídas</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
              <YAxis tickFormatter={formatarValor} />
              <Tooltip formatter={(value) => formatarValor(value)} />
              <Legend />
              <Bar
                dataKey="entradas"
                fill="#10b981"
                name="Entradas"
                onClick={(data) => handleClick(data, 'entradas')}
              />
              <Bar
                dataKey="saidas"
                fill="#ef4444"
                name="Saídas"
                onClick={(data) => handleClick(data, 'saidas')}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico de Saldo Acumulado */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Saldo Acumulado</h3>
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
                stroke="#3b82f6"
                name="Saldo Acumulado"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tabela Mensal */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Detalhes Mensais</h3>

          {/* Cards mobile */}
          <div className="md:hidden flex flex-col gap-2">
            {dataPag.map((row, idx) => (
              <div key={idx} className={`p-3 rounded-lg border space-y-1 ${row.saldo_acumulado < 0 ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">{row.periodo}</p>
                  <span className={`text-sm font-bold ${row.saldo_acumulado >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtBRL2(row.saldo_acumulado)}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div className="text-green-600" onClick={() => handleClick(row, 'entradas')}><span className="text-gray-400">Entradas: </span>{fmtBRL2(row.entradas)}</div>
                  <div className="text-red-600" onClick={() => handleClick(row, 'saidas')}><span className="text-gray-400">Saídas: </span>{fmtBRL2(row.saidas)}</div>
                  <div className={row.saldo_mes >= 0 ? 'text-green-600' : 'text-red-600'}><span className="text-gray-400">Saldo mês: </span>{fmtBRL2(row.saldo_mes)}</div>
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
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Entradas</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Saídas</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Saldo Mês</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Saldo Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dataPag.map((row, idx) => (
                  <tr key={idx} className={row.saldo_acumulado < 0 ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-3 py-2 font-medium text-gray-900">{row.periodo}</td>
                    <td className="px-3 py-2 text-right text-green-600 cursor-pointer hover:underline" onClick={() => handleClick(row, 'entradas')}>
                      {fmtBRL2(row.entradas)}
                    </td>
                    <td className="px-3 py-2 text-right text-red-600 cursor-pointer hover:underline" onClick={() => handleClick(row, 'saidas')}>
                      {fmtBRL2(row.saidas)}
                    </td>
                    <td className={`px-3 py-2 text-right font-medium ${row.saldo_mes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmtBRL2(row.saldo_mes)}
                    </td>
                    <td className={`px-3 py-2 text-right font-bold ${row.saldo_acumulado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmtBRL2(row.saldo_acumulado)}
                    </td>
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
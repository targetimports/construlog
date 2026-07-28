import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function TabelaDesempenhoProfissional({
  registros,
  obraMap = {},
  isLoading
}) {
  // Ordenar cronologicamente (mais recente primeiro)
  const registrosOrdenados = useMemo(
    () => [...registros].sort((a, b) => new Date(b.data) - new Date(a.data)),
    [registros]
  );

  if (isLoading) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Histórico Detalhado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-700 rounded animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white">
          Histórico Detalhado ({registros.length} registros)
        </CardTitle>
      </CardHeader>

      <CardContent>
        {registrosOrdenados.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            Nenhum registro encontrado no período
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-3 text-left text-gray-400 font-semibold">Data</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-semibold">Obra</th>
                  <th className="px-4 py-3 text-center text-gray-400 font-semibold">Status</th>
                  <th className="px-4 py-3 text-center text-gray-400 font-semibold">HE</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-semibold">Observação</th>
                </tr>
              </thead>
              <tbody>
                {registrosOrdenados.map((reg, idx) => {
                  const obra = obraMap[reg.obra_id];
                  let statusBadge, statusIcon;

                  if (reg.falta) {
                    statusBadge = 'bg-red-900/30 text-red-400';
                    statusIcon = <XCircle className="w-4 h-4" />;
                  } else if (reg.presente) {
                    statusBadge = 'bg-green-900/30 text-green-400';
                    statusIcon = <CheckCircle className="w-4 h-4" />;
                  } else {
                    statusBadge = 'bg-gray-900/30 text-gray-400';
                    statusIcon = <AlertCircle className="w-4 h-4" />;
                  }

                  return (
                    <tr
                      key={reg.id}
                      className="border-b border-gray-700 hover:bg-gray-700/20 transition-colors"
                    >
                      {/* Data */}
                      <td className="px-4 py-3 text-white">
                        <div className="font-medium">
                          {format(parseISO(reg.data), 'dd MMM yyyy', { locale: ptBR })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(parseISO(reg.data), 'EEEE', { locale: ptBR })}
                        </div>
                      </td>

                      {/* Obra */}
                      <td className="px-4 py-3">
                        <span className="text-gray-300">
                          {obra?.nome || 'N/A'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <Badge className={`${statusBadge} border-0 gap-1.5`}>
                          {statusIcon}
                          <span>
                            {reg.falta ? 'Falta' : reg.presente ? 'Presente' : 'Indefinido'}
                          </span>
                        </Badge>
                      </td>

                      {/* HE */}
                      <td className="px-4 py-3 text-center">
                        {reg.horas_extra && reg.horas_extra > 0 ? (
                          <span className="font-semibold text-purple-400">
                            {reg.horas_extra.toFixed(1)}h
                          </span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>

                      {/* Observação */}
                      <td className="px-4 py-3">
                        {reg.observacao ? (
                          <span className="text-gray-300 text-xs">{reg.observacao}</span>
                        ) : (
                          <span className="text-gray-600 italic">sem observação</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
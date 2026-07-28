import React from 'react';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Loader2 } from 'lucide-react';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TIPO_ICON = {
  entrada: ArrowDownCircle,
  saida: ArrowUpCircle,
  transferencia: ArrowLeftRight,
};

const TIPO_COLOR = {
  entrada: 'text-green-600',
  saida: 'text-red-600',
  transferencia: 'text-blue-600',
};

export default function ExtratoConta({ conta, onBack }) {
  const { data: movs = [], isLoading } = useQuery({
    queryKey: ['movimentacoes-conta', conta?.id],
    queryFn: () => base44.entities.MovimentacaoTesouraria.filter({ conta_id: conta.id }, '-data_movimentacao', 200),
    enabled: !!conta?.id,
  });

  if (!conta) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold">{conta.nome}</h2>
          <p className="text-sm text-gray-500">Saldo Atual: <strong className={`${(conta.saldo_atual || 0) < 0 ? 'text-red-600' : 'text-blue-700'}`}>{fmt(conta.saldo_atual)}</strong></p>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : movs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">Nenhuma movimentação registrada</CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Cards (mobile) */}
            <div className="md:hidden flex flex-col gap-2 p-2">
              {movs.map(m => {
                const Icon = TIPO_ICON[m.tipo] || ArrowLeftRight;
                const color = TIPO_COLOR[m.tipo] || 'text-gray-600';
                return (
                  <div key={`mc-${m.id}`} className="p-3 rounded-lg border border-gray-200 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                        <span className={`capitalize font-medium ${color}`}>{m.tipo}</span>
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">{m.data_movimentacao ? new Date(m.data_movimentacao).toLocaleDateString('pt-BR') : '—'}</span>
                    </div>
                    {m.descricao && <p className="text-sm text-gray-700 break-words">{m.descricao}</p>}
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        {m.categoria && <Badge variant="outline" className="text-xs capitalize">{(m.categoria || '').replace(/_/g, ' ')}</Badge>}
                        <p className="text-[11px] text-gray-400 mt-1">Saldo após: <span className={`${(m.saldo_posterior || 0) < 0 ? 'text-red-600' : 'text-gray-600'}`}>{fmt(m.saldo_posterior)}</span></p>
                      </div>
                      <p className={`text-base font-bold shrink-0 ${m.tipo === 'saida' ? 'text-red-600' : 'text-green-600'}`}>
                        {m.tipo === 'saida' ? '- ' : '+ '}{fmt(m.valor)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tabela (desktop) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Descrição</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Categoria</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Valor</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Saldo Após</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movs.map(m => {
                    const Icon = TIPO_ICON[m.tipo] || ArrowLeftRight;
                    const color = TIPO_COLOR[m.tipo] || 'text-gray-600';
                    return (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">
                          {m.data_movimentacao ? new Date(m.data_movimentacao).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${color}`} />
                            <span className={`capitalize font-medium ${color}`}>{m.tipo}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate">{m.descricao}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs capitalize">{(m.categoria || '').replace(/_/g, ' ')}</Badge>
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${m.tipo === 'saida' ? 'text-red-600' : 'text-green-600'}`}>
                          {m.tipo === 'saida' ? '- ' : '+ '}{fmt(m.valor)}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${(m.saldo_posterior || 0) < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                          {fmt(m.saldo_posterior)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Status que indicam conta já quitada/encerrada (não deve aparecer como "próximo recebimento").
const STATUS_ENCERRADOS = ['recebido', 'pago', 'cancelado'];

// Interpreta uma data "YYYY-MM-DD" como meia-noite LOCAL (e não UTC), evitando erro de ±1 dia por fuso.
const parseDataLocal = (str) => {
  if (!str) return new Date(NaN);
  const m = String(str).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(str);
};

const saldoRestante = (c) => (c.valor || 0) - (c.valor_recebido || 0);

export default function ProximosRecebimentos({ diasAntecedencia = 30 }) {
  const { data: contas } = useQuery({
    queryKey: ['contas-receber-proximas', diasAntecedencia],
    queryFn: async () => {
      const todasContas = await base44.entities.ContaFinanceira.filter({ tipo: 'receber' });

      const limiteData = new Date();
      limiteData.setHours(0, 0, 0, 0);
      limiteData.setDate(limiteData.getDate() + diasAntecedencia);

      const filtradas = todasContas.filter(c => {
        if (STATUS_ENCERRADOS.includes(c.status)) return false;
        if (saldoRestante(c) <= 0) return false; // já recebido por completo
        const vencimento = parseDataLocal(c.data_vencimento);
        return vencimento <= limiteData;
      });

      // Ordenar por vencimento
      filtradas.sort((a, b) => parseDataLocal(a.data_vencimento) - parseDataLocal(b.data_vencimento));

      return filtradas.slice(0, 5); // Top 5
    }
  });

  const getDiasAteVencimento = (dataVencimento) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = parseDataLocal(dataVencimento);
    const diff = Math.round((vencimento - hoje) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const totalProximosRecebimentos = contas?.reduce((s, c) => s + saldoRestante(c), 0) || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Próximos Recebimentos</CardTitle>
        <Link to={createPageUrl('ContasReceber')}>
          <Button variant="ghost" size="sm">Ver Todos</Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <p className="text-sm text-gray-600">Total próximos {diasAntecedencia} dias</p>
          <p className="text-2xl font-bold text-green-600">
            R$ {totalProximosRecebimentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {!contas || contas.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            Nenhum recebimento próximo
          </div>
        ) : (
          <div className="space-y-3">
            {contas.map(conta => {
              const diasAte = getDiasAteVencimento(conta.data_vencimento);
              const vencido = diasAte < 0;
              const urgente = diasAte >= 0 && diasAte <= 7;
              const valorRestante = saldoRestante(conta);

              return (
                <div
                  key={conta.id}
                  className={`p-3 rounded-lg border ${
                    vencido ? 'bg-red-50 border-red-200' :
                    urgente ? 'bg-yellow-50 border-yellow-200' :
                    'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium text-sm">{conta.descricao}</p>
                    <span className={`text-xs px-2 py-1 rounded ${
                      vencido ? 'bg-red-500 text-white' :
                      urgente ? 'bg-yellow-500 text-white' :
                      'bg-blue-500 text-white'
                    }`}>
                      {vencido ? 'VENCIDO' : urgente ? 'URGENTE' : `${diasAte}d`}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}
                    </div>
                    <div className="font-bold text-gray-900">
                      {valorRestante.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
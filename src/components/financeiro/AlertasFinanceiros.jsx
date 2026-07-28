import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, AlertCircle, Clock } from 'lucide-react';

export default function AlertasFinanceiros({ contas }) {
  const alertas = useMemo(() => {
    const lista = [];

    contas.forEach(conta => {
      // Alerta: Contas atrasadas
      if (conta.status === 'atrasado') {
        const diasAtraso = Math.ceil((new Date() - new Date(conta.data_vencimento)) / (1000 * 60 * 60 * 24));
        lista.push({
          tipo: 'atrasado',
          titulo: `${conta.tipo === 'pagar' ? 'Pagamento' : 'Recebimento'} atrasado`,
          descricao: conta.descricao,
          valor: conta.valor,
          dias: diasAtraso,
          severidade: diasAtraso > 30 ? 'critica' : 'alta',
          data: conta.data_vencimento
        });
      }

      // Alerta: Contas com alto valor
      if (conta.valor > 50000 && conta.status !== 'pago') {
        lista.push({
          tipo: 'alto_valor',
          titulo: 'Conta de alto valor',
          descricao: conta.descricao,
          valor: conta.valor,
          severidade: 'media',
          data: conta.data_vencimento
        });
      }

      // Alerta: Vencimento próximo (7 dias)
      const diasParaVencer = Math.ceil((new Date(conta.data_vencimento) - new Date()) / (1000 * 60 * 60 * 24));
      if (diasParaVencer <= 7 && diasParaVencer > 0 && conta.status === 'pendente') {
        lista.push({
          tipo: 'vencimento_proximo',
          titulo: 'Vencimento próximo',
          descricao: conta.descricao,
          valor: conta.valor,
          dias: diasParaVencer,
          severidade: 'baixa',
          data: conta.data_vencimento
        });
      }
    });

    return lista.sort((a, b) => {
      const severidadeOrder = { critica: 0, alta: 1, media: 2, baixa: 3 };
      return severidadeOrder[a.severidade] - severidadeOrder[b.severidade];
    });
  }, [contas]);

  const tiposAlerta = {
    atrasado: { icon: AlertTriangle, cor: 'bg-red-50 text-red-700 border-red-200', label: 'Atrasado' },
    alto_valor: { icon: AlertCircle, cor: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Alto Valor' },
    vencimento_proximo: { icon: Clock, cor: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Vencimento Próximo' }
  };

  if (alertas.length === 0) {
    return (
      <Card className="bg-emerald-50 border-emerald-200">
        <CardContent className="py-8 text-center">
          <div className="text-emerald-700 font-medium">✓ Nenhum alerta financeiro</div>
          <div className="text-sm text-emerald-600 mt-1">Sua situação financeira está em dia</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-gray-900 font-medium text-sm">Alertas Financeiros ({alertas.length})</h3>
      {alertas.map((alerta, idx) => {
        const config = tiposAlerta[alerta.tipo];
        const Icon = config.icon;

        return (
          <Card key={idx} className={`border ${config.cor}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{alerta.titulo}</div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{alerta.descricao}</div>
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <Badge className="bg-white/70 border-0 text-gray-700">
                      {alerta.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </Badge>
                    {alerta.dias && (
                      <Badge className="bg-white/70 border-0 text-gray-700">
                        {alerta.tipo === 'atrasado' ? `${alerta.dias} dias atrasado` : `${alerta.dias} dias`}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
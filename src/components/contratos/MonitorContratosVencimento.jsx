import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MonitorContratosVencimento({ contratos = [] }) {
  const contractosPorStatus = useMemo(() => {
    const hoje = new Date();
    const criticos = [];
    const proximosVencimento = [];
    const vigentes = [];
    const vencidos = [];

    contratos.forEach(contrato => {
      const dataVencimento = contrato.data_vencimento ? new Date(contrato.data_vencimento) : null;
      if (!dataVencimento) return;

      const diasRestantes = differenceInDays(dataVencimento, hoje);

      if (diasRestantes < 0) {
        vencidos.push({ ...contrato, diasRestantes });
      } else if (diasRestantes <= 30) {
        criticos.push({ ...contrato, diasRestantes });
      } else if (diasRestantes <= 90) {
        proximosVencimento.push({ ...contrato, diasRestantes });
      } else {
        vigentes.push({ ...contrato, diasRestantes });
      }
    });

    return { criticos, proximosVencimento, vigentes, vencidos };
  }, [contratos]);

  const ContractCard = ({ contrato, status }) => {
    const dataVencimento = contrato.data_vencimento ? new Date(contrato.data_vencimento) : null;
    const diasRestantes = contrato.diasRestantes;

    return (
      <div className={`p-4 rounded-lg border-l-4 ${status === 'critico' ? 'bg-red-50 border-red-500' : status === 'proximo' ? 'bg-yellow-50 border-yellow-500' : status === 'vencido' ? 'bg-red-100 border-red-600' : 'bg-green-50 border-green-500'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{contrato.numero || contrato.nome || 'Sem número'}</p>
            <p className="text-xs text-gray-600 mt-1">Fornecedor/Cliente: {contrato.fornecedor_cliente || '-'}</p>
            {dataVencimento && (
              <p className="text-xs text-gray-600 mt-1">
                Vencimento: {format(dataVencimento, 'dd/MM/yyyy', { locale: ptBR })}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            {status === 'critico' && <AlertTriangle className="w-5 h-5 text-red-500 mb-2" />}
            {status === 'proximo' && <Clock className="w-5 h-5 text-yellow-500 mb-2" />}
            {status === 'vencido' && <AlertTriangle className="w-5 h-5 text-red-600 mb-2" />}
            {status === 'vigente' && <CheckCircle className="w-5 h-5 text-green-600 mb-2" />}

            <Badge
              className={`text-xs ${
                status === 'critico'
                  ? 'bg-red-600'
                  : status === 'proximo'
                    ? 'bg-yellow-600'
                    : status === 'vencido'
                      ? 'bg-red-700'
                      : 'bg-green-600'
              }`}
            >
              {status === 'vencido'
                ? `${Math.abs(diasRestantes)} dias atrás`
                : `${diasRestantes} dias`}
            </Badge>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Resumo Executivo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-red-600 uppercase">Críticos</p>
            <p className="text-3xl font-bold text-red-600">{contractosPorStatus.criticos.length}</p>
            <p className="text-xs text-gray-600 mt-1">≤ 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-yellow-600 uppercase">Próximos</p>
            <p className="text-3xl font-bold text-yellow-600">{contractosPorStatus.proximosVencimento.length}</p>
            <p className="text-xs text-gray-600 mt-1">≤ 90 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-green-600 uppercase">Vigentes</p>
            <p className="text-3xl font-bold text-green-600">{contractosPorStatus.vigentes.length}</p>
            <p className="text-xs text-gray-600 mt-1">&gt; 90 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-red-700 uppercase">Vencidos</p>
            <p className="text-3xl font-bold text-red-700">{contractosPorStatus.vencidos.length}</p>
            <p className="text-xs text-gray-600 mt-1">Ação imediata</p>
          </CardContent>
        </Card>
      </div>

      {/* Contratos Vencidos */}
      {contractosPorStatus.vencidos.length > 0 && (
        <Card className="border-red-300">
          <CardHeader className="bg-red-50">
            <CardTitle className="text-sm flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              Contratos Vencidos ({contractosPorStatus.vencidos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {contractosPorStatus.vencidos.map(c => (
              <ContractCard key={c.id} contrato={c} status="vencido" />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Contratos Críticos */}
      {contractosPorStatus.criticos.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="bg-red-50">
            <CardTitle className="text-sm flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-4 h-4" />
              Vencimento em até 30 dias ({contractosPorStatus.criticos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {contractosPorStatus.criticos.map(c => (
              <ContractCard key={c.id} contrato={c} status="critico" />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Próximos Vencimentos */}
      {contractosPorStatus.proximosVencimento.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader className="bg-yellow-50">
            <CardTitle className="text-sm flex items-center gap-2 text-yellow-700">
              <Clock className="w-4 h-4" />
              Vencimento em 31-90 dias ({contractosPorStatus.proximosVencimento.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {contractosPorStatus.proximosVencimento.map(c => (
              <ContractCard key={c.id} contrato={c} status="proximo" />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Contratos Vigentes */}
      {contractosPorStatus.vigentes.length > 0 && (
        <Card className="border-green-200">
          <CardHeader className="bg-green-50">
            <CardTitle className="text-sm flex items-center gap-2 text-green-700">
              <CheckCircle className="w-4 h-4" />
              Contratos Vigentes ({contractosPorStatus.vigentes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {contractosPorStatus.vigentes.slice(0, 5).map(c => (
              <ContractCard key={c.id} contrato={c} status="vigente" />
            ))}
            {contractosPorStatus.vigentes.length > 5 && (
              <p className="text-xs text-gray-600 p-2">+{contractosPorStatus.vigentes.length - 5} contratos vigentes</p>
            )}
          </CardContent>
        </Card>
      )}

      {contratos.length === 0 && (
        <Card className="text-center p-8 text-gray-600">
          Nenhum contrato cadastrado para monitorar
        </Card>
      )}
    </div>
  );
}
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertCircle, CheckCircle2, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ListaCronograma({ obraId }) {
  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ['cronograma-obra', obraId],
    queryFn: async () => {
      if (!obraId) return [];
      const dados = await base44.entities.CronogramaItem.filter({ obraId });
      return dados || [];
    },
    enabled: !!obraId
  });

  const statusBadge = (status) => {
    const variants = {
      'Não iniciado': 'bg-gray-100 text-gray-700',
      'Em andamento': 'bg-blue-100 text-blue-700',
      'Concluído': 'bg-green-100 text-green-700',
      'Atrasado': 'bg-red-100 text-red-700'
    };
    return variants[status] || 'bg-gray-100 text-gray-700';
  };

  const formatarData = (data) => {
    if (!data) return '-';
    try {
      return new Date(data).toLocaleDateString('pt-BR');
    } catch {
      return data;
    }
  };

  if (isLoading) {
    return <div className="text-center text-gray-500 py-4">Carregando cronograma...</div>;
  }

  if (atividades.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium">Cronograma não informado</p>
          <p className="text-amber-700">Sem cronograma não é possível iniciar medições corretamente.</p>
        </div>
      </div>
    );
  }

  const primeiras10 = atividades.slice(0, 10);
  const temMais = atividades.length > 10;

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex gap-2 items-start text-sm text-green-800">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span><strong>{atividades.length}</strong> atividade(s) importada(s)</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Atividade</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Qtd</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Início</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Fim</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Responsável</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
            </tr>
          </thead>
          <tbody>
            {primeiras10.map((ativ, idx) => (
              <tr key={ativ.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{ativ.nomeAtividade}</td>
                <td className="px-4 py-3 text-gray-700">{ativ.quantidadePlanejada} {ativ.und}</td>
                <td className="px-4 py-3 text-gray-700">{formatarData(ativ.dataInicioPlanejada)}</td>
                <td className="px-4 py-3 text-gray-700">{formatarData(ativ.dataFimPlanejada)}</td>
                <td className="px-4 py-3 text-gray-700 text-xs">{ativ.responsavel || '-'}</td>
                <td className="px-4 py-3">
                  <Badge className={statusBadge(ativ.status)}>
                    {ativ.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {temMais && (
        <p className="text-sm text-gray-600 text-center">
          Mostrando 10 de {atividades.length} atividades
        </p>
      )}
    </div>
  );
}
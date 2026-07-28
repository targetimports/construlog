import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Wrench, Building2 } from 'lucide-react';
import Pagination from '../shared/Pagination';
import { usePagination } from '../shared/usePagination';

const ITENS_POR_PAGINA = 15;

const statusConfig = {
  pendente: { label: 'Pendente', color: 'bg-amber-100 text-amber-700' },
  aprovada: { label: 'Aprovada', color: 'bg-emerald-100 text-emerald-700' },
  rejeitada: { label: 'Rejeitada', color: 'bg-red-100 text-red-700' },
  em_uso: { label: 'Em Uso', color: 'bg-blue-100 text-blue-700' },
  finalizada: { label: 'Finalizada', color: 'bg-gray-100 text-gray-700' }
};

const prioridadeConfig = {
  baixa: { label: 'Baixa', color: 'bg-blue-100 text-blue-700' },
  media: { label: 'Média', color: 'bg-amber-100 text-amber-700' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  critica: { label: 'Crítica', color: 'bg-red-100 text-red-700' }
};

function formatarData(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleDateString('pt-BR');
}

export default function SolicitacaoEquipamentoList({ solicitacoes = [], isLoading, obras = [], equipamentos = [] }) {
  const obrasMap = useMemo(() => new Map(obras.map(o => [o.id, o.nome])), [obras]);
  const equipMap = useMemo(() => new Map(equipamentos.map(e => [e.id, e.nome])), [equipamentos]);

  const {
    currentPage, totalPages, paginatedItems, goToPage,
    startIndex, endIndex, totalItems
  } = usePagination(solicitacoes, ITENS_POR_PAGINA);

  if (isLoading) {
    return (
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-12 text-center text-gray-500">Carregando...</CardContent>
      </Card>
    );
  }

  if (solicitacoes.length === 0) {
    return (
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
          <ClipboardList className="w-10 h-10" />
          <p className="text-sm text-gray-500">Nenhuma solicitação encontrada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Motivo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Obra</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Item</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Período</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Prioridade</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedItems.map(sol => {
                const status = statusConfig[sol.status] || { label: sol.status || '—', color: 'bg-gray-100 text-gray-700' };
                const prioridade = prioridadeConfig[sol.prioridade] || { label: sol.prioridade || '—', color: 'bg-gray-100 text-gray-700' };
                const isAluguel = sol.tipo_solicitacao === 'aluguel';
                const item = isAluguel
                  ? (sol.descricao_aluguel || 'Aluguel')
                  : (equipMap.get(sol.equipamento_id) || sol.equipamento_id || '—');
                return (
                  <tr key={sol.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{sol.motivo || '—'}</p>
                      <p className="text-xs text-gray-500">{isAluguel ? 'Aluguel de terceiros' : 'Equipamento próprio'}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        {obrasMap.get(sol.obra_id) || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate" title={item}>
                      <span className="inline-flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        {item}
                        {isAluguel && sol.valor_estimado_aluguel != null && (
                          <span className="text-xs text-gray-500">
                            (R$ {Number(sol.valor_estimado_aluguel).toLocaleString('pt-BR')})
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatarData(sol.data_inicio)} – {formatarData(sol.data_fim)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={`border-0 ${prioridade.color}`}>{prioridade.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        className={`border-0 ${status.color}`}
                        title={sol.status === 'rejeitada' ? (sol.motivo_rejeicao || '') : (sol.aprovado_por ? `Aprovado por ${sol.aprovado_por}` : '')}
                      >
                        {status.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          startIndex={startIndex}
          endIndex={endIndex}
          totalItems={totalItems}
        />
      </CardContent>
    </Card>
  );
}

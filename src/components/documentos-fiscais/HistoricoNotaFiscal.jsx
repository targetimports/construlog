import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

/**
 * HistoricoNotaFiscal - Exibe auditoria de alterações em uma NF
 */
export default function HistoricoNotaFiscal({ nf_id }) {
  const { data: auditoria = [], isLoading } = useQuery({
    queryKey: ['nf-auditoria', nf_id],
    queryFn: () =>
      base44.entities.NotaFiscalAuditoria.filter({
        documento_fiscal_id: nf_id,
      }, '-created_date', 50),
  });

  const acaoColors = {
    CRIACAO: 'bg-green-100 text-green-800',
    EDICAO: 'bg-blue-100 text-blue-800',
    CONFIRMACAO: 'bg-purple-100 text-purple-800',
    CANCELAMENTO: 'bg-red-100 text-red-800',
  };

  if (isLoading) {
    return <div className="text-xs text-gray-500">Carregando...</div>;
  }

  if (auditoria.length === 0) {
    return <div className="text-xs text-gray-500">Sem histórico</div>;
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {auditoria.map(entry => (
        <div key={entry.id} className="border-l-2 border-gray-300 pl-3 py-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={acaoColors[entry.acao] || 'bg-gray-100'} variant="outline">
              {entry.acao}
            </Badge>
            <span className="text-xs text-gray-600">
              {new Date(entry.created_date).toLocaleString('pt-BR')}
            </span>
          </div>

          <p className="text-xs text-gray-700">
            <span className="font-semibold">{entry.user_nome || entry.user_id}</span>
          </p>

          {entry.campo_alterado && (
            <div className="text-xs text-gray-600 mt-1 bg-gray-50 p-1 rounded">
              <p className="font-mono">
                <strong>{entry.campo_alterado}:</strong>
              </p>
              <p className="text-red-600 line-through">antes: {entry.valor_antigo}</p>
              <p className="text-green-600">depois: {entry.valor_novo}</p>
              {entry.motivo && <p className="italic text-gray-500">{entry.motivo}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
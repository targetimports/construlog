import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Download, Eye } from 'lucide-react';

/**
 * ListaNFDocumentos - Exibe lista de NFs anexadas a um contexto
 * 
 * Props:
 * - contexto_tipo: string
 * - contexto_id: string
 * - onAdicionarClick: () => void
 */
export default function ListaNFDocumentos({ contexto_tipo, contexto_id, onAdicionarClick }) {
  const { data: nfs = [], isLoading } = useQuery({
    queryKey: ['notas-fiscais', contexto_tipo, contexto_id],
    queryFn: () =>
      base44.entities.NotaFiscal.filter({
        contexto_tipo,
        contexto_id,
      }, '-created_date', 20),
  });

  const statusColors = {
    VALIDADA: 'bg-green-100 text-green-800',
    RASCUNHO: 'bg-yellow-100 text-yellow-800',
    REJEITADA: 'bg-red-100 text-red-800',
  };

  if (isLoading) {
    return <div className="text-sm text-gray-500">Carregando...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">Notas Fiscais</h3>
        <Button
          size="sm"
          className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
          onClick={onAdicionarClick}
        >
          + Adicionar NF
        </Button>
      </div>

      {nfs.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center">
          <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-xs text-gray-500">Nenhuma nota fiscal anexada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {nfs.map(nf => (
            <div key={nf.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    NF {nf.numero_nf}
                  </p>
                  <p className="text-xs text-gray-600 truncate">{nf.fornecedor_nome}</p>
                </div>
                <Badge className={statusColors[nf.status] || 'bg-gray-100'}>
                  {nf.status}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                <div>
                  <span className="text-gray-500">Emissão</span>
                  <p className="font-medium text-gray-900">
                    {new Date(nf.data_emissao).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Valor</span>
                  <p className="font-medium text-gray-900">
                    R$ {Number(nf.valor_total).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Impostos</span>
                  <p className="font-medium text-gray-900">
                    R$ {Number(nf.valor_impostos).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>

              {nf.observacao && (
                <p className="text-xs text-gray-600 mb-2 italic">{nf.observacao}</p>
              )}

              <div className="flex gap-1">
                {nf.arquivo_url && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs gap-1"
                      onClick={() => window.open(nf.arquivo_url, '_blank')}
                    >
                      <Eye className="w-3 h-3" /> Ver
                    </Button>
                    <a href={nf.arquivo_url} download className="flex-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs gap-1 w-full"
                      >
                        <Download className="w-3 h-3" /> Download
                      </Button>
                    </a>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
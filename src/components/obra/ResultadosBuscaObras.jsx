import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function ResultadosBuscaObras({ 
  resultados, 
  total, 
  filtrados,
  carregando = false 
}) {
  if (carregando) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-2">Buscando obras...</p>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-600 font-medium">Nenhuma obra encontrada.</p>
        <p className="text-gray-500 text-sm mt-1">Tente ajustar os critérios de busca.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Resumo */}
      <div className="mb-4 text-sm text-gray-600">
        Exibindo <strong>{total}</strong> obra{total !== 1 ? 's' : ''}
        {filtrados && ' (filtrado de acordo com sua busca)'}
      </div>

      {/* Grid de Resultados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {resultados.map(obra => (
          <div
            key={obra.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            {/* Nome da Obra */}
            <h3 className="font-semibold text-gray-900 text-lg mb-2 line-clamp-2">
              {obra.nome}
            </h3>

            {/* Cliente */}
            {(obra.cliente_nome || obra.cliente?.nome || obra.cliente) && (
              <div className="text-xs text-gray-600 mb-2">
                <span className="font-medium">Cliente:</span> {obra.cliente_nome || obra.cliente?.nome || obra.cliente}
              </div>
            )}

            {/* Localização */}
            <div className="text-xs text-gray-600 mb-3">
              <span className="font-medium">Local:</span> {obra.cidade || 'N/A'}
              {obra.estado && ` / ${obra.estado}`}
            </div>

            {/* Datas */}
            <div className="text-xs text-gray-600 space-y-1 mb-3">
              {obra.data_inicio && (
                <div>
                  <span className="font-medium">Início:</span> {new Date(obra.data_inicio).toLocaleDateString('pt-BR')}
                </div>
              )}
              {obra.data_prevista_fim && (
                <div>
                  <span className="font-medium">Término:</span> {new Date(obra.data_prevista_fim).toLocaleDateString('pt-BR')}
                </div>
              )}
            </div>

            {/* Responsável */}
            {obra.responsavel_tecnico && (
              <div className="text-xs text-gray-600 mb-3">
                <span className="font-medium">Responsável:</span> {obra.responsavel_tecnico}
              </div>
            )}

            {/* Badges de Status */}
            <div className="flex flex-wrap gap-2 mb-4">
              {obra.categoria_dre && (
                <Badge variant="outline" className="text-xs">
                  {obra.categoria_dre}
                </Badge>
              )}
              {obra.tipo_obra && (
                <Badge variant="outline" className="text-xs">
                  {obra.tipo_obra}
                </Badge>
              )}
            </div>

            {/* Botão de Ação */}
            <Button
              size="sm"
              className="w-full flex items-center justify-between"
              onClick={() => window.location.href = createPageUrl('ObraDetalhes', `obraId=${obra.id}`)}
            >
              <span>Ver Detalhes</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
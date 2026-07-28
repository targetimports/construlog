import React from 'react';
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

/**
 * Painel de histórico de alterações de NF
 * Mostra quem alterou, quando, e quais campos foram mudados
 */
export default function PainelHistoricoNF({ historicoAuditoria = [], isExpanded, onToggle }) {
  if (!historicoAuditoria || historicoAuditoria.length === 0) {
    return null;
  }

  const camposFinanceiros = ['valor_total', 'valor_desconto', 'valor_frete', 'valor_outros', 'valor_final_ajustado'];

  // Agrupar por data
  const agrupado = {};
  historicoAuditoria.forEach(h => {
    const data = new Date(h.created_date).toLocaleDateString('pt-BR');
    if (!agrupado[data]) agrupado[data] = [];
    agrupado[data].push(h);
  });

  return (
    <Card className="border-l-2 border-l-amber-500">
      <div
        className="p-4 cursor-pointer flex items-center justify-between hover:bg-gray-50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <div>
            <h3 className="font-semibold text-sm text-gray-900">Histórico de Alterações</h3>
            <p className="text-xs text-gray-500">{historicoAuditoria.length} registros</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </div>

      {isExpanded && (
        <div className="border-t p-4 space-y-4 bg-gray-50">
          {Object.entries(agrupado)
            .sort()
            .reverse()
            .map(([data, registros]) => (
              <div key={data}>
                <p className="text-xs font-bold text-gray-600 mb-2">{data}</p>
                <div className="space-y-2 ml-3">
                  {registros.map((h) => {
                    const isValorFinanceiro = camposFinanceiros.includes(h.campo_alterado);
                    const hora = new Date(h.created_date).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div
                        key={h.id}
                        className={`text-xs p-2 rounded border-l-2 ${
                          isValorFinanceiro
                            ? 'border-l-red-500 bg-red-50 text-red-900'
                            : 'border-l-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">
                              {h.acao === 'CRIACAO' ? 'Criado' : 'Alterado'}: {h.campo_alterado}
                            </div>
                            <div className="text-xs mt-1">
                              <span className="line-through text-gray-500">{h.valor_antigo}</span>
                              <span className="mx-1">→</span>
                              <span className="font-bold">{h.valor_novo}</span>
                            </div>
                            {h.motivo && (
                              <div className="text-xs mt-1 italic text-gray-600">
                                Motivo: {h.motivo}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 mt-1">
                              {h.user_nome} • {hora}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </Card>
  );
}
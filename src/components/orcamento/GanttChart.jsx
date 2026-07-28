import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function GanttChart({ itens, orcamento }) {
  // Agrupar itens por categoria
  const itensPorCategoria = itens.reduce((acc, item) => {
    const cat = item.categoria;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categorias = [
    { key: 'materiais', label: 'Materiais', color: 'bg-blue-500' },
    { key: 'mao_obra', label: 'Mão de Obra', color: 'bg-emerald-500' },
    { key: 'equipamentos', label: 'Equipamentos', color: 'bg-purple-500' },
    { key: 'transporte', label: 'Transporte', color: 'bg-amber-500' }
  ];

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">Cronograma de Gantt</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header de Meses */}
          <div className="flex mb-4">
            <div className="w-48 flex-shrink-0"></div>
            <div className="flex-1 grid grid-cols-12 gap-1">
              {MESES.map((mes, idx) => (
                <div key={idx} className="text-center text-xs text-gray-400 font-medium">
                  {mes}
                </div>
              ))}
            </div>
          </div>

          {/* Categorias */}
          {categorias.map(categoria => {
            const itensCategoria = itensPorCategoria[categoria.key] || [];
            if (itensCategoria.length === 0) return null;

            // Calcular meses com atividades
            const mesesAtivos = new Set(itensCategoria.map(item => item.mes_previsto).filter(Boolean));
            const mesInicio = Math.min(...mesesAtivos);
            const mesFim = Math.max(...mesesAtivos);

            return (
              <div key={categoria.key} className="mb-6">
                <div className="flex items-center mb-2">
                  <div className="w-48 flex-shrink-0">
                    <h4 className="text-white font-medium">{categoria.label}</h4>
                    <p className="text-gray-500 text-xs">
                      {itensCategoria.length} item(ns) • {
                        itensCategoria.reduce((acc, i) => acc + i.valor_total, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      }
                    </p>
                  </div>
                  <div className="flex-1 grid grid-cols-12 gap-1 relative h-12">
                    {/* Barra de progresso */}
                    {mesesAtivos.size > 0 && (
                      <div
                        className={cn(
                          "absolute h-8 rounded-lg opacity-80 flex items-center justify-center",
                          categoria.color
                        )}
                        style={{
                          left: `${((mesInicio - 1) / 12) * 100}%`,
                          width: `${((mesFim - mesInicio + 1) / 12) * 100}%`,
                          top: '50%',
                          transform: 'translateY(-50%)'
                        }}
                      >
                        <span className="text-white text-xs font-medium">
                          {mesInicio === mesFim ? `Mês ${mesInicio}` : `Meses ${mesInicio}-${mesFim}`}
                        </span>
                      </div>
                    )}

                    {/* Grid de meses */}
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => (
                      <div key={mes} className="border border-gray-800 rounded">
                        {mesesAtivos.has(mes) && (
                          <div className="h-full flex items-center justify-center">
                            <div className={cn("w-2 h-2 rounded-full", categoria.color)} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sub-itens principais */}
                {itensCategoria
                  .sort((a, b) => b.valor_total - a.valor_total)
                  .slice(0, 3)
                  .map((item, idx) => (
                    <div key={idx} className="flex items-center mb-1 ml-4">
                      <div className="w-44 flex-shrink-0">
                        <p className="text-gray-400 text-xs truncate">{item.descricao}</p>
                      </div>
                      <div className="flex-1 grid grid-cols-12 gap-1">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => (
                          <div key={mes} className="h-6 flex items-center justify-center">
                            {item.mes_previsto === mes && (
                              <Badge variant="outline" className={cn("text-xs py-0 px-1 border-0", categoria.color, "bg-opacity-20")}>
                                •
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            );
          })}

          {/* Legenda */}
          <div className="mt-6 pt-4 border-t border-gray-800 flex gap-4">
            {categorias.map(categoria => (
              <div key={categoria.key} className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded", categoria.color)} />
                <span className="text-gray-400 text-xs">{categoria.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
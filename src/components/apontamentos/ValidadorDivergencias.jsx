import React, { useMemo } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const MOTIVOS_FALTA = [
  'Consumo maior que previsto',
  'Perda/Dano durante transporte',
  'Roubo ou desaparecimento',
  'Erro em apontamento anterior',
  'Qualidade rejeitada',
  'Ajuste de inventário'
];

const MOTIVOS_SOBRA = [
  'Compra maior que planejado',
  'Apontamento anterior impreciso',
  'Devolução de obra',
  'Material não utilizado',
  'Erro de contagem',
  'Sobra planejada para próxima obra'
];

export default function ValidadorDivergencias({ materiais, onValidar }) {
  const divergencias = useMemo(() => {
    if (!materiais || materiais.length === 0) return [];

    return materiais
      .map(mat => {
        const diferenca = mat.quantidade_inventario - mat.quantidade_teorica;
        const percentual = mat.quantidade_teorica > 0 
          ? (Math.abs(diferenca) / mat.quantidade_teorica) * 100 
          : 0;

        return {
          ...mat,
          diferenca,
          percentual: percentual.toFixed(1),
          tipo: diferenca < 0 ? 'falta' : diferenca > 0 ? 'sobra' : null,
          significativa: Math.abs(percentual) > 10
        };
      })
      .filter(mat => mat.tipo !== null);
  }, [materiais]);

  const sugerirMotivos = (tipo) => {
    return tipo === 'falta' ? MOTIVOS_FALTA : MOTIVOS_SOBRA;
  };

  if (divergencias.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        Nenhuma divergência detectada
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {divergencias.map((mat, idx) => (
        <Card 
          key={idx} 
          className={`bg-gray-800 border-l-4 ${
            mat.tipo === 'falta' 
              ? 'border-l-red-500 bg-red-500/5' 
              : 'border-l-amber-500 bg-amber-500/5'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={`mt-1 ${mat.tipo === 'falta' ? 'text-red-400' : 'text-amber-400'}`}>
                {mat.tipo === 'falta' ? (
                  <TrendingDown className="w-5 h-5" />
                ) : (
                  <TrendingUp className="w-5 h-5" />
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-white">{mat.material_nome}</span>
                  {mat.significativa && (
                    <Badge className={mat.tipo === 'falta' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}>
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {mat.percentual}% diferença
                    </Badge>
                  )}
                </div>

                <div className="text-sm text-gray-400 mb-2">
                  Inventário: {mat.quantidade_inventario} | Teórico: {mat.quantidade_teorica} | 
                  <span className={mat.tipo === 'falta' ? 'text-red-400' : 'text-amber-400'}>
                    {' '}{mat.tipo === 'falta' ? 'Falta' : 'Sobra'}: {Math.abs(mat.diferenca)}
                  </span>
                </div>

                <div className="text-xs text-gray-500 mb-2">
                  Possíveis motivos:
                </div>

                <div className="flex flex-wrap gap-1">
                  {sugerirMotivos(mat.tipo).map((motivo, i) => (
                    <button
                      key={i}
                      onClick={() => onValidar?.(mat, motivo)}
                      className="px-2 py-1 text-xs rounded-lg bg-gray-700/50 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
                    >
                      {motivo}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
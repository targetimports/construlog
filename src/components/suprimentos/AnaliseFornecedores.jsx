import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, TrendingUp, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AnaliseFornecedores({ fornecedores, ordens, comprasAnomalas }) {
  const analiseFornecedores = fornecedores.map(fornecedor => {
    const ordensFornecedor = ordens.filter(o => o.fornecedor_id === fornecedor.id);
    const valorTotal = ordensFornecedor.reduce((acc, o) => acc + (o.valor_total || 0), 0);
    const numeroCompras = ordensFornecedor.length;
    
    const comprasAnomalasFornecedor = comprasAnomalas.filter(c => c.ordem.fornecedor_id === fornecedor.id);
    const taxaAnomalias = numeroCompras > 0 
      ? (comprasAnomalasFornecedor.length / numeroCompras) * 100 
      : 0;

    // Calcular pontualidade (assumindo campo data_entrega_real vs data_entrega_prevista)
    const ordensEntregues = ordensFornecedor.filter(o => o.status === 'recebida');
    const atrasadas = ordensEntregues.filter(o => {
      if (!o.data_entrega_prevista || !o.data_entrega_real) return false;
      return new Date(o.data_entrega_real) > new Date(o.data_entrega_prevista);
    }).length;
    const taxaPontualidade = ordensEntregues.length > 0
      ? ((ordensEntregues.length - atrasadas) / ordensEntregues.length) * 100
      : 100;

    // Score de confiabilidade (100 - % anomalias - % atrasos)
    const score = Math.max(0, 100 - taxaAnomalias * 2 - (100 - taxaPontualidade));

    return {
      fornecedor,
      valorTotal,
      numeroCompras,
      taxaAnomalias: taxaAnomalias.toFixed(1),
      taxaPontualidade: taxaPontualidade.toFixed(1),
      score: score.toFixed(0),
      comprasAnomalasFornecedor: comprasAnomalasFornecedor.length
    };
  }).sort((a, b) => parseFloat(b.score) - parseFloat(a.score));

  const fornecedoresRisco = analiseFornecedores.filter(f => parseFloat(f.score) < 60);

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            Análise de Fornecedores
          </CardTitle>
          {fornecedoresRisco.length > 0 && (
            <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
              {fornecedoresRisco.length} em risco
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {analiseFornecedores.slice(0, 8).map(({ fornecedor, valorTotal, numeroCompras, taxaAnomalias, taxaPontualidade, score, comprasAnomalasFornecedor }) => {
            const scoreNum = parseFloat(score);
            const scoreConfig = scoreNum >= 80 
              ? { color: 'text-emerald-400', bg: 'bg-emerald-500' }
              : scoreNum >= 60
              ? { color: 'text-amber-400', bg: 'bg-amber-500' }
              : { color: 'text-red-400', bg: 'bg-red-500' };

            return (
              <div key={fornecedor.id} className="p-4 bg-gray-800/50 rounded-xl">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-white font-medium">{fornecedor.nome}</p>
                    <p className="text-gray-500 text-xs">{numeroCompras} compras • {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-2xl font-bold", scoreConfig.color)}>{score}</p>
                    <p className="text-gray-500 text-xs">Score</p>
                  </div>
                </div>

                <Progress value={parseFloat(score)} className="h-2 mb-3" />

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs">Pontualidade</p>
                    <p className="text-white font-medium">{taxaPontualidade}%</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Taxa de Anomalias</p>
                    <div className="flex items-center gap-1">
                      <p className="text-white font-medium">{taxaAnomalias}%</p>
                      {comprasAnomalasFornecedor > 0 && (
                        <AlertCircle className="w-3 h-3 text-red-400" />
                      )}
                    </div>
                  </div>
                </div>

                {comprasAnomalasFornecedor > 0 && (
                  <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-red-400 text-xs">
                      {comprasAnomalasFornecedor} compra(s) com preço suspeito detectada(s)
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
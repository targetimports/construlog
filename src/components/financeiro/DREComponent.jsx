import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DREComponent({ obras, contas }) {
  const dresPorObra = obras.map(obra => {
    const contasObra = contas.filter(c => c.obra_id === obra.id);
    
    // Receitas
    const receitaBruta = contasObra
      .filter(c => c.tipo === 'receber' && c.status === 'pago')
      .reduce((acc, c) => acc + (c.valor || 0), 0);
    
    const deducoes = receitaBruta * 0.145; // Estimativa 14.5% de impostos
    const receitaLiquida = receitaBruta - deducoes;
    
    // Custos Diretos
    const custoMaterial = contasObra
      .filter(c => c.tipo === 'pagar' && c.categoria === 'material' && c.status === 'pago')
      .reduce((acc, c) => acc + (c.valor || 0), 0);
    
    const custoMaoObra = contasObra
      .filter(c => c.tipo === 'pagar' && c.categoria === 'mao_de_obra' && c.status === 'pago')
      .reduce((acc, c) => acc + (c.valor || 0), 0);
    
    const custoEquipamento = contasObra
      .filter(c => c.tipo === 'pagar' && c.categoria === 'equipamento' && c.status === 'pago')
      .reduce((acc, c) => acc + (c.valor || 0), 0);
    
    const custosDirectos = custoMaterial + custoMaoObra + custoEquipamento;
    const lucroBruto = receitaLiquida - custosDirectos;
    const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;
    
    // Despesas Operacionais (estimativa)
    const despesasOper = receitaLiquida * 0.08; // 8% estimativa
    const lucroOperacional = lucroBruto - despesasOper;
    const lucroLiquido = lucroOperacional; // Simplificado
    const margemLiquida = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0;

    return {
      obra,
      receitaBruta,
      deducoes,
      receitaLiquida,
      custoMaterial,
      custoMaoObra,
      custoEquipamento,
      custosDirectos,
      lucroBruto,
      margemBruta,
      despesasOper,
      lucroOperacional,
      lucroLiquido,
      margemLiquida
    };
  });

  return (
    <div className="space-y-4">
      {dresPorObra.map(({ obra, receitaBruta, deducoes, receitaLiquida, custoMaterial, custoMaoObra, custoEquipamento, custosDirectos, lucroBruto, margemBruta, despesasOper, lucroOperacional, lucroLiquido, margemLiquida }) => (
        <Card key={obra.id} className="bg-white border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-gray-900">{obra.nome}</CardTitle>
              <Badge className={cn(
                "border-0",
                margemLiquida >= 15
                  ? "bg-emerald-100 text-emerald-700"
                  : margemLiquida >= 5
                  ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700"
              )}>
                Margem {margemLiquida.toFixed(1)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Receitas */}
              <div className="pb-3 border-b border-gray-100">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Receita Bruta</span>
                  <span className="text-gray-900 font-medium">{receitaBruta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500 pl-4">(-) Deduções</span>
                  <span className="text-red-600">({deducoes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-gray-900">Receita Líquida</span>
                  <span className="text-blue-600">{receitaLiquida.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              </div>

              {/* Custos Diretos */}
              <div className="pb-3 border-b border-gray-100">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500 pl-4">Material</span>
                  <span className="text-gray-500">{custoMaterial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500 pl-4">Mão de Obra</span>
                  <span className="text-gray-500">{custoMaoObra.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500 pl-4">Equipamentos</span>
                  <span className="text-gray-500">{custoEquipamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <div className="flex justify-between font-semibold mb-2">
                  <span className="text-gray-500">(-) Custos Diretos</span>
                  <span className="text-red-600">({custosDirectos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-gray-900">Lucro Bruto</span>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600">{lucroBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    <span className="text-xs text-gray-500">({margemBruta.toFixed(1)}%)</span>
                  </div>
                </div>
              </div>

              {/* Despesas Operacionais */}
              <div className="pb-3 border-b border-gray-100">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">(-) Despesas Operacionais</span>
                  <span className="text-red-600">({despesasOper.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-gray-900">Lucro Operacional</span>
                  <span className="text-blue-600">{lucroOperacional.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              </div>

              {/* Resultado Final */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-emerald-600 font-bold">Lucro Líquido</span>
                  <div className="flex items-center gap-2">
                    {lucroLiquido > 0 ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                    <span className={cn("text-xl font-bold", lucroLiquido > 0 ? "text-emerald-600" : "text-red-600")}>
                      {lucroLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {dresPorObra.length === 0 && (
        <Card className="bg-white border-gray-200">
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Nenhuma movimentação financeira encontrada para as obras selecionadas</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
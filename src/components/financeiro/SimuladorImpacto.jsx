import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calculator, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SimuladorImpacto({ obras }) {
  const [formData, setFormData] = useState({
    obra_id: '',
    tipo_simulacao: 'aumento_custo',
    percentual: '10',
    valor_fixo: ''
  });

  const [resultado, setResultado] = useState(null);

  const simular = () => {
    const obra = obras.find(o => o.id === formData.obra_id);
    if (!obra) return;

    const valorContrato = obra.valor_contrato || 0;
    const valorRealizado = obra.valor_realizado || 0;
    const margemAtual = valorContrato - valorRealizado;
    const percentualMargemAtual = valorContrato > 0 ? (margemAtual / valorContrato) * 100 : 0;

    let impacto = 0;
    let descricao = '';

    if (formData.tipo_simulacao === 'aumento_custo') {
      impacto = valorRealizado * (parseFloat(formData.percentual) / 100);
      descricao = `Aumento de ${formData.percentual}% nos custos`;
    } else if (formData.tipo_simulacao === 'reducao_custo') {
      impacto = -(valorRealizado * (parseFloat(formData.percentual) / 100));
      descricao = `Redução de ${formData.percentual}% nos custos`;
    } else if (formData.tipo_simulacao === 'aumento_receita') {
      impacto = -(valorContrato * (parseFloat(formData.percentual) / 100));
      descricao = `Aumento de ${formData.percentual}% na receita`;
    } else if (formData.tipo_simulacao === 'custo_fixo') {
      impacto = parseFloat(formData.valor_fixo) || 0;
      descricao = `Custo adicional de ${impacto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    }

    const novaMargemValor = margemAtual - impacto;
    const novoValorRealizado = valorRealizado + (impacto > 0 ? impacto : 0);
    const novoValorContrato = valorContrato + (impacto < 0 ? Math.abs(impacto) : 0);
    const novaMargemPercentual = novoValorContrato > 0 ? (novaMargemValor / novoValorContrato) * 100 : 0;

    setResultado({
      obra: obra.nome,
      descricao,
      margemAtual,
      percentualMargemAtual,
      novaMargemValor,
      novaMargemPercentual,
      impacto,
      diferencaMargem: novaMargemPercentual - percentualMargemAtual
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-amber-500" />
            Simulador de Impacto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-gray-500">Obra</Label>
            <Select value={formData.obra_id} onValueChange={(v) => setFormData({...formData, obra_id: v})}>
              <SelectTrigger className="mt-1.5 bg-white border-gray-300 text-gray-900">
                <SelectValue placeholder="Selecione a obra..." />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-300">
                {obras.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-gray-500">Tipo de Simulação</Label>
            <Select value={formData.tipo_simulacao} onValueChange={(v) => setFormData({...formData, tipo_simulacao: v})}>
              <SelectTrigger className="mt-1.5 bg-white border-gray-300 text-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-300">
                <SelectItem value="aumento_custo">Aumento de Custos (%)</SelectItem>
                <SelectItem value="reducao_custo">Redução de Custos (%)</SelectItem>
                <SelectItem value="aumento_receita">Aumento de Receita (%)</SelectItem>
                <SelectItem value="custo_fixo">Custo Adicional (R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.tipo_simulacao !== 'custo_fixo' ? (
            <div>
              <Label className="text-gray-500">Percentual (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.percentual}
                onChange={(e) => setFormData({...formData, percentual: e.target.value})}
                className="mt-1.5 bg-white border-gray-300 text-gray-900"
              />
            </div>
          ) : (
            <div>
              <Label className="text-gray-500">Valor Fixo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.valor_fixo}
                onChange={(e) => setFormData({...formData, valor_fixo: e.target.value})}
                className="mt-1.5 bg-white border-gray-300 text-gray-900"
              />
            </div>
          )}

          <Button 
            onClick={simular}
            className="w-full bg-amber-500 hover:bg-amber-600 text-gray-900"
            disabled={!formData.obra_id}
          >
            <Calculator className="w-4 h-4 mr-2" />
            Simular Impacto
          </Button>
        </CardContent>
      </Card>

      {resultado && (
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Resultado da Simulação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-gray-500 text-sm mb-1">Obra</p>
              <p className="text-gray-900 font-medium">{resultado.obra}</p>
              <p className="text-gray-500 text-xs mt-1">{resultado.descricao}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-gray-500 text-xs mb-1">Margem Atual</p>
                <p className="text-gray-900 font-bold text-lg">{resultado.percentualMargemAtual.toFixed(1)}%</p>
                <p className="text-gray-500 text-xs">{resultado.margemAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>

              <div className={cn(
                "p-3 border rounded-lg",
                resultado.novaMargemPercentual >= resultado.percentualMargemAtual
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-red-50 border-red-200"
              )}>
                <p className="text-gray-500 text-xs mb-1">Nova Margem</p>
                <p className={cn(
                  "font-bold text-lg",
                  resultado.novaMargemPercentual >= resultado.percentualMargemAtual ? "text-emerald-600" : "text-red-600"
                )}>
                  {resultado.novaMargemPercentual.toFixed(1)}%
                </p>
                <p className="text-gray-500 text-xs">{resultado.novaMargemValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
            </div>

            <div className={cn(
              "p-4 rounded-xl border flex items-center gap-3",
              resultado.diferencaMargem >= 0
                ? "bg-emerald-50 border-emerald-200"
                : "bg-red-50 border-red-200"
            )}>
              {resultado.diferencaMargem >= 0 ? (
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-600" />
              )}
              <div>
                <p className={cn(
                  "text-2xl font-bold",
                  resultado.diferencaMargem >= 0 ? "text-emerald-600" : "text-red-600"
                )}>
                  {resultado.diferencaMargem > 0 ? '+' : ''}{resultado.diferencaMargem.toFixed(2)}%
                </p>
                <p className="text-gray-500 text-sm">Variação na Margem</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-600 text-sm">
                {resultado.diferencaMargem < 0 
                  ? 'Este cenário impacta negativamente a margem do projeto'
                  : 'Este cenário melhora a margem do projeto'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
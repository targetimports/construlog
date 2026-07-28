import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Zap } from 'lucide-react';

export default function SimuladorObra({ obra_id, dre_atual }) {
  const [parametros, setParametros] = useState({
    aumento_material_percentual: 0,
    aumento_mao_obra_percentual: 0,
    aumento_consumo_percentual: 0,
    atraso_cronograma_dias: 0
  });

  const [resultado, setResultado] = useState(null);
  const [mostrarDetalhe, setMostrarDetalhe] = useState(false);

  const simular = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('simularObra', {
        obra_id,
        ...parametros
      });
      setResultado(res.data);
      setMostrarDetalhe(true);
      return res.data;
    }
  });

  const handleParametroChange = (campo, valor) => {
    setParametros({
      ...parametros,
      [campo]: parseFloat(valor) || 0
    });
  };

  const resetar = () => {
    setParametros({
      aumento_material_percentual: 0,
      aumento_mao_obra_percentual: 0,
      aumento_consumo_percentual: 0,
      atraso_cronograma_dias: 0
    });
    setResultado(null);
    setMostrarDetalhe(false);
  };

  // Após simular, usa o cenário atual calculado pelo backend (consistente com o
  // simulado). Antes, usa o dre_atual recebido por prop para as prévias.
  const cenarioAtual = (resultado && resultado.cenario_atual) ? {
    receita: resultado.cenario_atual.receita_faturada || 0,
    custo: resultado.cenario_atual.custo_total || 0,
    lucro: resultado.cenario_atual.lucro_bruto || 0,
    margem: resultado.cenario_atual.margem_percentual || 0
  } : dre_atual ? {
    receita: dre_atual.receita_faturada || 0,
    custo: dre_atual.custo_total || 0,
    lucro: dre_atual.lucro_bruto || 0,
    margem: dre_atual.margem_percentual || 0
  } : null;

  const cenarioSimulado = resultado ? resultado.cenario_simulado : null;

  const impactoTotal = resultado ? resultado.impactos.total_lucro : 0;
  const impactoPercentual = resultado ? resultado.impactos.total_percentual : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Simulador de Cenários
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Parâmetros */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold mb-2">
                Aumento de Custo Material (%)
              </label>
              <Input
                type="number"
                value={parametros.aumento_material_percentual}
                onChange={(e) => handleParametroChange('aumento_material_percentual', e.target.value)}
                placeholder="0"
                step="0.1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Impacto: {(dre_atual?.custo_materiais || 0) * (parametros.aumento_material_percentual / 100) > 0 ? '+' : ''}
                {((dre_atual?.custo_materiais || 0) * (parametros.aumento_material_percentual / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Aumento de Custo Mão de Obra (%)
              </label>
              <Input
                type="number"
                value={parametros.aumento_mao_obra_percentual}
                onChange={(e) => handleParametroChange('aumento_mao_obra_percentual', e.target.value)}
                placeholder="0"
                step="0.1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Impacto: {(dre_atual?.custo_mao_obra || 0) * (parametros.aumento_mao_obra_percentual / 100) > 0 ? '+' : ''}
                {((dre_atual?.custo_mao_obra || 0) * (parametros.aumento_mao_obra_percentual / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Aumento de Consumo (%)
              </label>
              <Input
                type="number"
                value={parametros.aumento_consumo_percentual}
                onChange={(e) => handleParametroChange('aumento_consumo_percentual', e.target.value)}
                placeholder="0"
                step="0.1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Reservado para ajustes adicionais
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Atraso Cronograma (dias)
              </label>
              <Input
                type="number"
                value={parametros.atraso_cronograma_dias}
                onChange={(e) => handleParametroChange('atraso_cronograma_dias', e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">
                Impacto aproximado: {(parametros.atraso_cronograma_dias * (dre_atual?.receita_faturada || 0) * 0.001).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={() => simular.mutate()}
              disabled={simular.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <Zap className="w-4 h-4" />
              Simular Cenário
            </Button>
            <Button
              onClick={resetar}
              variant="outline"
              className="flex-1"
            >
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultado */}
      {mostrarDetalhe && resultado && (
        <Card className={impactoTotal < 0 ? 'border-l-4 border-red-500' : 'border-l-4 border-green-500'}>
          <CardHeader>
            <CardTitle className={impactoTotal < 0 ? 'text-red-600' : 'text-green-600'}>
              Resultado da Simulação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Alertas críticos */}
            {resultado.cenarios_criticos && resultado.cenarios_criticos.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <h3 className="font-semibold text-red-800">Cenários Críticos</h3>
                </div>
                <ul className="space-y-1 text-sm text-red-700">
                  {resultado.cenarios_criticos.map((cenario, idx) => (
                    <li key={idx}>• {cenario}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Comparação: Atual vs Simulado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-3">Cenário Atual</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Receita:</span>
                    <span className="font-bold text-blue-600">
                      {(cenarioAtual?.receita || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Custo:</span>
                    <span className="font-bold text-red-600">
                      {(cenarioAtual?.custo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-600 font-semibold">Lucro:</span>
                    <span className="font-bold text-green-600">
                      {(cenarioAtual?.lucro || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-semibold">Margem:</span>
                    <span className="font-bold text-green-600">
                      {(cenarioAtual?.margem || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-lg">
                <h3 className="font-semibold text-amber-900 mb-3">Cenário Simulado</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Receita:</span>
                    <span className="font-bold text-blue-600">
                      {(cenarioSimulado?.receita_faturada || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Custo:</span>
                    <span className="font-bold text-red-600">
                      {(cenarioSimulado?.custo_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-600 font-semibold">Lucro:</span>
                    <span className={`font-bold ${cenarioSimulado?.lucro_bruto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(cenarioSimulado?.lucro_bruto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-semibold">Margem:</span>
                    <span className={`font-bold ${cenarioSimulado?.margem_percentual >= 5 ? 'text-green-600' : 'text-red-600'}`}>
                      {(cenarioSimulado?.margem_percentual || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Impactos */}
            <div className="p-4 bg-gray-50 rounded-lg border-l-4 border-gray-300">
              <h3 className="font-semibold mb-3">Impactos Financeiros</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Material:</span>
                  <span className={`font-bold ${resultado.impactos.material > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {resultado.impactos.material > 0 ? '+' : ''}
                    {resultado.impactos.material.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Mão de obra:</span>
                  <span className={`font-bold ${resultado.impactos.mao_obra > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {resultado.impactos.mao_obra > 0 ? '+' : ''}
                    {resultado.impactos.mao_obra.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Atraso cronograma:</span>
                  <span className={`font-bold ${resultado.impactos.atraso_cronograma > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {resultado.impactos.atraso_cronograma > 0 ? '+' : ''}
                    {resultado.impactos.atraso_cronograma.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 font-bold">
                  <span>IMPACTO TOTAL NO LUCRO</span>
                  <span className={impactoTotal > 0 ? 'text-red-600 text-lg' : 'text-green-600 text-lg'}>
                    {impactoTotal > 0 ? '+' : ''}
                    {impactoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Variação percentual</span>
                  <span className={impactoPercentual > 0 ? 'text-red-600 text-lg' : 'text-green-600 text-lg'}>
                    {impactoPercentual > 0 ? '+' : ''}{impactoPercentual.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
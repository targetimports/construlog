import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Fuel, TrendingUp, TrendingDown, Brain, DollarSign } from 'lucide-react';

export default function MediaCombustivelIA() {
  const { data: abastecimentos = [] } = useQuery({
    queryKey: ['abastecimentos'],
    queryFn: () => base44.entities.Abastecimento.list('-data', 300)
  });

  const { data: veiculos = [] } = useQuery({
    queryKey: ['veiculos'],
    queryFn: () => base44.entities.Veiculo.list()
  });

  const { data: viagens = [] } = useQuery({
    queryKey: ['viagens'],
    queryFn: () => base44.entities.Viagem.list('-data_saida', 200)
  });

  // Calcular médias gerais
  const totalLitros = abastecimentos.reduce((acc, a) => acc + (a.litros || 0), 0);
  const totalGasto = abastecimentos.reduce((acc, a) => acc + (a.valor_total || 0), 0);
  const mediaPrecoLitro = totalLitros > 0 ? totalGasto / totalLitros : 0;

  // Calcular média por veículo
  const mediasPorVeiculo = veiculos.map(veiculo => {
    const abastecimentosVeiculo = abastecimentos.filter(a => a.veiculo_id === veiculo.id);
    const viagensVeiculo = viagens.filter(v => v.veiculo_id === veiculo.id && v.combustivel_gasto > 0);
    
    const litrosVeiculo = abastecimentosVeiculo.reduce((acc, a) => acc + (a.litros || 0), 0);
    const gastoVeiculo = abastecimentosVeiculo.reduce((acc, a) => acc + (a.valor_total || 0), 0);
    const kmPercorrido = viagensVeiculo.reduce((acc, v) => acc + (v.km_percorrido || 0), 0);
    const combustivelGasto = viagensVeiculo.reduce((acc, v) => acc + (v.combustivel_gasto || 0), 0);
    
    const consumoMedio = combustivelGasto > 0 ? kmPercorrido / combustivelGasto : 0;
    const mediaPorViagem = viagensVeiculo.length > 0 ? litrosVeiculo / viagensVeiculo.length : 0;
    
    return {
      veiculo,
      litros: litrosVeiculo,
      gasto: gastoVeiculo,
      viagens: viagensVeiculo.length,
      consumoMedio,
      mediaPorViagem,
      mediaPrecoLitro: litrosVeiculo > 0 ? gastoVeiculo / litrosVeiculo : 0
    };
  }).filter(m => m.litros > 0).sort((a, b) => b.gasto - a.gasto);

  // Últimos 30 dias
  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
  const abastecimentosRecentes = abastecimentos.filter(a => new Date(a.data) >= trintaDiasAtras);
  const gastoUltimos30Dias = abastecimentosRecentes.reduce((acc, a) => acc + (a.valor_total || 0), 0);

  // Comparação com período anterior
  const sesentaDiasAtras = new Date();
  sesentaDiasAtras.setDate(sesentaDiasAtras.getDate() - 60);
  const abastecimentosPeriodoAnterior = abastecimentos.filter(a => {
    const data = new Date(a.data);
    return data >= sesentaDiasAtras && data < trintaDiasAtras;
  });
  const gastoPeriodoAnterior = abastecimentosPeriodoAnterior.reduce((acc, a) => acc + (a.valor_total || 0), 0);
  
  const variacao = gastoPeriodoAnterior > 0 
    ? ((gastoUltimos30Dias - gastoPeriodoAnterior) / gastoPeriodoAnterior) * 100 
    : 0;

  return (
    <div className="space-y-4">
      {/* Card de Resumo Geral */}
      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Brain className="w-5 h-5" />
            Análise Inteligente de Combustível
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <Fuel className="w-4 h-4 text-blue-600" />
                <p className="text-xs text-blue-700">Média Preço/L</p>
              </div>
              <p className="text-2xl font-bold text-blue-900">
                R$ {mediaPrecoLitro.toFixed(2)}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-green-100">
              <div className="flex items-center gap-2 mb-2">
                <Fuel className="w-4 h-4 text-green-600" />
                <p className="text-xs text-green-700">Total Litros</p>
              </div>
              <p className="text-2xl font-bold text-green-900">
                {totalLitros.toFixed(0)} L
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-purple-600" />
                <p className="text-xs text-purple-700">Últimos 30 dias</p>
              </div>
              <p className="text-2xl font-bold text-purple-900">
                {gastoUltimos30Dias.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-orange-100">
              <div className="flex items-center gap-2 mb-2">
                {variacao > 0 ? (
                  <TrendingUp className="w-4 h-4 text-orange-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-green-600" />
                )}
                <p className="text-xs text-orange-700">Variação vs anterior</p>
              </div>
              <p className={`text-2xl font-bold ${variacao > 0 ? 'text-orange-900' : 'text-green-900'}`}>
                {variacao > 0 ? '+' : ''}{variacao.toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Médias por Veículo */}
      {mediasPorVeiculo.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-gray-900">Consumo por Veículo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mediasPorVeiculo.slice(0, 5).map((media, idx) => (
                <div key={media.veiculo.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700">
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{media.veiculo.placa}</h4>
                        <p className="text-xs text-gray-600">{media.veiculo.marca} {media.veiculo.modelo}</p>
                      </div>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">
                      {media.viagens} viagens
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-xs text-gray-600">Consumo Médio</p>
                      <p className="font-semibold text-gray-900">
                        {media.consumoMedio > 0 ? `${media.consumoMedio.toFixed(2)} km/L` : 'N/A'}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-xs text-gray-600">Média/Viagem</p>
                      <p className="font-semibold text-gray-900">
                        {media.mediaPorViagem.toFixed(0)} L
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-xs text-gray-600">Total Litros</p>
                      <p className="font-semibold text-gray-900">
                        {media.litros.toFixed(0)} L
                      </p>
                    </div>
                    <div className="bg-green-50 rounded p-2">
                      <p className="text-xs text-green-700">Total Gasto</p>
                      <p className="font-semibold text-green-900">
                        {media.gasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, MapPin } from 'lucide-react';

export default function SimuladorRota({ veiculos, obras }) {
  const [formData, setFormData] = useState({
    veiculo_id: '',
    distancia_km: '',
    pedagios: '',
    consumo_medio: '8',
    preco_combustivel: '6.50'
  });

  const [resultado, setResultado] = useState(null);

  const calcularCusto = () => {
    const distancia = parseFloat(formData.distancia_km) || 0;
    const pedagios = parseFloat(formData.pedagios) || 0;
    const consumo = parseFloat(formData.consumo_medio) || 8;
    const precoCombustivel = parseFloat(formData.preco_combustivel) || 6.50;

    const litrosNecessarios = distancia / consumo;
    const custoCombustivel = litrosNecessarios * precoCombustivel;
    const custoTotal = custoCombustivel + pedagios;

    // Estimativa de tempo (considerando média de 60 km/h)
    const tempoEstimado = distancia / 60;

    setResultado({
      litros: litrosNecessarios.toFixed(2),
      custoCombustivel: custoCombustivel.toFixed(2),
      custoTotal: custoTotal.toFixed(2),
      custoKm: (custoTotal / distancia).toFixed(2),
      tempoEstimado: tempoEstimado.toFixed(1)
    });
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Calculator className="w-5 h-5 text-amber-500" />
          Simulador de Custo de Rota
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-gray-400">Veículo</Label>
          <Select value={formData.veiculo_id} onValueChange={(v) => setFormData({ ...formData, veiculo_id: v })}>
            <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {veiculos.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.placa} - {v.modelo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-400">Distância (KM)</Label>
            <Input
              type="number"
              value={formData.distancia_km}
              onChange={(e) => setFormData({ ...formData, distancia_km: e.target.value })}
              className="mt-1.5 bg-gray-800 border-gray-700 text-white"
            />
          </div>
          <div>
            <Label className="text-gray-400">Pedágios (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.pedagios}
              onChange={(e) => setFormData({ ...formData, pedagios: e.target.value })}
              className="mt-1.5 bg-gray-800 border-gray-700 text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-400">Consumo (km/l)</Label>
            <Input
              type="number"
              step="0.1"
              value={formData.consumo_medio}
              onChange={(e) => setFormData({ ...formData, consumo_medio: e.target.value })}
              className="mt-1.5 bg-gray-800 border-gray-700 text-white"
            />
          </div>
          <div>
            <Label className="text-gray-400">Preço Combustível (R$/l)</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.preco_combustivel}
              onChange={(e) => setFormData({ ...formData, preco_combustivel: e.target.value })}
              className="mt-1.5 bg-gray-800 border-gray-700 text-white"
            />
          </div>
        </div>

        <Button 
          onClick={calcularCusto}
          className="w-full bg-amber-500 hover:bg-amber-600 text-gray-900"
        >
          <Calculator className="w-4 h-4 mr-2" />
          Calcular Custo
        </Button>

        {resultado && (
          <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Litros Necessários</span>
              <span className="text-white font-medium">{resultado.litros} L</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Custo Combustível</span>
              <span className="text-white font-medium">R$ {resultado.custoCombustivel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Tempo Estimado</span>
              <span className="text-white font-medium">{resultado.tempoEstimado}h</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-gray-700">
              <span className="text-amber-400 font-semibold">Custo Total</span>
              <span className="text-amber-400 font-bold text-xl">R$ {resultado.custoTotal}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">Custo por KM</span>
              <span className="text-gray-300 text-sm">R$ {resultado.custoKm}/km</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
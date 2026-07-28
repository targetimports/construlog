import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Etapa2Cronograma({ dadosImport, setDadosImport }) {
  const temCronograma = dadosImport.dataInicio && dadosImport.dataFim;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Etapa 2: Cronograma (Opcional)</CardTitle>
        <p className="text-sm text-gray-600 mt-2">Se a planilha tiver cronograma físico-financeiro, importe aqui. Caso contrário, pule esta etapa.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {temCronograma && (
          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-900">Cronograma informado</p>
              <p className="text-xs text-green-800 mt-1">As datas serão salvas com a obra e poderão ser editadas depois</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Data de Início</label>
            <Input
              type="date"
              value={dadosImport.dataInicio}
              onChange={(e) => setDadosImport({ ...dadosImport, dataInicio: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Data de Término (prevista)</label>
            <Input
              type="date"
              value={dadosImport.dataFim}
              onChange={(e) => setDadosImport({ ...dadosImport, dataFim: e.target.value })}
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-semibold text-sm mb-3">Distribuição Física-Financeira</h3>
          <div className="text-sm text-gray-600 space-y-2">
            <p>Se sua planilha contém cronograma:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Datas de início e término</li>
              <li>Fases ou etapas de execução</li>
              <li>Distribuição mensal do orçamento</li>
            </ul>
            <p className="mt-3 text-gray-500 text-xs">Estes dados serão importados e poderão ser visualizados no módulo de Gantt Chart da obra.</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-900">Etapa Opcional</p>
            <p className="text-xs text-blue-800 mt-1">Você pode avançar sem preencher esta etapa. O cronograma pode ser adicionado depois.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
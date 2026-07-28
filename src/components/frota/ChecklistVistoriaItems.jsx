import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Minus } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'OK', label: 'OK', color: 'bg-green-900/30 text-green-400', icon: CheckCircle },
  { value: 'PROBLEMA', label: 'Problema', color: 'bg-red-900/30 text-red-400', icon: AlertCircle },
  { value: 'NA', label: 'N/A', color: 'bg-gray-900/30 text-gray-400', icon: Minus }
];

export default function ChecklistVistoriaItems({ itens, onChange }) {
  const handleStatusChange = (index, status) => {
    const novoItens = [...itens];
    novoItens[index].status = status;
    onChange(novoItens);
  };

  const handleObservacaoChange = (index, obs) => {
    const novoItens = [...itens];
    novoItens[index].observacao = obs;
    onChange(novoItens);
  };

  const temProblemas = itens.some((i) => i.status === 'PROBLEMA');

  return (
    <Card className={`border-gray-700 ${temProblemas ? 'bg-red-900/10' : 'bg-gray-800'}`}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {temProblemas && (
            <div className="bg-red-900/20 border border-red-700/30 rounded p-3 text-sm text-red-300">
              Atenção: Existem itens com problemas registrados. Foto documentada?
            </div>
          )}

          <div className="space-y-3">
            {itens.map((item, idx) => {
              const statusOption = STATUS_OPTIONS.find((s) => s.value === item.status);
              const Icon = statusOption?.icon || CheckCircle;

              return (
                <div
                  key={idx}
                  className="border border-gray-700 rounded-lg p-4 space-y-2 bg-gray-700/20"
                >
                  {/* Nome + Status */}
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-200 flex-1">
                      {item.item_nome}
                    </span>
                    <Select
                      value={item.status || 'OK'}
                      onValueChange={(val) => handleStatusChange(idx, val)}
                    >
                      <SelectTrigger className="w-32 bg-gray-700 border-gray-600 text-white text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Observação */}
                  <Input
                    value={item.observacao || ''}
                    onChange={(e) => handleObservacaoChange(idx, e.target.value)}
                    placeholder="Detalhe do problema (se houver)"
                    className="bg-gray-600 border-gray-500 text-white text-sm"
                  />
                </div>
              );
            })}
          </div>

          {/* Resumo */}
          <div className="mt-6 p-3 bg-gray-700/20 rounded flex gap-4 text-xs">
            <Badge className="bg-green-900/30 text-green-400 border-0 gap-1">
              <CheckCircle className="w-3 h-3" />
              {itens.filter((i) => i.status === 'OK').length} OK
            </Badge>
            <Badge className="bg-red-900/30 text-red-400 border-0 gap-1">
              <AlertCircle className="w-3 h-3" />
              {itens.filter((i) => i.status === 'PROBLEMA').length} Problemas
            </Badge>
            <Badge className="bg-gray-900/30 text-gray-400 border-0 gap-1">
              <Minus className="w-3 h-3" />
              {itens.filter((i) => i.status === 'NA').length} N/A
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
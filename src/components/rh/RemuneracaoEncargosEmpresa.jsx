import React, { useEffect, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { parseBRL } from '@/components/shared/moneyBR';
import { calcResumo } from './calcRemuneracao';

export default function RemuneracaoEncargosEmpresa({ formData, setFormData, canEdit, paramsRH }) {
  const remuneracao = formData.remuneracao || {};

  const handleChange = (field, value) => {
    const numValue = typeof value === 'string' && value !== '' ? parseBRL(value) : value;
    
    setFormData({
      ...formData,
      remuneracao: {
        ...remuneracao,
        [field]: numValue
      }
    });
  };

  // Calcular valores automaticamente quando salário base muda
  const resumo = useMemo(() => {
    return calcResumo(remuneracao, paramsRH || {});
  }, [remuneracao, paramsRH]);

  // NÃO atualizar automaticamente se usuário editou manualmente
  // Apenas calcular para exibição no resumo

  return (
    <div className="space-y-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
        <span className="text-blue-600"></span>
        Encargos da Empresa
      </h4>
      <p className="text-sm text-gray-600">
        Custos patronais que a empresa deve arcar (não saem do bolso do funcionário)
      </p>

      {/* FGTS */}
      <div className="space-y-3 border-t border-blue-200 pt-4">
        <h5 className="text-sm font-semibold text-gray-800">FGTS (Fundo de Garantia)</h5>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-gray-600">Tipo</Label>
            <Select value={remuneracao.fgts_tipo || 'percentual'} onValueChange={(value) => handleChange('fgts_tipo', value)} disabled={!canEdit}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentual">Percentual (%)</SelectItem>
                <SelectItem value="valor_fixo">Valor Fixo (R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {remuneracao.fgts_tipo === 'percentual' ? (
            <div>
              <Label className="text-xs text-gray-600">Percentual (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={remuneracao.fgts_percentual || 8}
                onChange={(e) => handleChange('fgts_percentual', e.target.value)}
                disabled={!canEdit}
                className="text-sm"
              />
            </div>
          ) : (
            <div>
              <Label className="text-xs text-gray-600">Valor Fixo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={remuneracao.fgts_valor_fixo || 0}
                onChange={(e) => handleChange('fgts_valor_fixo', e.target.value)}
                disabled={!canEdit}
                className="text-sm"
              />
            </div>
          )}
        </div>

        <div className="bg-white rounded p-3 border border-blue-100 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">FGTS Calculado:</span>
            <span className="text-sm font-semibold text-blue-600">
              R$ {resumo.fgtsCalc.toFixed(2)}
            </span>
          </div>
          {canEdit && (
            <div>
              <Label className="text-xs text-gray-500">Editar manualmente (override):</Label>
              <Input
                type="number"
                step="0.01"
                value={remuneracao.fgts_calculado || resumo.fgtsCalc}
                onChange={(e) => handleChange('fgts_calculado', e.target.value)}
                className="text-sm h-9"
                placeholder={`Auto: ${resumo.fgtsCalc.toFixed(2)}`}
              />
            </div>
          )}
        </div>
      </div>

      {/* INSS PATRONAL */}
      <div className="space-y-3 border-t border-blue-200 pt-4">
        <h5 className="text-sm font-semibold text-gray-800">INSS Patronal</h5>
        <p className="text-xs text-gray-500">Contribuição da empresa ao INSS</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-gray-600">Tipo</Label>
            <Select value={remuneracao.inss_patronal_tipo || 'percentual'} onValueChange={(value) => handleChange('inss_patronal_tipo', value)} disabled={!canEdit}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentual">Percentual (%)</SelectItem>
                <SelectItem value="valor_fixo">Valor Fixo (R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {remuneracao.inss_patronal_tipo === 'percentual' ? (
            <div>
              <Label className="text-xs text-gray-600">Percentual (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={remuneracao.inss_patronal_percentual || 20}
                onChange={(e) => handleChange('inss_patronal_percentual', e.target.value)}
                disabled={!canEdit}
                className="text-sm"
              />
            </div>
          ) : (
            <div>
              <Label className="text-xs text-gray-600">Valor Fixo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={remuneracao.inss_patronal_valor_fixo || 0}
                onChange={(e) => handleChange('inss_patronal_valor_fixo', e.target.value)}
                disabled={!canEdit}
                className="text-sm"
              />
            </div>
          )}
        </div>

        <div className="bg-white rounded p-3 border border-blue-100 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">INSS Patronal Calculado:</span>
            <span className="text-sm font-semibold text-blue-600">
              R$ {resumo.inssPatCalc.toFixed(2)}
            </span>
          </div>
          {canEdit && (
            <div>
              <Label className="text-xs text-gray-500">Editar manualmente (override):</Label>
              <Input
                type="number"
                step="0.01"
                value={remuneracao.inss_patronal_calculado || resumo.inssPatCalc}
                onChange={(e) => handleChange('inss_patronal_calculado', e.target.value)}
                className="text-sm h-9"
                placeholder={`Auto: ${resumo.inssPatCalc.toFixed(2)}`}
              />
            </div>
          )}
        </div>
      </div>

      {/* TOTAL ENCARGOS */}
      <div className="border-t border-blue-200 pt-4 bg-white rounded p-3 border border-blue-200">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-gray-800">Total de Encargos:</span>
          <span className="text-lg font-bold text-blue-600">
            R$ {resumo.encargosEmpresa.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
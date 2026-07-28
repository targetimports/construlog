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

export default function RemuneracaoDescontosFuncionario({ formData, setFormData, canEdit, paramsRH }) {
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

  // Calcular valores automaticamente
  const resumo = useMemo(() => {
    return calcResumo(remuneracao, paramsRH || {});
  }, [remuneracao, paramsRH]);

  // NÃO atualizar automaticamente se usuário editou manualmente
  // Apenas calcular para exibição no resumo

  return (
    <div className="space-y-6 bg-red-50 border border-red-200 rounded-lg p-4">
      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
        <span className="text-red-600"></span>
        Descontos do Funcionário
      </h4>
      <p className="text-sm text-gray-600">
        Valores retidos do salário do funcionário
      </p>

      {/* INSS EMPREGADO */}
      <div className="space-y-3 border-t border-red-200 pt-4">
        <h5 className="text-sm font-semibold text-gray-800">INSS do Empregado</h5>
        <p className="text-xs text-gray-500">Contribuição do funcionário ao INSS (descontado em folha)</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-gray-600">Tipo</Label>
            <Select value={remuneracao.inss_empregado_tipo || 'percentual'} onValueChange={(value) => handleChange('inss_empregado_tipo', value)} disabled={!canEdit}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentual">Percentual (%)</SelectItem>
                <SelectItem value="valor_fixo">Valor Fixo (R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {remuneracao.inss_empregado_tipo === 'percentual' ? (
            <div>
              <Label className="text-xs text-gray-600">Percentual (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={remuneracao.inss_empregado_percentual || 0}
                onChange={(e) => handleChange('inss_empregado_percentual', e.target.value)}
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
                value={remuneracao.inss_empregado_valor_fixo || 0}
                onChange={(e) => handleChange('inss_empregado_valor_fixo', e.target.value)}
                disabled={!canEdit}
                className="text-sm"
              />
            </div>
          )}
        </div>

        <div className="bg-white rounded p-3 border border-red-100 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">INSS Empregado Calculado:</span>
            <span className="text-sm font-semibold text-red-600">
              - R$ {resumo.inssEmpCalc.toFixed(2)}
            </span>
          </div>
          {canEdit && (
            <div>
              <Label className="text-xs text-gray-500">Editar manualmente (override):</Label>
              <Input
                type="number"
                step="0.01"
                value={remuneracao.inss_empregado_calculado || resumo.inssEmpCalc}
                onChange={(e) => handleChange('inss_empregado_calculado', e.target.value)}
                className="text-sm h-9"
                placeholder={`Auto: ${resumo.inssEmpCalc.toFixed(2)}`}
              />
            </div>
          )}
        </div>
      </div>

      {/* IRRF */}
      <div className="space-y-3 border-t border-red-200 pt-4">
        <h5 className="text-sm font-semibold text-gray-800">IRRF (Imposto de Renda)</h5>
        <p className="text-xs text-gray-500">Imposto de Renda Retido na Fonte</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-gray-600">Tipo</Label>
            <Select value={remuneracao.irrf_tipo || 'valor_fixo'} onValueChange={(value) => handleChange('irrf_tipo', value)} disabled={!canEdit}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentual">Percentual (%)</SelectItem>
                <SelectItem value="valor_fixo">Valor Fixo (R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {remuneracao.irrf_tipo === 'percentual' ? (
            <div>
              <Label className="text-xs text-gray-600">Percentual (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={remuneracao.irrf_percentual || 0}
                onChange={(e) => handleChange('irrf_percentual', e.target.value)}
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
                value={remuneracao.irrf_valor_fixo || 0}
                onChange={(e) => handleChange('irrf_valor_fixo', e.target.value)}
                disabled={!canEdit}
                className="text-sm"
              />
            </div>
          )}
        </div>

        <div className="bg-white rounded p-3 border border-red-100 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">IRRF Calculado:</span>
            <span className="text-sm font-semibold text-red-600">
              - R$ {resumo.irrfCalc.toFixed(2)}
            </span>
          </div>
          {canEdit && (
            <div>
              <Label className="text-xs text-gray-500">Editar manualmente (override):</Label>
              <Input
                type="number"
                step="0.01"
                value={remuneracao.irrf_calculado || resumo.irrfCalc}
                onChange={(e) => handleChange('irrf_calculado', e.target.value)}
                className="text-sm h-9"
                placeholder={`Auto: ${resumo.irrfCalc.toFixed(2)}`}
              />
            </div>
          )}
        </div>
      </div>

      {/* OUTROS DESCONTOS */}
      <div className="space-y-3 border-t border-red-200 pt-4">
        <Label className="text-sm font-semibold text-gray-800">Outros Descontos (R$)</Label>
        <p className="text-xs text-gray-500">Faltas, adiantamentos, etc.</p>
        <Input
          type="number"
          step="0.01"
          value={remuneracao.outros_descontos || 0}
          onChange={(e) => handleChange('outros_descontos', e.target.value)}
          disabled={!canEdit}
          placeholder="0.00"
          className="text-sm"
        />
      </div>

      {/* TOTAL DESCONTOS */}
      <div className="border-t border-red-200 pt-4 bg-white rounded p-3 border border-red-200">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-gray-800">Total de Descontos:</span>
          <span className="text-lg font-bold text-red-600">
            - R$ {resumo.descontosFuncionario.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
import React, { useMemo } from 'react';
import { calcResumo } from './calcRemuneracao';
import { parseBRL } from '@/components/shared/moneyBR';

export default function RemuneracaoResumoMensal({ formData, paramsRH }) {
  // Calcular resumo EM TEMPO REAL a partir do formData
  const resumo = useMemo(() => {
    const rem = formData.remuneracao || {};
    return calcResumo(rem, paramsRH || {});
  }, [formData.remuneracao, paramsRH]);

  const salarioBruto = resumo.brutoFuncionario;
  const totalEncargos = resumo.encargosEmpresa;
  const totalDescontos = resumo.descontosFuncionario;
  const beneficios = resumo.beneficios;
  const extras = resumo.custosExtras;
  const custoTotal = resumo.custoTotalEmpresa;
  const salarioLiquido = resumo.liquido;

  return (
    <div className="space-y-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6 border border-gray-200">
      <h4 className="font-bold text-gray-900 text-lg">Resumo Mensal</h4>

      {/* SEÇÃO: PARA O FUNCIONÁRIO */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <h5 className="text-sm font-semibold text-gray-700 mb-3">Para o Funcionário</h5>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Salário Bruto:</span>
            <span className="font-semibold text-gray-900">R$ {salarioBruto.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pl-4 border-l-2 border-red-300">
            <span className="text-sm text-red-700">(-) Descontos:</span>
            <span className="font-semibold text-red-700">- R$ {totalDescontos.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center bg-green-50 p-2 rounded border border-green-200 mt-2">
            <span className="text-sm font-bold text-green-800">= Salário Líquido:</span>
            <span className="font-bold text-lg text-green-800">R$ {salarioLiquido.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* SEÇÃO: PARA A EMPRESA */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h5 className="text-sm font-semibold text-gray-700 mb-3">Para a Empresa (Custo Total)</h5>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Salário Bruto:</span>
            <span className="font-semibold text-gray-900">R$ {salarioBruto.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pl-4 border-l-2 border-blue-300">
            <span className="text-sm text-blue-700">(+) Encargos Empresa:</span>
            <span className="font-semibold text-blue-700">+ R$ {totalEncargos.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pl-4 border-l-2 border-purple-300">
            <span className="text-sm text-purple-700">(+) Benefícios/Extras:</span>
            <span className="font-semibold text-purple-700">+ R$ {(beneficios + extras).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center bg-blue-100 p-2 rounded border border-blue-300 mt-2">
            <span className="text-sm font-bold text-blue-900">= Custo Total Mensal:</span>
            <span className="font-bold text-lg text-blue-900">R$ {custoTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* BREAKDOWN: DETALHAMENTO */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-xs">
        <h6 className="font-semibold text-gray-700 mb-2">Detalhamento:</h6>
        <div className="grid grid-cols-2 gap-2 text-gray-600">
          <div>Base: R$ {salarioBruto.toFixed(2)}</div>
          <div>FGTS: R$ {resumo.fgtsCalc.toFixed(2)}</div>
          <div>INSS Pat: R$ {resumo.inssPatCalc.toFixed(2)}</div>
          <div>Ben/Ext: R$ {(beneficios + extras).toFixed(2)}</div>
          <div className="col-span-2 border-t border-gray-300 pt-2 mt-2">
            <strong>Descontos do Func:</strong> R$ {totalDescontos.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
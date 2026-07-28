import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Download, ArrowLeft, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function RelatorioImportacaoCompleto({ orcamentoId, onVolta }) {
  const { data: orcamento, isLoading } = useQuery({
    queryKey: ['orcamento', orcamentoId],
    queryFn: () => base44.entities.Orcamento.filter({ id: orcamentoId })
  });

  const { data: itens = [] } = useQuery({
    queryKey: ['items', orcamentoId],
    queryFn: () => base44.entities.ItemOrcamento.filter({ orcamento_id: orcamentoId })
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><p className="text-gray-600">Carregando relatório...</p></div>;
  }

  const orcData = orcamento?.[0];
  if (!orcData) return <div className="flex items-center justify-center py-12"><p className="text-gray-600">Orçamento não encontrado</p></div>;

  // Calcular estatísticas
  const totalItens = itens.length;
  const somaMateriais = itens
    .filter(i => i.categoria === 'materiais')
    .reduce((acc, i) => acc + (i.valor_total || 0), 0);
  
  const somaMaoObra = itens
    .filter(i => i.categoria === 'mao_obra')
    .reduce((acc, i) => acc + (i.valor_total || 0), 0);
  
  const somaEquipamentos = itens
    .filter(i => i.categoria === 'equipamentos')
    .reduce((acc, i) => acc + (i.valor_total || 0), 0);
  
  const somaTotal = itens.reduce((acc, i) => acc + (i.valor_total || 0), 0);

  // Agrupar por etapa
  const etapas = {};
  itens.forEach(item => {
    if (!etapas[item.etapa]) {
      etapas[item.etapa] = [];
    }
    etapas[item.etapa].push(item);
  });

  const handleDownloadPDF = () => {
    // TODO: implementar geração de PDF
    alert('PDF em desenvolvimento');
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <button
            onClick={onVolta}
            className="p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-4 sm:w-5 h-4 sm:h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{orcData.titulo || 'Orçamento Importado'}</h1>
            <p className="text-xs sm:text-sm text-gray-600">Relatório completo da importação</p>
          </div>
        </div>
        <Button onClick={handleDownloadPDF} className="gap-2 whitespace-nowrap flex-shrink-0 text-sm sm:text-base" size="sm" variant="default">
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Baixar PDF</span>
          <span className="sm:hidden">PDF</span>
        </Button>
      </div>

      {/* Resumo */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Resumo da Importação</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs text-blue-600 font-medium mb-1">Total de Itens</p>
            <p className="text-2xl sm:text-3xl font-bold text-blue-700">{totalItens}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs text-emerald-600 font-medium mb-1">Soma Total</p>
            <p className="text-lg sm:text-2xl font-bold text-emerald-700 truncate">
              {somaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs text-purple-600 font-medium mb-1">Etapas</p>
            <p className="text-2xl sm:text-3xl font-bold text-purple-700">{Object.keys(etapas).length}</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs text-orange-600 font-medium mb-1">Data Importação</p>
            <p className="text-xs sm:text-sm font-bold text-orange-700">
              {new Date(orcData.created_date).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      </div>

      {/* Distribuição por categoria */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Distribuição por Categoria</h2>
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg gap-2">
            <span className="text-xs sm:text-sm text-gray-700 font-medium">Materiais</span>
            <span className="text-gray-900 font-bold text-xs sm:text-base text-right">
              {somaMateriais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
          <div className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg gap-2">
            <span className="text-xs sm:text-sm text-gray-700 font-medium">Mão de Obra</span>
            <span className="text-gray-900 font-bold text-xs sm:text-base text-right">
              {somaMaoObra.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
          <div className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg gap-2">
            <span className="text-xs sm:text-sm text-gray-700 font-medium">Equipamentos</span>
            <span className="text-gray-900 font-bold text-xs sm:text-base text-right">
              {somaEquipamentos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>
      </div>

      {/* Itens por etapa */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 space-y-4 sm:space-y-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900">Itens por Etapa</h2>
        
        {Object.entries(etapas).map(([etapa, etapaItens]) => {
          const somaEtapa = etapaItens.reduce((acc, i) => acc + (i.valor_total || 0), 0);
          
          return (
            <div key={etapa} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-200">
                <div className="flex items-start sm:items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base flex-1 min-w-0">{etapa || 'Sem etapa'}</h3>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs sm:text-sm text-gray-600">{etapaItens.length} itens</p>
                    <p className="font-bold text-gray-900 text-xs sm:text-base">
                      {somaEtapa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto -mx-4 sm:-mx-6">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-2 sm:px-4 py-2 text-left font-medium text-gray-600">#</th>
                      <th className="px-2 sm:px-4 py-2 text-left font-medium text-gray-600">Descrição</th>
                      <th className="px-2 sm:px-4 py-2 text-right font-medium text-gray-600 whitespace-nowrap">Qtd</th>
                      <th className="px-2 sm:px-4 py-2 text-right font-medium text-gray-600 whitespace-nowrap hidden sm:table-cell">Unit.</th>
                      <th className="px-2 sm:px-4 py-2 text-right font-medium text-gray-600 whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {etapaItens.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-gray-600 font-medium text-center">{idx + 1}</td>
                        <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-gray-900 font-medium truncate max-w-xs text-xs sm:text-sm">
                          {item.descricao}
                        </td>
                        <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-right text-gray-600 text-xs sm:text-sm whitespace-nowrap">
                          {(item.quantidade || 0).toLocaleString('pt-BR')} {item.unidade}
                        </td>
                        <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-right text-gray-600 hidden sm:table-cell text-xs sm:text-sm whitespace-nowrap">
                          {(item.valor_unitario || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          })}
                        </td>
                        <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-right font-bold text-gray-900 text-xs sm:text-sm whitespace-nowrap">
                          {(item.valor_total || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rodapé */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-end items-start sm:items-center sticky bottom-0 bg-white border-t border-gray-200 p-4 sm:p-6 -mx-4 sm:-mx-6 sm:rounded-b-lg">
        <div className="text-right w-full sm:w-auto">
          <p className="text-xs sm:text-sm text-gray-600 mb-1">Total do Orçamento</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">
            {somaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>
    </div>
  );
}
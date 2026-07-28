import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import FiltrosDreObra from '../components/dre/FiltrosDreObra';
import TabelaDreBreakdown from '../components/dre/TabelaDreBreakdown';
import { KpiCardsSkeleton, TableSkeleton } from '@/components/shared/Skeletons';
import { exportarXLSXBranded } from '@/lib/xlsxBrand';
import { useEmpresaBranding } from '@/components/shared/useBranding';
import { fmtCompactBRL } from '@/lib/fmtCompact';

const fmtBRLCheio = (x) => `R$ ${(Number(x) || 0).toFixed(2).replace('.', ',')}`;

export default function DreObraPage({ embedded = false }) {
  const [filtros, setFiltros] = useState({ obra_id: null, de: null, ate: null });
  const [filtrosAtivos, setFiltrosAtivos] = useState(false);

  const { data: dreData, isLoading, error } = useQuery({
    queryKey: ['dreObra', filtros],
    queryFn: () => base44.functions.invoke('getDreObra', filtros),
    enabled: !!filtros.obra_id
  });

  // Lista de obras p/ resolver nome e empresa da obra selecionada (mesma queryKey do filtro).
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-list'],
    queryFn: () => base44.entities.Obra.list()
  });

  const obraSelecionada = obras.find((o) => o.id === filtros.obra_id);

  // Empresa/branding p/ o cabeçalho do Excel (empresa da obra selecionada; senão matriz).
  const { empresa, branding } = useEmpresaBranding(obraSelecionada?.empresa_id);

  const handleFiltrar = (novosFiltros) => {
    setFiltros(novosFiltros);
    setFiltrosAtivos(true);
  };

  const handleLimpar = () => {
    setFiltros({ obra_id: null, de: null, ate: null });
    setFiltrosAtivos(false);
  };

  const dre = dreData?.data;

  // Exporta EXCEL branded client-side com exatamente o que a tela mostra.
  const exportarExcel = () => {
    if (!dre) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const obraNome = obraSelecionada?.nome || '';
      const grupoLabel = (g) =>
        g === 'mao_obra' ? 'Mão de Obra' : String(g || '').charAt(0).toUpperCase() + String(g || '').slice(1);

      const linhasDre = [
        ['Receita Prevista', Number(dre.receita_prevista) || 0],
        ['Receita Realizada', Number(dre.receita_realizada) || 0],
        ['Total de Custos', Number(dre.custos?.total_custos) || 0],
        ['Margem Bruta', Number(dre.margem_bruta) || 0],
        ['Margem %', `${(Number(dre.margem_percentual) || 0).toFixed(2).replace('.', ',')}%`],
      ];
      if (dre.warnings && dre.warnings.length > 0) {
        linhasDre.push(['', '']);
        for (const w of dre.warnings) linhasDre.push(['Aviso', String(w)]);
      }

      exportarXLSXBranded(`dre_obra_${new Date().toISOString().split('T')[0]}`, [
        {
          nome: 'DRE',
          titulo: 'DRE da Obra',
          subtitulo: obraNome,
          headers: ['Indicador', 'Valor'],
          rows: linhasDre,
          moeda: [1],
          larguras: [24, 80],
        },
        {
          nome: 'Categorias',
          titulo: 'DRE da Obra — Custos por Categoria',
          subtitulo: obraNome,
          headers: ['Categoria', 'Grupo', 'Total'],
          rows: (dre.breakdown_por_categoria || []).map((b) => [
            b.categoria_nome || '',
            grupoLabel(b.grupo),
            Number(b.total) || 0,
          ]),
          moeda: [2],
        },
      ], { empresa, branding });
      toast.success('Excel exportado');
    } catch (e) {
      toast.error('Erro ao exportar: ' + (e?.message || 'tente novamente'));
    }
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">DRE por Obra</h1>
          <p className="text-gray-500 text-sm">Demonstração de Resultado do Exercício - Análise Financeira</p>
        </div>
      )}

      <FiltrosDreObra onFiltrarChange={handleFiltrar} onLimpar={handleLimpar} />

      {filtrosAtivos && isLoading && (
        <div className="space-y-6">
          <KpiCardsSkeleton count={5} />
          <TableSkeleton rows={6} cols={6} />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Erro ao carregar DRE</p>
            <p className="text-red-700 text-sm">{error.message}</p>
          </div>
        </div>
      )}

      {filtrosAtivos && dre && (
        <>
          {dre.warnings && dre.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800 font-semibold">Avisos:</p>
              {dre.warnings.map((w, idx) => (
                <p key={idx} className="text-sm text-yellow-700">• {w}</p>
              ))}
            </div>
          )}

          {/* Cards de Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500">Receita Prevista</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate tabular-nums mt-1" title={fmtBRLCheio(dre.receita_prevista)}>
                {fmtCompactBRL(dre.receita_prevista)}
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500">Receita Realizada</p>
              <p className="text-lg sm:text-2xl font-bold text-green-600 truncate tabular-nums mt-1" title={fmtBRLCheio(dre.receita_realizada)}>
                {fmtCompactBRL(dre.receita_realizada)}
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500">Total de Custos</p>
              <p className="text-lg sm:text-2xl font-bold text-red-600 truncate tabular-nums mt-1" title={fmtBRLCheio(dre.custos.total_custos)}>
                {fmtCompactBRL(dre.custos.total_custos)}
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500">Margem Bruta</p>
              <p className={`text-lg sm:text-2xl font-bold truncate tabular-nums mt-1 ${dre.margem_bruta >= 0 ? 'text-green-600' : 'text-red-600'}`} title={fmtBRLCheio(dre.margem_bruta)}>
                {fmtCompactBRL(dre.margem_bruta)}
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500">Margem %</p>
              <p className={`text-lg sm:text-2xl font-bold break-words tabular-nums mt-1 ${dre.margem_percentual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dre.margem_percentual.toFixed(2)}%
              </p>
            </div>
          </div>

          {/* Tabela de Custos por Grupo */}
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Custos por Grupo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                {Object.entries(dre.custos)
                  .filter(([key]) => key !== 'total_custos')
                  .map(([grupo, valor]) => (
                    <div key={grupo} className="border rounded-lg p-3 bg-gray-50">
                      <p className="text-xs text-gray-600 font-semibold uppercase mb-1">
                        {grupo === 'mao_obra' ? 'Mão de Obra' : grupo.charAt(0).toUpperCase() + grupo.slice(1)}
                      </p>
                      <p className="text-lg font-bold break-words tabular-nums">
                        R$ {valor.toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Breakdown por Categoria */}
          <TabelaDreBreakdown breakdown={dre.breakdown_por_categoria} />

          {/* Botão Exportar */}
          <div className="flex flex-col sm:flex-row sm:justify-end">
            <Button
              onClick={exportarExcel}
              className="gap-2 bg-green-600 hover:bg-green-700 w-full sm:w-auto"
            >
              <Download className="w-4 h-4" />
              Exportar Excel
            </Button>
          </div>
        </>
      )}

      {!filtrosAtivos && (
        <Card className="shadow-none">
          <CardContent className="pt-6 text-center text-gray-500">
            Selecione uma obra nos filtros acima para visualizar o DRE
          </CardContent>
        </Card>
      )}
    </div>
  );
}
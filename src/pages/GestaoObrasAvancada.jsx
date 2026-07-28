import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ObraKPIs from '../components/gestao-obras/ObraKPIs';
import ObraDespesasChart from '../components/gestao-obras/ObraDespesasChart';
import ObraAnaliseIA from '../components/gestao-obras/ObraAnaliseIA';
import OtimizadorCronogramaIA from '../components/gestao-obras/OtimizadorCronogramaIA';
import AnalisadorCustosObraIA from '../components/gestao-obras/AnalisadorCustosObraIA';
import GestorRiscosObra from '../components/gestao-obras/GestorRiscosObra';
import { KpiCardsSkeleton, TableSkeleton } from '@/components/shared/Skeletons';

export default function GestaoObrasAvancada() {
  const [obraIdSelecionada, setObraIdSelecionada] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [analise, setAnalise] = useState(null);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const obraSelecionada = obras.find(o => o.id === obraIdSelecionada);

  const handleGerarAnalise = async () => {
    if (!obraIdSelecionada) {
      toast.error('Selecione uma obra');
      return;
    }

    setCarregando(true);
    try {
      const resultado = await base44.functions.invoke('analisadorObraFinanceira', {
        obraId: obraIdSelecionada
      });
      setAnalise(resultado.data);
      toast.success('Análise gerada com sucesso!');
    } catch (erro) {
      toast.error('Erro ao gerar análise: ' + erro.message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Building2 className="w-8 h-8" />
          Gestão de Obras - Análise Inteligente
        </h1>
        <p className="text-gray-600 mt-1">Dashboard financeiro por obra com análises de IA</p>
      </div>

      {/* Seletor de Obra */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-semibold text-gray-700">Selecione a Obra</label>
              <select
                value={obraIdSelecionada}
                onChange={(e) => {
                  setObraIdSelecionada(e.target.value);
                  setAnalise(null);
                }}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">-- Escolha uma obra --</option>
                {obras.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.nome} ({o.status})
                  </option>
                ))}
              </select>
            </div>
            <Button 
              onClick={handleGerarAnalise}
              disabled={!obraIdSelecionada || carregando}
              className="gap-2"
            >
              {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
              Gerar Análise
            </Button>
          </div>
        </CardContent>
      </Card>

      {carregando && (
        <div className="space-y-6">
          <KpiCardsSkeleton count={4} />
          <TableSkeleton rows={6} cols={4} />
        </div>
      )}

      {analise && obraSelecionada && (
        <>
          {/* Header da Obra */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardContent className="p-6">
              <h2 className="text-2xl font-bold text-gray-900">{analise.obra.nome}</h2>
              <p className="text-gray-600 mt-1">Status: <strong>{analise.obra.status}</strong></p>
            </CardContent>
          </Card>

          {/* KPIs */}
          <ObraKPIs metricas={analise.metricas} />

          {/* Despesas por Categoria */}
          <ObraDespesasChart despesasPorCategoria={analise.despesasPorCategoria} />

          {/* Análise IA Detalhada */}
          <ObraAnaliseIA analise={analise.analise} />

          {/* Otimizador de Cronograma */}
          <OtimizadorCronogramaIA obraId={obraIdSelecionada} obraDados={analise.obra} />

          {/* Análise Preditiva de Custos */}
          <AnalisadorCustosObraIA obraId={obraIdSelecionada} obraDados={analise.obra} />

          {/* Gestor de Riscos Proativo */}
          <GestorRiscosObra obraId={obraIdSelecionada} />
        </>
      )}

      {!carregando && !analise && obraIdSelecionada && (
        <Card className="text-center p-8 text-gray-600">
          Clique em "Gerar Análise" para visualizar o dashboard completo da obra
        </Card>
      )}

      {!carregando && !obraIdSelecionada && (
        <Card className="text-center p-8 text-gray-600">
          Selecione uma obra para começar a análise
        </Card>
      )}
    </div>
  );
}
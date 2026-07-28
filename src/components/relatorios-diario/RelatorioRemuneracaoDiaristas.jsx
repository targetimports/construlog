import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function RelatorioRemuneracaoDiaristas({ obraId }) {
  const [dataInicio, setDataInicio] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
  const [resultado, setResultado] = useState(null);

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores-diaristas'],
    queryFn: async () => {
      const cols = await base44.entities.Colaborador?.filter?.({
        regime_trabalho: 'diarista'
      }) || [];
      return cols.filter(c => c.valor_remuneracao && c.valor_remuneracao > 0);
    }
  });

  const gerarMutation = useMutation({
    mutationFn: async () => {
      return base44.functions.invoke('gerarRelatorioRemuneracaoDiaristas', {
        obraId,
        dataInicio,
        dataFim,
        profissionaisIds: [] // Todos
      });
    },
    onSuccess: (data) => {
      setResultado(data.data);
      toast.success('Relatório gerado com sucesso');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const exportarExcel = () => {
    if (!resultado?.dados) return;

    let csv = 'Nome,Função,Valor Diária,Dias Trabalhados,Total\n';
    resultado.dados.forEach(d => {
      csv += `"${d.nome}","${d.funcao}","${d.valor_diaria.toFixed(2)}","${d.dias_trabalhados}","${d.total_a_pagar.toFixed(2)}"\n`;
    });
    csv += `\nTOTAL GERAL,,,,"${resultado.total_geral.toFixed(2)}"\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `remuneracao_diaristas_${dataInicio}_${dataFim}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Data Início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full p-2 border rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Data Fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full p-2 border rounded text-sm"
              />
            </div>
          </div>
          <Button
            onClick={() => gerarMutation.mutate()}
            disabled={gerarMutation.isPending}
            className="w-full gap-2"
          >
            {gerarMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>Gerar Relatório</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Resultado */}
      {resultado && (
        <div className="space-y-3">
          {/* Resumo */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-blue-50">
              <CardContent className="pt-4">
                <p className="text-xs text-gray-600">Profissionais</p>
                <p className="text-2xl font-bold">{resultado.profissionais}</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50">
              <CardContent className="pt-4">
                <p className="text-xs text-gray-600">Diários</p>
                <p className="text-2xl font-bold">{resultado.diarios_processados}</p>
              </CardContent>
            </Card>
            <Card className="bg-purple-50">
              <CardContent className="pt-4">
                <p className="text-xs text-gray-600">Total</p>
                <p className="text-xl font-bold text-purple-600">
                  R$ {(resultado.total_geral / 1000).toFixed(1)}k
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Detalhamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-2 text-left">Nome</th>
                      <th className="p-2 text-left">Função</th>
                      <th className="p-2 text-right">Diária</th>
                      <th className="p-2 text-right">Dias</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.dados.map((d, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="p-2">{d.nome}</td>
                        <td className="p-2">{d.funcao}</td>
                        <td className="p-2 text-right">R$ {d.valor_diaria.toFixed(2)}</td>
                        <td className="p-2 text-right font-semibold">{d.dias_trabalhados}</td>
                        <td className="p-2 text-right font-bold text-green-600">
                          R$ {d.total_a_pagar.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-100 font-bold">
                      <td colSpan="4" className="p-2 text-right">TOTAL:</td>
                      <td className="p-2 text-right text-lg text-green-600">
                        R$ {resultado.total_geral.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <Button
                onClick={exportarExcel}
                className="w-full gap-2 mt-4"
                variant="outline"
              >
                <Download className="w-4 h-4" />
                Exportar CSV
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
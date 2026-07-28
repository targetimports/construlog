import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, BarChart3, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { toast } from 'sonner';

import HistoricoMovimentacoes from '@/components/relatorios-estoque/HistoricoMovimentacoes';
import CurvaABC from '@/components/relatorios-estoque/CurvaABC';
import PrevisaoDemanda from '@/components/relatorios-estoque/PrevisaoDemanda';
import BaixaRotatividade from '@/components/relatorios-estoque/BaixaRotatividade';

export default function RelatoriosEstoqueAvancado() {
  const [tipoRelatorio, setTipoRelatorio] = useState('curva_abc');
  const [materialSelecionado, setMaterialSelecionado] = useState('');
  const [dias, setDias] = useState(90);

  const { data: materiais } = useQuery({
    queryKey: ['materiais-lista'],
    queryFn: () => base44.entities.Insumo.list().catch(() => [])
  });

  const { data: relatorioData, isLoading, refetch } = useQuery({
    queryKey: ['relatorio-estoque', tipoRelatorio, materialSelecionado, dias],
    queryFn: async () => {
      try {
        const { data } = await base44.functions.invoke('gerarRelatorioEstoqueAvancado', {
          tipo: tipoRelatorio,
          material_id: materialSelecionado,
          dias
        });
        return data;
      } catch (err) {
        toast.error('Erro ao gerar relatório: ' + err.message);
        return null;
      }
    },
    enabled: tipoRelatorio !== 'historico' && tipoRelatorio !== 'previsao_demanda' ? true : !!materialSelecionado
  });

  const handleGerarRelatorio = () => {
    refetch();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Relatórios Avançados de Estoque</h1>
        <p className="text-gray-600 mt-1">Análise detalhada de movimentações, curva ABC, previsão e rotatividade</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Relatório</Label>
              <Select value={tipoRelatorio} onValueChange={setTipoRelatorio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="curva_abc">Curva ABC</SelectItem>
                  <SelectItem value="historico">Histórico de Movimentações</SelectItem>
                  <SelectItem value="previsao_demanda">Previsão de Demanda</SelectItem>
                  <SelectItem value="baixa_rotatividade">Baixa Rotatividade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(tipoRelatorio === 'historico' || tipoRelatorio === 'previsao_demanda') && (
              <div className="space-y-2">
                <Label>Material</Label>
                <Select value={materialSelecionado} onValueChange={setMaterialSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materiais?.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {tipoRelatorio === 'historico' && (
              <div className="space-y-2">
                <Label>Últimos dias</Label>
                <Input
                  type="number"
                  value={dias}
                  onChange={(e) => setDias(parseInt(e.target.value))}
                  min="1"
                />
              </div>
            )}

            <div className="flex items-end">
              <Button 
                onClick={handleGerarRelatorio} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  'Gerar Relatório'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Relatórios */}
      <Tabs value={tipoRelatorio}>
        <TabsContent value="curva_abc" className="space-y-6">
          {isLoading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : relatorioData?.curva_abc ? (
            <CurvaABC dados={relatorioData.curva_abc} />
          ) : (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6 text-center text-blue-900">
                Clique em "Gerar Relatório" para visualizar a curva ABC dos materiais
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="historico" className="space-y-6">
          {isLoading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : relatorioData?.historico ? (
            <HistoricoMovimentacoes dados={relatorioData.historico} />
          ) : (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6 text-center text-blue-900">
                Selecione um material e clique em "Gerar Relatório"
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="previsao_demanda" className="space-y-6">
          {isLoading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : relatorioData?.previsao_demanda ? (
            <PrevisaoDemanda dados={relatorioData.previsao_demanda} />
          ) : (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6 text-center text-blue-900">
                Selecione um material para ver a previsão de demanda
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="baixa_rotatividade" className="space-y-6">
          {isLoading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : relatorioData?.baixa_rotatividade ? (
            <BaixaRotatividade dados={relatorioData.baixa_rotatividade} />
          ) : (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6 text-center text-blue-900">
                Clique em "Gerar Relatório" para visualizar materiais com baixa rotatividade
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
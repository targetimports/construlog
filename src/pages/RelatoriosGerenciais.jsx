import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, TrendingUp, TrendingDown, FileText, DollarSign } from 'lucide-react';
import DREPorObra from '../components/relatorios-gerenciais/DREPorObra';
import ComparativoPlanejadoReal from '../components/relatorios-gerenciais/ComparativoPlanejadoReal';
import FluxoCaixaProjetado from '../components/relatorios-gerenciais/FluxoCaixaProjetado';
import AlertasGerenciais from '../components/relatorios-gerenciais/AlertasGerenciais';

export default function RelatoriosGerenciais() {
  const [obraSelecionada, setObraSelecionada] = useState('todas');
  const [periodo, setPeriodo] = useState('mes_atual');

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-ativas'],
    queryFn: () => base44.entities.Obra.filter({ status: 'em_andamento' })
  });

  const { data: alertas = [] } = useQuery({
    queryKey: ['alertas-obras', obraSelecionada],
    queryFn: async () => {
      const todasObras = obraSelecionada === 'todas' ? obras : obras.filter(o => o.id === obraSelecionada);
      const alertasGerados = [];

      for (const obra of todasObras) {
        try {
          const response = await base44.functions.invoke('getDreObra', { obra_id: obra.id });
          const dre = response.data;

          // Alerta: Margem negativa
          if (dre?.margem_valor < 0) {
            alertasGerados.push({
              tipo: 'margem_negativa',
              obra: obra.nome,
              obra_id: obra.id,
              mensagem: `Margem negativa de ${dre.margem_valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
              severidade: 'alta'
            });
          }

          // Alerta: Margem baixa (< 10%)
          if (dre?.margem_percentual > 0 && dre?.margem_percentual < 10) {
            alertasGerados.push({
              tipo: 'margem_baixa',
              obra: obra.nome,
              obra_id: obra.id,
              mensagem: `Margem de ${dre.margem_percentual?.toFixed(2)}% está abaixo do ideal`,
              severidade: 'media'
            });
          }

          // Alerta: Custo acima do planejado
          if (obra.total_orcamento && dre?.custo_total > obra.total_orcamento * 1.1) {
            const desvio = ((dre.custo_total / obra.total_orcamento - 1) * 100).toFixed(1);
            alertasGerados.push({
              tipo: 'custo_alto',
              obra: obra.nome,
              obra_id: obra.id,
              mensagem: `Custo ${desvio}% acima do orçado`,
              severidade: 'alta'
            });
          }
        } catch (error) {
          console.error(`Erro ao verificar alertas da obra ${obra.nome}:`, error);
        }
      }

      return alertasGerados;
    },
    enabled: obras.length > 0
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Relatórios Gerenciais</h1>
          <p className="text-gray-600 mt-1">Análise completa de performance e indicadores</p>
        </div>
        <Button variant="outline">
          <FileText className="h-4 w-4 mr-2" />
          Exportar Relatório
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Obra</label>
              <Select value={obraSelecionada} onValueChange={setObraSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a obra" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Obras</SelectItem>
                  {obras.map(obra => (
                    <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Período</label>
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes_atual">Mês Atual</SelectItem>
                  <SelectItem value="trimestre">Trimestre</SelectItem>
                  <SelectItem value="ano">Ano Completo</SelectItem>
                  <SelectItem value="total">Total da Obra</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas Resumidos */}
      {alertas.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <AlertCircle className="h-5 w-5" />
              {alertas.length} Alerta{alertas.length > 1 ? 's' : ''} Detectado{alertas.length > 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alertas.slice(0, 3).map((alerta, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${
                    alerta.severidade === 'alta' ? 'bg-red-500' : 'bg-orange-500'
                  }`} />
                  <div>
                    <span className="font-medium">{alerta.obra}:</span> {alerta.mensagem}
                  </div>
                </div>
              ))}
              {alertas.length > 3 && (
                <p className="text-sm text-gray-600 mt-2">
                  + {alertas.length - 3} outros alertas. Veja na aba "Alertas".
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs de Relatórios */}
      <Tabs defaultValue="dre" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dre">DRE por Obra</TabsTrigger>
          <TabsTrigger value="comparativo">Planejado vs Real</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="alertas">
            Alertas
            {alertas.length > 0 && (
              <span className="ml-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                {alertas.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dre">
          <DREPorObra obraId={obraSelecionada} periodo={periodo} />
        </TabsContent>

        <TabsContent value="comparativo">
          <ComparativoPlanejadoReal obraId={obraSelecionada} periodo={periodo} />
        </TabsContent>

        <TabsContent value="fluxo">
          <FluxoCaixaProjetado obraId={obraSelecionada} periodo={periodo} />
        </TabsContent>

        <TabsContent value="alertas">
          <AlertasGerenciais alertas={alertas} obras={obras} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
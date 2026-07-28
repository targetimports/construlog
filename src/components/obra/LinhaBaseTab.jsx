import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import LinhaBaseOrcamentoForm from './LinhaBaseOrcamentoForm';
import LinhaBraseCronogramaForm from './LinhaBraseCronogramaForm';

export default function LinhaBaseTab({ obraId, empresa_id }) {
  const [modalOrcAberto, setModalOrcAberto] = useState(false);
  const [modalCronAberto, setModalCronAberto] = useState(false);
  const [itemEditandoOrc, setItemEditandoOrc] = useState(null);
  const [itemEditandoCron, setItemEditandoCron] = useState(null);
  const queryClient = useQueryClient();

  // ORCAMENTO SINTÉTICO
  const { data: orcItens, isLoading: loadingOrc } = useQuery({
    queryKey: ['orcamento-sintetico-obra', obraId],
    queryFn: async () => {
      try {
        const result = await base44.entities.OrcamentoSinteticoObra.filter({
          obra_id: obraId,
          ativo: true
        });
        return result.sort((a, b) => (a.item_numero || 0) - (b.item_numero || 0));
      } catch (err) {
        console.warn('Erro ao buscar orçamento sintético:', err);
        return [];
      }
    },
    staleTime: 300000
  });

  // CRONOGRAMA SIMPLES
  const { data: cronItens, isLoading: loadingCron } = useQuery({
    queryKey: ['cronograma-obra-simples', obraId],
    queryFn: async () => {
      try {
        const result = await base44.entities.CronogramaObraSimples.filter({
          obra_id: obraId,
          ativo: true
        });
        return result.sort((a, b) => (a.item_numero || 0) - (b.item_numero || 0));
      } catch (err) {
        console.warn('Erro ao buscar cronograma:', err);
        return [];
      }
    },
    staleTime: 300000
  });

  // CRIAR/ATUALIZAR ITEM ORÇAMENTO
  const mutationOrc = useMutation({
    mutationFn: async (data) => {
      if (data.id) {
        return await base44.entities.OrcamentoSinteticoObra.update(data.id, data);
      } else {
        return await base44.entities.OrcamentoSinteticoObra.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamento-sintetico-obra', obraId] });
      setModalOrcAberto(false);
      setItemEditandoOrc(null);
      toast.success(itemEditandoOrc ? 'Item atualizado' : 'Item criado');
    },
    onError: (err) => {
      toast.error('Erro ao salvar item: ' + err.message);
    }
  });

  // DELETAR ITEM ORÇAMENTO
  const deleteMutationOrc = useMutation({
    mutationFn: async (id) => {
      return await base44.entities.OrcamentoSinteticoObra.update(id, { ativo: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamento-sintetico-obra', obraId] });
      toast.success('Item removido');
    },
    onError: (err) => {
      toast.error('Erro ao deletar: ' + err.message);
    }
  });

  // CRIAR/ATUALIZAR CRONOGRAMA
  const mutationCron = useMutation({
    mutationFn: async (data) => {
      if (data.id) {
        return await base44.entities.CronogramaObraSimples.update(data.id, data);
      } else {
        return await base44.entities.CronogramaObraSimples.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronograma-obra-simples', obraId] });
      setModalCronAberto(false);
      setItemEditandoCron(null);
      toast.success(itemEditandoCron ? 'Atividade atualizada' : 'Atividade criada');
    },
    onError: (err) => {
      toast.error('Erro ao salvar: ' + err.message);
    }
  });

  // DELETAR CRONOGRAMA
  const deleteMutationCron = useMutation({
    mutationFn: async (id) => {
      return await base44.entities.CronogramaObraSimples.update(id, { ativo: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronograma-obra-simples', obraId] });
      toast.success('Atividade removida');
    },
    onError: (err) => {
      toast.error('Erro ao deletar: ' + err.message);
    }
  });

  // RESUMO DO ORÇAMENTO
  const totalOrc = (orcItens || []).reduce((sum, item) => sum + (item.valor_total_previsto || 0), 0);
  const totalMedido = (orcItens || []).reduce((sum, item) => sum + (item.valor_medido_acumulado || 0), 0);
  const percentualFisico = totalOrc > 0 ? ((totalMedido / totalOrc) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      {/* RESUMO GERAL */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600">Valor Previsto</div>
            <div className="text-2xl font-bold text-gray-900">
              {totalOrc.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600">Valor Medido</div>
            <div className="text-2xl font-bold text-blue-600">
              {totalMedido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600">% Físico</div>
            <div className="text-2xl font-bold text-green-600">{percentualFisico}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600">Saldo a Medir</div>
            <div className="text-2xl font-bold text-orange-600">
              {(totalOrc - totalMedido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ABAS */}
      <Tabs defaultValue="orcamento" className="w-full">
        <TabsList>
          <TabsTrigger value="orcamento">Orçamento Sintético ({(orcItens || []).length})</TabsTrigger>
          <TabsTrigger value="cronograma">Cronograma Simples ({(cronItens || []).length})</TabsTrigger>
        </TabsList>

        {/* ORÇAMENTO SINTÉTICO */}
        <TabsContent value="orcamento" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setItemEditandoOrc(null);
                setModalOrcAberto(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Item
            </Button>
          </div>

          {loadingOrc ? (
            <div className="animate-pulse space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : !orcItens || orcItens.length === 0 ? (
            <div className="flex items-center gap-2 p-8 bg-gray-50 rounded-lg text-gray-600">
              <AlertCircle className="w-5 h-5" />
              <span>Nenhum item de orçamento. Clique em "Novo Item" para começar.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr className="text-left text-gray-700 font-semibold">
                    <th className="p-3">Item</th>
                    <th className="p-3">Descrição</th>
                    <th className="p-3">Und.</th>
                    <th className="p-3 text-right">Qtd. Prevista</th>
                    <th className="p-3 text-right">Valor Unit.</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-center">% Exec.</th>
                    <th className="p-3 text-right">Medido</th>
                    <th className="p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {orcItens.map((item, idx) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3">{item.item_numero}</td>
                      <td className="p-3">{item.descricao}</td>
                      <td className="p-3">{item.unidade}</td>
                      <td className="p-3 text-right">{item.quantidade_prevista}</td>
                      <td className="p-3 text-right">
                        {item.valor_unitario_previsto?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="p-3 text-right font-semibold">
                        {item.valor_total_previsto?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="p-3 text-center">
                        <Badge className="bg-blue-100 text-blue-800">
                          {(item.percentual_executado_acumulado || 0).toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        {item.valor_medido_acumulado?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setItemEditandoOrc(item);
                              setModalOrcAberto(true);
                            }}
                            className="text-xs"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteMutationOrc.mutate(item.id)}
                            className="text-xs text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* CRONOGRAMA SIMPLES */}
        <TabsContent value="cronograma" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setItemEditandoCron(null);
                setModalCronAberto(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Atividade
            </Button>
          </div>

          {loadingCron ? (
            <div className="animate-pulse space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : !cronItens || cronItens.length === 0 ? (
            <div className="flex items-center gap-2 p-8 bg-gray-50 rounded-lg text-gray-600">
              <AlertCircle className="w-5 h-5" />
              <span>Nenhuma atividade no cronograma. Clique em "Nova Atividade" para começar.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr className="text-left text-gray-700 font-semibold">
                    <th className="p-3">Ativ.</th>
                    <th className="p-3">Descrição</th>
                    <th className="p-3">Início</th>
                    <th className="p-3">Fim</th>
                    <th className="p-3 text-right">Duração (dias)</th>
                    <th className="p-3">Responsável</th>
                    <th className="p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {cronItens.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3">{item.item_numero}</td>
                      <td className="p-3">{item.descricao}</td>
                      <td className="p-3 text-xs">
                        {new Date(item.data_inicio).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-3 text-xs">
                        {new Date(item.data_fim).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-3 text-right">{item.duracao_dias}</td>
                      <td className="p-3 text-xs">{item.responsavel || '-'}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setItemEditandoCron(item);
                              setModalCronAberto(true);
                            }}
                            className="text-xs"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteMutationCron.mutate(item.id)}
                            className="text-xs text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* MODAIS */}
      <LinhaBaseOrcamentoForm
        open={modalOrcAberto}
        item={itemEditandoOrc}
        obraId={obraId}
        empresa_id={empresa_id}
        onClose={() => {
          setModalOrcAberto(false);
          setItemEditandoOrc(null);
        }}
        onSave={(data) => mutationOrc.mutate(data)}
        isLoading={mutationOrc.isPending}
      />

      <LinhaBraseCronogramaForm
        open={modalCronAberto}
        item={itemEditandoCron}
        obraId={obraId}
        empresa_id={empresa_id}
        onClose={() => {
          setModalCronAberto(false);
          setItemEditandoCron(null);
        }}
        onSave={(data) => mutationCron.mutate(data)}
        isLoading={mutationCron.isPending}
      />
    </div>
  );
}
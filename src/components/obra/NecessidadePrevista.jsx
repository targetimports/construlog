import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Package, Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function NecessidadePrevista({ obraId }) {
  const queryClient = useQueryClient();
  const [selecionados, setSelecionados] = useState(new Set());

  // Buscar demandas da obra
  const { data: demandas = [] } = useQuery({
    queryKey: ['demandas-obra', obraId],
    queryFn: () => base44.entities.DemandaEstoqueObra.filter({ obra_id: obraId }),
    enabled: !!obraId
  });

  // Buscar insumos para preencher detalhes
  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos'],
    queryFn: () => base44.entities.Insumo.list('-preco_unitario', 1000)
  });

  // Criar requisição a partir de demandas selecionadas
  const criarRequisicaoMutation = useMutation({
    mutationFn: async () => {
      if (selecionados.size === 0) {
        throw new Error('Selecione pelo menos um material');
      }

      const demandasSelecionadas = demandas.filter(d => selecionados.has(d.id));
      
      // Criar RequisicaoCompra
      const requisicao = await base44.entities.RequisicaoCompra.create({
        obra_id: obraId,
        status: 'rascunho',
        descricao_resumo: `Requisição de ${demandasSelecionadas.length} itens planejados`,
        qtd_itens: demandasSelecionadas.length,
        valor_total_estimado: demandasSelecionadas.reduce((sum, d) => {
          const insumo = insumos.find(i => i.id === d.insumo_id);
          return sum + (d.quantidade_prevista * (insumo?.preco_unitario || 0));
        }, 0),
        solicitante: 'Sistema',
        data_necessidade: new Date().toISOString().split('T')[0]
      });

      // Criar itens da requisição
      for (const demanda of demandasSelecionadas) {
        const insumo = insumos.find(i => i.id === demanda.insumo_id);
        await base44.entities.RequisicaoCompra.create({
          requisicao_id: requisicao.id,
          insumo_id: demanda.insumo_id,
          quantidade: demanda.quantidade_prevista,
          unidade: demanda.unidade,
          preco_unitario: insumo?.preco_unitario || 0,
          subtotal: demanda.quantidade_prevista * (insumo?.preco_unitario || 0)
        });
      }

      return requisicao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['requisicoes-obra', obraId]);
      toast.success('Requisição criada com sucesso!');
      setSelecionados(new Set());
    }
  });

  if (demandas.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600">Nenhum material planejado para esta obra</p>
      </div>
    );
  }

  const totalPrevisto = demandas.reduce((sum, d) => {
    const insumo = insumos.find(i => i.id === d.insumo_id);
    return sum + (d.quantidade_prevista * (insumo?.preco_unitario || 0));
  }, 0);

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            Necessidade Prevista (Planejado)
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">{demandas.length} itens | R$ {totalPrevisto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <Button 
          onClick={() => criarRequisicaoMutation.mutate()}
          disabled={selecionados.size === 0 || criarRequisicaoMutation.isPending}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Gerar Requisição ({selecionados.size})
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {demandas.map(demanda => {
          const insumo = insumos.find(i => i.id === demanda.insumo_id);
          const subtotal = demanda.quantidade_prevista * (insumo?.preco_unitario || 0);
          
          return (
            <div key={demanda.id} className="flex items-center gap-4 p-3 bg-white rounded-lg border border-blue-100">
              <Checkbox 
                checked={selecionados.has(demanda.id)}
                onCheckedChange={(checked) => {
                  const newSet = new Set(selecionados);
                  if (checked) newSet.add(demanda.id);
                  else newSet.delete(demanda.id);
                  setSelecionados(newSet);
                }}
              />
              
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 truncate">{insumo?.descricao || demanda.insumo_id}</h4>
                <div className="flex gap-4 text-sm text-gray-600 mt-1">
                  <span>{demanda.quantidade_prevista} {demanda.unidade}</span>
                  <span>@ R$ {(insumo?.preco_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  <span className="font-semibold text-gray-900">= R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              
              <Badge variant="outline" className="border-blue-300 text-blue-700">
                {demanda.status || 'planejado'}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
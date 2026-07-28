import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import { ArrowLeft, CheckCircle, XCircle, Edit, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ItemRequisicao from '../components/compras/ItemRequisicao';
import AtenderRequisicao from '../components/compras/AtenderRequisicao';
import RegistrarRecebimento from '../components/compras/RegistrarRecebimento';
import FluxoComprasIntegrado from '../components/compras/FluxoComprasIntegrado';
import LinkModulos from '../components/shared/LinkModulos';

const statusAprovacaoConfig = {
  aguardando: { label: 'Aguardando', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  aprovada: { label: 'Aprovada', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  recusada: { label: 'Recusada', color: 'bg-red-500/10 text-red-400 border-red-500/20' }
};

export default function SolicitacaoDetalhes() {
  const urlParams = new URLSearchParams(window.location.search);
  const solicitacaoId = urlParams.get('id');
  const queryClient = useQueryClient();
  const [dialogRecusar, setDialogRecusar] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState('');

  const { data: solicitacaoData, isLoading } = useQuery({
    queryKey: ['solicitacao', solicitacaoId],
    queryFn: () => base44.entities.RequisicaoCompra.filter({ id: solicitacaoId }),
    enabled: !!solicitacaoId
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const aprovarMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      
      await base44.functions.invoke('aprovarRequisicao', {
        requisicao_id: solicitacaoId,
        aprovado: true,
        aprovador_email: user.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacao', solicitacaoId] });
      toast.success('Solicitação aprovada!');
    }
  });

  const recusarMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      await base44.functions.invoke('aprovarRequisicao', {
        requisicao_id: solicitacaoId,
        aprovado: false,
        aprovador_email: user.email,
        motivo: motivoRecusa
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacao', solicitacaoId] });
      setDialogRecusar(false);
      setMotivoRecusa('');
      toast.success('Solicitação recusada');
    }
  });

  const voltarAguardandoMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.RequisicaoCompra.update(solicitacaoId, {
        status_aprovacao: 'aguardando',
        aprovado_por: null,
        data_aprovacao: null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacao', solicitacaoId] });
      toast.success('Status alterado para aguardando');
    }
  });

  const gerarCotacao = async (itens) => {
    // Criar cotação automática com itens vinculados
    const cotacao = await base44.entities.CotacaoFornecedor.create({
      obra_id: solicitacao.obra_id,
      solicitacao_id: solicitacaoId,
      data_cotacao: new Date().toISOString().split('T')[0],
      status: 'em_aberto',
      itens: itens.map(item => ({
        insumo_id: item.insumo_id,
        descricao: item.descricao,
        unidade: item.unidade,
        quantidade: item.quantidade_solicitada
      }))
    });

    // Atualizar status dos itens
    const itensAtualizados = solicitacao.itens.map(item => {
      const atender = itens.find(i => i.insumo_id === item.insumo_id && i.descricao === item.descricao);
      if (atender) {
        return { ...item, status: 'em_cotacao', cotacao_id: cotacao.id };
      }
      return item;
    });

    await base44.entities.RequisicaoCompra.update(solicitacaoId, {
      itens: itensAtualizados
    });

    queryClient.invalidateQueries({ queryKey: ['solicitacao', solicitacaoId] });
    toast.success('Cotação criada com sucesso!');
  };

  const gerarOrdemCompra = async (itens) => {
    // Criar OC automática com itens vinculados
    const ordemCompra = await base44.entities.OrdemCompra.create({
      obra_id: solicitacao.obra_id,
      solicitacao_id: solicitacaoId,
      data_emissao: new Date().toISOString().split('T')[0],
      status: 'em_aberto',
      itens: itens.map(item => ({
        insumo_id: item.insumo_id,
        descricao: item.descricao,
        unidade: item.unidade,
        quantidade: item.quantidade_solicitada,
        valor_unitario: item.valor_estimado || 0
      }))
    });

    // Atualizar status dos itens
    const itensAtualizados = solicitacao.itens.map(item => {
      const atender = itens.find(i => i.insumo_id === item.insumo_id && i.descricao === item.descricao);
      if (atender) {
        return { ...item, status: 'em_compra', ordem_compra_id: ordemCompra.id };
      }
      return item;
    });

    await base44.entities.RequisicaoCompra.update(solicitacaoId, {
      itens: itensAtualizados,
      status_atendimento: 'em_compra'
    });

    queryClient.invalidateQueries({ queryKey: ['solicitacao', solicitacaoId] });
    toast.success('Ordem de compra criada com sucesso!');
  };

  const atenderSemCompras = async (itens, dataEntrega) => {
    const itensAtualizados = solicitacao.itens.map(item => {
      const atender = itens.find(i => i.insumo_id === item.insumo_id && i.descricao === item.descricao);
      if (atender) {
        return { ...item, status: 'a_receber', data_prevista_entrega: dataEntrega };
      }
      return item;
    });

    const todosReceber = itensAtualizados.every(item => 
      item.status === 'a_receber' || item.status === 'recebido' || item.status === 'recebido_parcial'
    );

    await base44.entities.RequisicaoCompra.update(solicitacaoId, {
      itens: itensAtualizados,
      status_atendimento: todosReceber ? 'a_receber' : solicitacao.status_atendimento
    });

    queryClient.invalidateQueries({ queryKey: ['solicitacao', solicitacaoId] });
    toast.success('Itens marcados como "A Receber"');
  };

  const registrarRecebimento = async (recebimentos) => {
    const itensAtualizados = [...solicitacao.itens];
    const movimentacoes = [];
    
    for (const { item_index, quantidade_receber } of recebimentos) {
      const item = itensAtualizados[item_index];
      const novaQtdRecebida = (item.quantidade_recebida || 0) + quantidade_receber;
      item.quantidade_recebida = novaQtdRecebida;
      
      if (novaQtdRecebida >= item.quantidade_aprovada) {
        item.status = 'recebido';
      } else {
        item.status = 'recebido_parcial';
      }
      
      // Preparar movimentação de estoque
      if (item.insumo_id && quantidade_receber > 0) {
        movimentacoes.push({
          material_id: item.insumo_id,
          obra_id: solicitacao.obra_id,
          tipo: 'entrada',
          quantidade: quantidade_receber,
          data_movimentacao: new Date().toISOString().split('T')[0],
          origem: 'solicitacao_compra',
          referencia_id: solicitacaoId,
          observacao: `Recebimento de ${item.descricao}`
        });
      }
    }

    const todosRecebidos = itensAtualizados.every(item => item.status === 'recebido');

    // Criar movimentações de estoque
    for (const movimentacao of movimentacoes) {
      await base44.entities.MovimentacaoEstoque.create(movimentacao);
    }

    await base44.entities.RequisicaoCompra.update(solicitacaoId, {
      itens: itensAtualizados,
      status_atendimento: todosRecebidos ? 'concluido' : 'recebido_parcial'
    });

    queryClient.invalidateQueries({ queryKey: ['solicitacao', solicitacaoId] });
    queryClient.invalidateQueries({ queryKey: ['movimentacoes-estoque'] });
    toast.success('Recebimento registrado e estoque atualizado!');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 bg-gray-800" />
        <Skeleton className="h-96 bg-gray-800 rounded-2xl" />
      </div>
    );
  }

  const solicitacao = solicitacaoData?.[0];
  if (!solicitacao) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Solicitação não encontrada</p>
      </div>
    );
  }

  const obra = obras.find(o => o.id === solicitacao.obra_id);
  // Mapear status novo para config de exibição
  const statusKey = solicitacao.status === 'aguardando' ? 'aguardando' :
                   solicitacao.status === 'aprovada' ? 'aprovada' :
                   solicitacao.status === 'recusada' ? 'recusada' :
                   solicitacao.status_aprovacao;
  const statusAprov = statusAprovacaoConfig[statusKey] || statusAprovacaoConfig.aguardando;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.location.href = createPageUrl('Solicitacoes')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">
                {solicitacao.titulo || `Solicitação #${solicitacao.id.substring(0, 8)}`}
              </h1>
              <Badge className={cn("border", statusAprov.color)}>{statusAprov.label}</Badge>
            </div>
            <p className="text-gray-500">{obra?.nome}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {solicitacao.status_aprovacao === 'aguardando' && (
            <>
              <Button
                onClick={() => window.location.href = createPageUrl(`SolicitacaoForm?id=${solicitacao.id}`)}
                variant="outline"
                className="border-gray-700 text-gray-400 gap-2"
              >
                <Edit className="w-4 h-4" />
                Editar
              </Button>
              <Button
                onClick={() => setDialogRecusar(true)}
                variant="outline"
                className="border-red-700 text-red-400 hover:bg-red-500/10 gap-2"
              >
                <XCircle className="w-4 h-4" />
                Recusar
              </Button>
              <Button
                onClick={() => aprovarMutation.mutate()}
                disabled={aprovarMutation.isPending}
                className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Aprovar
              </Button>
            </>
          )}
          {(solicitacao.status_aprovacao === 'aprovada' || solicitacao.status_aprovacao === 'recusada') && (
            <Button
              onClick={() => voltarAguardandoMutation.mutate()}
              variant="outline"
              className="border-gray-700 text-gray-400"
            >
              Voltar para Aguardando
            </Button>
          )}
        </div>
      </div>

      {/* Fluxo de Compras */}
      <FluxoComprasIntegrado solicitacao={solicitacao} />

      {/* Informações */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Informações da Solicitação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Data Solicitação:</span>
              <p className="text-white font-medium">
                {new Date(solicitacao.data_solicitacao).toLocaleDateString('pt-BR')}
              </p>
            </div>
            {solicitacao.data_necessidade && (
              <div>
                <span className="text-gray-500">Necessidade:</span>
                <p className="text-white font-medium">
                  {new Date(solicitacao.data_necessidade).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}
            <div>
              <span className="text-gray-500">Solicitante:</span>
              <p className="text-white font-medium">{solicitacao.solicitante}</p>
            </div>
            {solicitacao.aprovado_por && (
              <div>
                <span className="text-gray-500">Aprovado por:</span>
                <p className="text-white font-medium">{solicitacao.aprovado_por}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Itens */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Itens Solicitados</CardTitle>
        </CardHeader>
        <CardContent>
          <ItemRequisicao
            itens={solicitacao.itens || []}
            onItensChange={() => {}}
            disabled={true}
          />
        </CardContent>
      </Card>

      {/* Atender Requisição */}
      {solicitacao.status_aprovacao === 'aprovada' && solicitacao.status_atendimento !== 'concluido' && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Atender Solicitação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AtenderRequisicao
              requisicao={solicitacao}
              onGerarCotacao={gerarCotacao}
              onGerarOrdemCompra={gerarOrdemCompra}
              onAtenderSemCompras={atenderSemCompras}
            />
            
            <div className="pt-4 border-t border-gray-800">
              <RegistrarRecebimento
                requisicao={solicitacao}
                onRegistrar={registrarRecebimento}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog Recusar */}
      <Dialog open={dialogRecusar} onOpenChange={setDialogRecusar}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Recusar Solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-400">Motivo da Recusa</Label>
              <Textarea
                value={motivoRecusa}
                onChange={(e) => setMotivoRecusa(e.target.value)}
                placeholder="Descreva o motivo..."
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDialogRecusar(false)}
                className="border-gray-700 text-gray-400"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => recusarMutation.mutate()}
                disabled={recusarMutation.isPending}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Confirmar Recusa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
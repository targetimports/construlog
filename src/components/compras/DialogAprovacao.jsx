import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function DialogAprovacao({ requisicao, open, onClose }) {
  const [comentario, setComentario] = useState('');
  const [isAprovando, setIsAprovando] = useState(null);
  const queryClient = useQueryClient();

  if (!requisicao?.workflow_aprovacao) {
    return null;
  }

  const workflow = requisicao.workflow_aprovacao;
  const etapaAtual = workflow.etapas?.find(e => e.status === 'pendente');

  const processarAprovacao = useMutation({
    mutationFn: async (dados) => {
      const response = await base44.functions.invoke('processarAprovacaoRequisicao', {
        requisicao_id: requisicao.id,
        etapa_numero: etapaAtual.numero,
        aprovado: dados.aprovado,
        comentario: dados.comentario
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      toast.success(isAprovando ? 'Requisição aprovada!' : 'Requisição rejeitada!');
      setComentario('');
      onClose();
    },
    onError: (error) => {
      toast.error('Erro ao processar aprovação: ' + error.message);
    }
  });

  const handleAprovar = () => {
    setIsAprovando(true);
    processarAprovacao.mutate({
      aprovado: true,
      comentario
    });
  };

  const handleRejeitar = () => {
    if (!comentario.trim()) {
      toast.error('Motivo da rejeição é obrigatório');
      return;
    }
    setIsAprovando(false);
    processarAprovacao.mutate({
      aprovado: false,
      comentario
    });
  };

  const isLoading = processarAprovacao.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aprovar Requisição de Compra</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Detalhes da Requisição */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Título</p>
                  <p className="font-semibold text-gray-900">{requisicao.titulo}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Solicitante</p>
                  <p className="font-semibold text-gray-900">{requisicao.solicitante_nome}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Valor Total</p>
                  <p className="font-semibold text-gray-900">
                    R$ {(requisicao.valor_total_estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Itens</p>
                  <p className="font-semibold text-gray-900">{requisicao.qtd_itens || 0}</p>
                </div>
              </div>
              {requisicao.descricao_resumo && (
                <div>
                  <p className="text-sm text-gray-500">Descrição</p>
                  <p className="text-gray-700">{requisicao.descricao_resumo}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Etapa Atual */}
          {etapaAtual && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900">Etapa Atual</p>
                    <p className="font-semibold text-blue-900">
                      {etapaAtual.numero}. {etapaAtual.alcada_nome}
                    </p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800">Seu Turno</Badge>
                </div>
                <p className="text-sm text-blue-700">
                  {etapaAtual.requer_todos_aprovadores
                    ? 'Requer aprovação de TODOS os aprovadores'
                    : 'Requer aprovação de QUALQUER UM dos aprovadores'}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Comentário */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900">
              Comentário {isAprovando === false && '(obrigatório)'}
            </label>
            <Textarea
              placeholder={
                isAprovando === false
                  ? 'Explique o motivo da rejeição...'
                  : 'Adicione um comentário opcional...'
              }
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Botões */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejeitar}
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading && isAprovando === false ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              Rejeitar
            </Button>
            <Button
              onClick={handleAprovar}
              disabled={isLoading}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {isLoading && isAprovando === true ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Aprovar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
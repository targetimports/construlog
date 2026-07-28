import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Package } from 'lucide-react';
import { toast } from 'sonner';

export default function FormRecebimentoComEstoque({ oc_id, open, onClose, onSuccess }) {
  const [itens, setItens] = useState([]);
  const [nfe, setNfe] = useState('');
  const [qualidadeOk, setQualidadeOk] = useState(false);
  const [observacoes, setObservacoes] = useState('');

  const { data: oc, isLoading: ocLoading } = useQuery({
    queryKey: ['oc-details', oc_id],
    queryFn: () => oc_id ? base44.entities.OrdemCompra.read(oc_id) : null,
    enabled: !!oc_id && open
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  // Inicializar itens quando OC carrega
  React.useEffect(() => {
    if (oc?.itens) {
      setItens(oc.itens.map(item => ({
        ...item,
        quantidade_recebida: item.quantidade_solicitada || 0,
        quantidade_rejeitada: 0,
        divergencia: 0
      })));
    }
  }, [oc]);

  const createRecebimento = useMutation({
    mutationFn: async () => {
      // Criar recebimento
      const recebimento = await base44.entities.RecebimentoMaterial.create({
        ordem_compra_id: oc_id,
        numero_oc: oc?.numero,
        obra_id: oc?.obra_id,
        almoxarifado_id: 'almoxarifado_principal', // TODO: permitir seleção
        fornecedor_id: oc?.fornecedor_id,
        fornecedor_nome: oc?.fornecedor_nome,
        itens: itens.map(i => ({
          insumo_id: i.insumo_id,
          descricao: i.descricao,
          quantidade_solicitada: i.quantidade_solicitada,
          quantidade_recebida: i.quantidade_recebida,
          quantidade_rejeitada: i.quantidade_rejeitada,
          divergencia: (i.quantidade_recebida || 0) - (i.quantidade_solicitada || 0),
          valor_unitario: i.valor_unitario
        })),
        data_recebimento: new Date().toISOString(),
        responsavel_almoxarife: user?.email,
        numero_nfe: nfe,
        status_recebimento: 'total',
        confirmacao_qualidade: qualidadeOk,
        observacoes
      });

      // Chamar função para processar estoque
      await base44.functions.invoke('processarRecebimentoComEstoque', {
        recebimento_id: recebimento.id,
        obra_id: oc?.obra_id,
        almoxarifado_id: 'almoxarifado_principal'
      });

      // Atualizar status da OC
      await base44.entities.OrdemCompra.update(oc_id, {
        status_entrega: 'recebido_total',
        data_pagamento: new Date().toISOString()
      });

      return recebimento;
    },
    onSuccess: () => {
      toast.success('Recebimento processado e estoque atualizado!');
      onSuccess?.();
      onClose?.();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  const handleQtdChange = (idx, qtd) => {
    const novoItens = [...itens];
    novoItens[idx].quantidade_recebida = qtd;
    novoItens[idx].divergencia = qtd - (novoItens[idx].quantidade_solicitada || 0);
    setItens(novoItens);
  };

  if (!open) return null;
  if (ocLoading) return <div className="p-4 text-center">Carregando...</div>;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receber Materiais - OC #{oc?.numero}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Infos da OC */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Fornecedor</p>
                  <p className="font-semibold">{oc?.fornecedor_nome}</p>
                </div>
                <div>
                  <p className="text-gray-500">Valor Total</p>
                  <p className="font-semibold">R$ {(oc?.valor_total || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Itens */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Itens a Receber</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {itens.map((item, idx) => (
                <div key={idx} className="p-3 border rounded-lg space-y-2">
                  <p className="font-semibold text-sm">{item.descricao}</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <label className="text-gray-500 text-xs">Solicitado</label>
                      <p className="font-semibold">{item.quantidade_solicitada}</p>
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs">Recebendo</label>
                      <Input
                        type="number"
                        min="0"
                        value={item.quantidade_recebida || 0}
                        onChange={(e) => handleQtdChange(idx, parseFloat(e.target.value))}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs">Divergência</label>
                      <p className={`font-semibold ${item.divergencia !== 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {item.divergencia > 0 ? '+' : ''}{item.divergencia}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Documentação */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documentação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-semibold">Nota Fiscal</label>
                <Input
                  placeholder="Ex: 123456"
                  value={nfe}
                  onChange={(e) => setNfe(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-semibold">Observações</label>
                <textarea
                  className="w-full h-20 p-2 border rounded-lg text-sm"
                  placeholder="Anotações sobre o recebimento..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <Checkbox
                  checked={qualidadeOk}
                  onChange={(checked) => setQualidadeOk(checked)}
                />
                <label className="text-sm cursor-pointer">
                  Confirmar que material passou em inspeção de qualidade
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Alertas de Divergência */}
          {itens.some(i => i.divergencia !== 0) && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-yellow-900">Divergências Detectadas</p>
                <p className="text-yellow-800">Alguns itens têm quantidades diferentes do solicitado</p>
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 gap-2"
              onClick={() => createRecebimento.mutate()}
              disabled={createRecebimento.isPending || !qualidadeOk}
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirmar Recebimento
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
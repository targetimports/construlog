import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

export default function FormRecebimento({ oc, open, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [dados, setDados] = useState({
    almoxarifado_id: oc?.almoxarifado_id || '',
    numero_nfe: '',
    data_nfe: new Date().toISOString().split('T')[0],
    observacoes: '',
    confirmacao_qualidade: true
  });

  const [itensRecebidos, setItensRecebidos] = useState(
    oc?.itens?.map(i => ({
      insumo_id: i.insumo_id,
      descricao: i.descricao,
      quantidade_solicitada: i.quantidade_solicitada,
      quantidade_recebida: 0,
      quantidade_rejeitada: 0,
      valor_unitario: i.valor_unitario
    })) || []
  );

  const { data: depositosAll = [] } = useQuery({
    queryKey: ['locais-estoque-receb'],
    queryFn: () => base44.entities.LocalEstoque.list('nome', 200),
    enabled: open
  });
  const depositos = depositosAll.filter(d => d.ativo !== false);

  const receberMutation = useMutation({
    mutationFn: async () => {
      return await base44.functions.invoke('processarRecebimentoMaterial', {
        ordem_compra_id: oc.id,
        numero_oc: oc.numero,
        deposito_id: dados.almoxarifado_id,
        almoxarifado_id: dados.almoxarifado_id,
        itens: itensRecebidos,
        numero_nfe: dados.numero_nfe,
        data_nfe: dados.data_nfe,
        observacoes: dados.observacoes,
        confirmacao_qualidade: dados.confirmacao_qualidade
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens-compra'] });
      queryClient.invalidateQueries({ queryKey: ['recebimentos'] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoes-estoque'] });
      queryClient.invalidateQueries({ queryKey: ['saldo-estoque'] });
      toast.success('Recebimento processado com sucesso!');
      onSuccess?.();
    },
    onError: (err) => {
      const msg = err.response?.data?.error || err.message;
      toast.error(msg);
    }
  });

  const atualizarItem = (index, campo, valor) => {
    const novos = [...itensRecebidos];
    novos[index][campo] = parseFloat(valor) || 0;
    setItensRecebidos(novos);
  };

  const receberTodos = () => {
    const novos = itensRecebidos.map(i => ({
      ...i,
      quantidade_recebida: i.quantidade_solicitada
    }));
    setItensRecebidos(novos);
  };

  const handleSubmit = () => {
    if (!dados.almoxarifado_id) {
      toast.error('Selecione o depósito de destino');
      return;
    }

    const totalRecebido = itensRecebidos.reduce((s, i) => s + i.quantidade_recebida, 0);
    if (totalRecebido === 0) {
      toast.error('Informe a quantidade recebida de pelo menos 1 item');
      return;
    }

    receberMutation.mutate();
  };

  const totalRecebido = itensRecebidos.reduce((s, i) => s + i.quantidade_recebida, 0);
  const totalSolicitado = itensRecebidos.reduce((s, i) => s + i.quantidade_solicitada, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recebimento de Material - OC #{oc?.numero}</DialogTitle>
        </DialogHeader>

        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            Não é permitido receber quantidades superiores ao solicitado (tolerância 0%)
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {/* Almoxarifado de destino */}
          <div>
            <label className="block text-sm font-medium mb-1">Almoxarifado de Destino *</label>
            <ComboboxBusca
              options={depositos.map(d => ({ value: d.id, label: `${d.tipo === 'OBRA' ? '' : ''} ${d.nome}` }))}
              value={dados.almoxarifado_id}
              onSelect={(v) => setDados({ ...dados, almoxarifado_id: v })}
              placeholder="Selecione o almoxarifado"
              searchPlaceholder="Buscar almoxarifado..."
              emptyMessage={depositosAll.length === 0 ? 'Nenhum almoxarifado cadastrado (Estoque → Almoxarifados).' : 'Nenhum almoxarifado encontrado.'}
            />
          </div>

          {/* NF */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Número NF (opcional)</label>
              <Input
                placeholder="Ex: 12345"
                value={dados.numero_nfe}
                onChange={(e) => setDados({...dados, numero_nfe: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data NF</label>
              <Input
                type="date"
                value={dados.data_nfe}
                onChange={(e) => setDados({...dados, data_nfe: e.target.value})}
              />
            </div>
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold">Itens a Receber</p>
              <Button variant="outline" size="sm" onClick={receberTodos}>
                Receber Todos
              </Button>
            </div>
            <div className="space-y-2">
              {itensRecebidos.map((item, idx) => (
                <Card key={idx}>
                  <CardContent className="pt-3">
                    <p className="font-semibold text-sm mb-2">{item.descricao}</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Solicitado</p>
                        <p className="font-bold">{item.quantidade_solicitada}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Recebido *</label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          value={item.quantidade_recebida}
                          onChange={(e) => atualizarItem(idx, 'quantidade_recebida', e.target.value)}
                          className={item.quantidade_recebida > item.quantidade_solicitada ? 'border-red-300' : ''}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Rejeitado</label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          value={item.quantidade_rejeitada}
                          onChange={(e) => atualizarItem(idx, 'quantidade_rejeitada', e.target.value)}
                        />
                      </div>
                    </div>
                    {item.quantidade_recebida > item.quantidade_solicitada && (
                      <p className="text-xs text-red-600 mt-1">Quantidade excede o solicitado</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Resumo */}
          <Card className="bg-gray-50">
            <CardContent className="pt-4">
              <div className="flex justify-between text-sm">
                <div>
                  <p className="text-gray-600">Total Recebido</p>
                  <p className="text-2xl font-bold text-green-600">{totalRecebido}</p>
                </div>
                <div>
                  <p className="text-gray-600">Total Solicitado</p>
                  <p className="text-2xl font-bold">{totalSolicitado}</p>
                </div>
                <div>
                  <p className="text-gray-600">Status</p>
                  <Badge className={totalRecebido === totalSolicitado ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                    {totalRecebido === totalSolicitado ? 'Total' : 'Parcial'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <div>
            <label className="block text-sm font-medium mb-1">Observações</label>
            <Textarea
              placeholder="Anotações sobre o recebimento..."
              value={dados.observacoes}
              onChange={(e) => setDados({...dados, observacoes: e.target.value})}
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="qualidade"
              checked={dados.confirmacao_qualidade}
              onChange={(e) => setDados({...dados, confirmacao_qualidade: e.target.checked})}
              className="w-4 h-4"
            />
            <label htmlFor="qualidade" className="text-sm cursor-pointer">
              Material aprovado na inspeção de qualidade
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={receberMutation.isPending} className="gap-2">
            {receberMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Confirmar Recebimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
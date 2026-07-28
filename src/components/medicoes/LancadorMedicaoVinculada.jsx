import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

export default function LancadorMedicaoVinculada({ obra_id }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantidade, setQuantidade] = useState('');
  const [processando, setProcessando] = useState(false);
  const queryClient = useQueryClient();

  // Buscar itens do orçamento
  const { data: itens } = useQuery({
    queryKey: ['orcamento-items', obra_id],
    queryFn: () => base44.entities.OrcamentoItem.filter({ obra_id }),
    enabled: !!obra_id
  });

  // Buscar composição do item selecionado
  const { data: composicao } = useQuery({
    queryKey: ['composicao', selectedItem?.id],
    queryFn: () => base44.entities.Composicao.filter({ 
      orcamento_item_id: selectedItem.id 
    }),
    enabled: !!selectedItem
  });

  // Processar medição
  const processarMedicao = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('processarMedicaoComVinculo', {
        obra_id,
        orcamento_item_id: selectedItem.id,
        quantidade_medida: parseFloat(quantidade)
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['orcamento-items']);
      queryClient.invalidateQueries(['medicoes']);
      toast.success(`Medição processada! Custo real: R$ ${data.custo_total.toFixed(2)}`);
      setQuantidade('');
      setSelectedItem(null);
      setProcessando(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Erro ao processar medição');
      setProcessando(false);
    }
  });

  const handleLancar = async () => {
    if (!selectedItem || !quantidade) {
      toast.error('Selecione um item e informe a quantidade');
      return;
    }

    const qty = parseFloat(quantidade);
    const saldo = selectedItem.quantidade - (selectedItem.quantidade_executada || 0);

    if (qty > saldo) {
      toast.error(`Quantidade maior que saldo disponível (${saldo})`);
      return;
    }

    if (!composicao || composicao.length === 0) {
      toast.error('Este item não possui composição vinculada');
      return;
    }

    setProcessando(true);
    processarMedicao.mutate();
  };

  const getItemsDisponiveis = () => {
    return itens?.filter(item => {
      const executada = item.quantidade_executada || 0;
      return executada < item.quantidade;
    }) || [];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5" />
          Lançar Medição com Vínculo Obrigatório
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="bg-blue-50 border-blue-200">
          <AlertCircle className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-700">
            A medição calcula automaticamente insumos consumidos, hora-máquina e custo real.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Item do Orçamento *</label>
            <select 
              value={selectedItem?.id || ''}
              onChange={(e) => {
                const item = getItemsDisponiveis().find(i => i.id === e.target.value);
                setSelectedItem(item);
              }}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="">Selecione um item</option>
              {getItemsDisponiveis()?.map(item => {
                const saldo = item.quantidade - (item.quantidade_executada || 0);
                return (
                  <option key={item.id} value={item.id}>
                    {item.descricao} (Saldo: {saldo} {item.unidade})
                  </option>
                );
              })}
            </select>
          </div>

          {selectedItem && (
            <>
              <Alert className="bg-gray-50">
                <AlertDescription>
                  <div className="space-y-2 text-sm">
                    <p><strong>Previsto:</strong> {selectedItem.quantidade} {selectedItem.unidade}</p>
                    <p><strong>Executado:</strong> {selectedItem.quantidade_executada || 0} {selectedItem.unidade}</p>
                    <p><strong>Saldo:</strong> {selectedItem.quantidade - (selectedItem.quantidade_executada || 0)} {selectedItem.unidade}</p>
                    <p className="text-gray-600 mt-2">
                      {composicao && composicao.length > 0 ? '✓ Composição vinculada' : '✗ Sem composição'}
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              <div>
                <label className="block text-sm font-medium mb-2">Quantidade a Medir *</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                    placeholder="Ex: 10"
                    disabled={procesando}
                  />
                  <span className="flex items-center px-3 py-2 text-gray-600">
                    {selectedItem.unidade}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <Button 
          onClick={handleLancar}
          disabled={!selectedItem || !quantidade || processando}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          {processando ? 'Processando...' : 'Lançar Medição'}
        </Button>
      </CardContent>
    </Card>
  );
}
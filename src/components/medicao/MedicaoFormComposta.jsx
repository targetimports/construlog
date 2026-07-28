import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, AlertCircle, Plus } from 'lucide-react';

export default function MedicaoFormComposta({ obra_id, onMedicaoConfirmada }) {
  const queryClient = useQueryClient();
  const [medicaoData, setMedicaoData] = useState({
    numero: '',
    data_medicao: new Date().toISOString().split('T')[0],
    observacoes: ''
  });
  const [itens, setItens] = useState([]);
  const [medicaoId, setMedicaoId] = useState(null);

  // Buscar itens do orçamento com composição
  const { data: itensOrcamento = [] } = useQuery({
    queryKey: ['itens-orcamento', obra_id],
    queryFn: () => base44.entities.OrcamentoItem.filter({
      obra_id,
      is_grupo: false
    })
  });

  // Mutation: criar medição
  const criarMedicao = useMutation({
    mutationFn: async () => {
      const med = await base44.entities.Medicao.create({
        obra_id,
        numero: medicaoData.numero,
        data_medicao: medicaoData.data_medicao,
        responsavel_email: (await base44.auth.me()).email,
        observacoes: medicaoData.observacoes,
        status: 'rascunho'
      });
      setMedicaoId(med.id);
      return med;
    }
  });

  // Mutation: adicionar item à medição
  const adicionarItemMedicao = useMutation({
    mutationFn: async (itemData) => {
      if (!medicaoId) throw new Error('Medição não criada');
      return base44.entities.MedicaoItem.create({
        medicao_id: medicaoId,
        obra_id,
        orcamento_item_id: itemData.orcamento_item_id,
        item_num: itemData.item_num,
        composicao_id: itemData.composicao_id,
        quantidade_medida: itemData.quantidade_medida,
        valor_unit_realizado: itemData.valor_unit_realizado,
        status: 'confirmada'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicacao-items', medicaoId] });
    }
  });

  // Mutation: confirmar medição (gera consumo)
  const confirmarMedicao = useMutation({
    mutationFn: async () => {
      return base44.functions.invoke('confirmarMedicao', {
        medicao_id: medicaoId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicacao-items', medicaoId] });
      onMedicaoConfirmada && onMedicaoConfirmada(medicaoId);
    }
  });

  const handleAdicionarItem = (item) => {
    setItens([...itens, {
      ...item,
      quantidade_medida: 0,
      valor_unit_realizado: 0
    }]);
  };

  const handleConfirmar = async () => {
    if (!medicaoData.numero) {
      alert('Preencha o número da medição');
      return;
    }

    // Criar medição
    const med = await criarMedicao.mutateAsync();

    // Adicionar itens
    for (const item of itens) {
      if (item.quantidade_medida > 0) {
        await adicionarItemMedicao.mutateAsync(item);
      }
    }

    // Confirmar (gera consumo)
    await confirmarMedicao.mutateAsync();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova Medição</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Dados da medição */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Número</label>
            <Input
              value={medicaoData.numero}
              onChange={(e) => setMedicaoData({ ...medicaoData, numero: e.target.value })}
              placeholder="MED-001"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Data</label>
            <Input
              type="date"
              value={medicaoData.data_medicao}
              onChange={(e) => setMedicaoData({ ...medicaoData, data_medicao: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Observações</label>
          <textarea
            value={medicaoData.observacoes}
            onChange={(e) => setMedicaoData({ ...medicaoData, observacoes: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm"
            rows={3}
            placeholder="Detalhes adicionais..."
          />
        </div>

        {/* Seleção de itens */}
        <div className="space-y-3">
          <h3 className="font-semibold">Itens do Orçamento</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
            {itensOrcamento.map(item => (
              <button
                key={item.id}
                onClick={() => handleAdicionarItem(item)}
                disabled={itens.some(i => i.orcamento_item_id === item.id)}
                className="text-left p-3 border border-gray-300 rounded-lg hover:bg-blue-50 disabled:bg-gray-100 disabled:opacity-50"
              >
                <p className="font-semibold text-sm">{item.item_num}</p>
                <p className="text-xs text-gray-600">{item.descricao}</p>
                <p className="text-xs text-gray-500 mt-1">Quant. Orçada: {item.quantidade_orcada}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Itens adicionados */}
        {itens.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold">Itens da Medição</h3>
            <div className="space-y-2">
              {itens.map((item, idx) => (
                <div key={idx} className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm">{item.item_num}</p>
                      <p className="text-xs text-gray-600">{item.descricao}</p>
                    </div>
                    <button
                      onClick={() => setItens(itens.filter((_, i) => i !== idx))}
                      className="text-red-600 text-xs hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600">Quantidade</label>
                      <Input
                        type="number"
                        value={item.quantidade_medida}
                        onChange={(e) => {
                          const novoItens = [...itens];
                          novoItens[idx].quantidade_medida = parseFloat(e.target.value);
                          setItens(novoItens);
                        }}
                        placeholder="0"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Valor Unit.</label>
                      <Input
                        type="number"
                        value={item.valor_unit_realizado}
                        onChange={(e) => {
                          const novoItens = [...itens];
                          novoItens[idx].valor_unit_realizado = parseFloat(e.target.value);
                          setItens(novoItens);
                        }}
                        placeholder="0"
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              setMedicaoData({ numero: '', data_medicao: new Date().toISOString().split('T')[0], observacoes: '' });
              setItens([]);
              setMedicaoId(null);
            }}
          >
            Limpar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={criarMedicao.isPending || adicionarItemMedicao.isPending || confirmarMedicao.isPending || itens.length === 0}
            className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Confirmar Medição
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
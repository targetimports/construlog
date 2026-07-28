import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function CadastroRapidoFinanceiro({ onSuccess }) {
  const queryClient = useQueryClient();
  const [linhas, setLinhas] = useState([{ 
    id: Date.now(), 
    tipo: 'pagar',
    descricao: '',
    valor: '',
    data_vencimento: '',
    obra_id: '',
    status: 'pendente',
    categoria: 'material',
    fornecedor_cliente: ''
  }]);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ContaFinanceira.bulkCreate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-financeiras'] });
      toast.success('Lançamentos criados com sucesso!');
      setLinhas([{ 
        id: Date.now(), 
        tipo: 'pagar',
        descricao: '',
        valor: '',
        data_vencimento: '',
        obra_id: '',
        status: 'pendente',
        categoria: 'material',
        fornecedor_cliente: ''
      }]);
      if (onSuccess) onSuccess();
    },
    onError: () => {
      toast.error('Erro ao criar lançamentos');
    }
  });

  const adicionarLinha = () => {
    setLinhas([...linhas, {
      id: Date.now(),
      tipo: 'pagar',
      descricao: '',
      valor: '',
      data_vencimento: '',
      obra_id: '',
      status: 'pendente',
      categoria: 'material',
      fornecedor_cliente: ''
    }]);
  };

  const removerLinha = (id) => {
    if (linhas.length > 1) {
      setLinhas(linhas.filter(l => l.id !== id));
    }
  };

  const atualizarLinha = (id, campo, valor) => {
    setLinhas(linhas.map(l => l.id === id ? { ...l, [campo]: valor } : l));
  };

  const salvarTodos = () => {
    const validos = linhas.filter(l => 
      l.descricao && l.valor && l.data_vencimento && l.obra_id
    );

    if (validos.length === 0) {
      toast.error('Preencha ao menos uma linha completamente');
      return;
    }

    const dados = validos.map(l => ({
      tipo: l.tipo,
      descricao: l.descricao,
      valor: Number(l.valor),
      data_vencimento: l.data_vencimento,
      obra_id: l.obra_id,
      status: l.status,
      categoria: l.categoria,
      fornecedor_cliente: l.fornecedor_cliente
    }));

    createMutation.mutate(dados);
  };

  return (
    <Card className="bg-white border border-gray-200 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Cadastro Rápido - Lançamentos</h3>
        <Button onClick={adicionarLinha} size="sm" variant="outline">
          <Plus className="w-4 h-4 mr-1" />
          Adicionar Linha
        </Button>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {linhas.map((linha, index) => (
          <div key={linha.id} className="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 rounded-lg">
            <div className="col-span-1 flex items-center justify-center pt-2">
              <span className="text-sm font-semibold text-gray-500">#{index + 1}</span>
            </div>
            
            <div className="col-span-1">
              <Select 
                value={linha.tipo} 
                onValueChange={(v) => atualizarLinha(linha.id, 'tipo', v)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagar">Pagar</SelectItem>
                  <SelectItem value="receber">Receber</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-3">
              <Input
                placeholder="Descrição"
                value={linha.descricao}
                onChange={(e) => atualizarLinha(linha.id, 'descricao', e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="col-span-2">
              <Input
                placeholder="Fornecedor/Cliente"
                value={linha.fornecedor_cliente}
                onChange={(e) => atualizarLinha(linha.id, 'fornecedor_cliente', e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="col-span-2">
              {linha.obra_id === '__novo__' ? (
                <Input
                  placeholder="Digite nova obra"
                  value={linha.nova_obra || ''}
                  onChange={(e) => atualizarLinha(linha.id, 'nova_obra', e.target.value)}
                  className="h-9 text-xs"
                  autoFocus
                />
              ) : (
                <Select 
                  value={linha.obra_id} 
                  onValueChange={(v) => atualizarLinha(linha.id, 'obra_id', v)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Obra" />
                  </SelectTrigger>
                  <SelectContent>
                    {obras.map(obra => (
                      <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                    ))}
                    <SelectItem value="__novo__">+ Criar nova obra</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="col-span-1">
              <Input
                type="number"
                step="0.01"
                placeholder="Valor"
                value={linha.valor}
                onChange={(e) => atualizarLinha(linha.id, 'valor', e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="col-span-1">
              <Input
                type="date"
                value={linha.data_vencimento}
                onChange={(e) => atualizarLinha(linha.id, 'data_vencimento', e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="col-span-1 flex justify-end">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removerLinha(linha.id)}
                disabled={linhas.length === 1}
                className="h-9 w-9"
              >
                <X className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end gap-3">
        <Button 
          onClick={salvarTodos} 
          disabled={createMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Check className="w-4 h-4 mr-2" />
          {createMutation.isPending ? 'Salvando...' : `Salvar ${linhas.length} Lançamento(s)`}
        </Button>
      </div>
    </Card>
  );
}
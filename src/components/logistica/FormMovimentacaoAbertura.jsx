import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Loader } from 'lucide-react';

export default function FormMovimentacaoAbertura({ onCancelada, onSucesso }) {
  const [formData, setFormData] = useState({
    veiculo_id: '',
    obra_origem_id: '',
    obra_destino_id: '',
    saida_hora: new Date().toISOString().slice(0, 16),
    km_inicial: '',
    motivo: ''
  });

  const queryClient = useQueryClient();
  const user = base44.auth.me();

  // Buscar veículos ativos
  const { data: veiculos = [] } = useQuery({
    queryKey: ['veiculos-mov'],
    queryFn: () => base44.entities.Veiculo.list('-updated_date', 500),
    select: (data) => data.filter((v) => v.ativo !== false)
  });

  // Buscar obras
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-mov'],
    queryFn: () => base44.entities.Obra.list('-updated_date', 1000),
    select: (data) => data.filter((o) => o.status !== 'concluida' && o.status !== 'cancelada')
  });

  // Criar movimentação
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const userAuth = await user;
      return base44.entities.MovimentacaoVeiculo.create({
        veiculo_id: data.veiculo_id,
        obra_origem_id: data.obra_origem_id || null,
        obra_destino_id: data.obra_destino_id || null,
        saida_hora: new Date(data.saida_hora).toISOString(),
        km_inicial: parseFloat(data.km_inicial),
        motivo: data.motivo,
        responsavel_id: userAuth.email,
        status: 'ABERTA'
      });
    },
    onSuccess: (movimentacao) => {
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
      toast.success('Movimentação aberta!');
      onSucesso?.(movimentacao);
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  const handleSalvar = () => {
    if (!formData.veiculo_id || !formData.km_inicial) {
      toast.error('Veículo e KM inicial obrigatórios');
      return;
    }

    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button onClick={onCancelada} variant="ghost" size="icon" className="text-gray-400">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">Abrir Movimentação</h1>
          <p className="text-gray-400 text-sm">Registre saída do veículo</p>
        </div>
      </div>

      {/* Formulário */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Informações de Saída</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Veículo */}
          <div>
            <Label className="text-gray-300 text-xs font-semibold">Veículo *</Label>
            <Select
              value={formData.veiculo_id}
              onValueChange={(val) => setFormData({ ...formData, veiculo_id: val })}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white mt-1">
                <SelectValue placeholder="Selecione um veículo" />
              </SelectTrigger>
              <SelectContent>
                {veiculos.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.placa} — {v.modelo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Saída Hora */}
          <div>
            <Label className="text-gray-300 text-xs font-semibold">Hora de Saída *</Label>
            <Input
              type="datetime-local"
              value={formData.saida_hora}
              onChange={(e) => setFormData({ ...formData, saida_hora: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white mt-1"
            />
          </div>

          {/* KM Inicial */}
          <div>
            <Label className="text-gray-300 text-xs font-semibold">KM Inicial *</Label>
            <Input
              type="number"
              value={formData.km_inicial}
              onChange={(e) => setFormData({ ...formData, km_inicial: e.target.value })}
              placeholder="12500"
              className="bg-gray-700 border-gray-600 text-white mt-1"
            />
          </div>

          {/* Obra Origem */}
          <div>
            <Label className="text-gray-300 text-xs font-semibold">Obra Origem</Label>
            <Select
              value={formData.obra_origem_id}
              onValueChange={(val) => setFormData({ ...formData, obra_origem_id: val })}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white mt-1">
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>— Nenhuma —</SelectItem>
                {obras.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.codigo} — {o.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Obra Destino */}
          <div>
            <Label className="text-gray-300 text-xs font-semibold">Obra Destino</Label>
            <Select
              value={formData.obra_destino_id}
              onValueChange={(val) => setFormData({ ...formData, obra_destino_id: val })}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white mt-1">
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>— Nenhuma —</SelectItem>
                {obras.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.codigo} — {o.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Motivo */}
          <div>
            <Label className="text-gray-300 text-xs font-semibold">Motivo *</Label>
            <Textarea
              value={formData.motivo}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              placeholder="Ex: Buscar material em fornecedor, inspeção de obra, etc."
              className="bg-gray-700 border-gray-600 text-white mt-1"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Botões */}
      <div className="flex gap-3 justify-end">
        <Button onClick={onCancelada} variant="outline" className="border-gray-600 text-gray-300">
          Cancelar
        </Button>
        <Button
          onClick={handleSalvar}
          className="bg-blue-600 hover:bg-blue-700 gap-2"
          disabled={createMutation.isPending}
        >
          {createMutation.isPending && <Loader className="w-4 h-4 animate-spin" />}
          Abrir Movimentação
        </Button>
      </div>
    </div>
  );
}
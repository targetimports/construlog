import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function ContratoForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const contratoId = urlParams.get('id');
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    obra_id: '',
    numero: '',
    tipo: 'empreitada',
    contratante: '',
    contratado: '',
    objeto: '',
    valor_inicial: '',
    data_assinatura: '',
    data_inicio: '',
    data_fim_prevista: '',
    prazo_dias: '',
    status: 'vigente',
    observacoes: ''
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: contrato } = useQuery({
    queryKey: ['contrato', contratoId],
    queryFn: () => base44.entities.Contrato.filter({ id: contratoId }),
    enabled: !!contratoId
  });

  useEffect(() => {
    if (contrato && contrato.length > 0) {
      const c = contrato[0];
      setFormData({
        obra_id: c.obra_id || '',
        numero: c.numero || '',
        tipo: c.tipo || 'empreitada',
        contratante: c.contratante || '',
        contratado: c.contratado || '',
        objeto: c.objeto || '',
        valor_inicial: c.valor_inicial || '',
        data_assinatura: c.data_assinatura || '',
        data_inicio: c.data_inicio || '',
        data_fim_prevista: c.data_fim_prevista || '',
        prazo_dias: c.prazo_dias || '',
        status: c.status || 'vigente',
        observacoes: c.observacoes || ''
      });
    }
  }, [contrato]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Contrato.create({
      ...data,
      valor_inicial: Number(data.valor_inicial),
      valor_total: Number(data.valor_inicial),
      prazo_dias: data.prazo_dias ? Number(data.prazo_dias) : null
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      toast.success('Contrato criado!');
      window.location.href = createPageUrl('Contratos');
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Contrato.update(contratoId, {
      ...data,
      valor_inicial: Number(data.valor_inicial),
      prazo_dias: data.prazo_dias ? Number(data.prazo_dias) : null
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      toast.success('Contrato atualizado!');
      window.location.href = createPageUrl('Contratos');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (contratoId) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.history.back()}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-white">
          {contratoId ? 'Editar Contrato' : 'Novo Contrato'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Dados do Contrato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Número do Contrato *</Label>
                <Input
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  required
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Tipo</Label>
                <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                  <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="empreitada">Empreitada</SelectItem>
                    <SelectItem value="fornecimento">Fornecimento</SelectItem>
                    <SelectItem value="prestacao_servico">Prestação de Serviço</SelectItem>
                    <SelectItem value="subcontratacao">Subcontratação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-400">Obra Associada</Label>
                <Select value={formData.obra_id} onValueChange={(v) => setFormData({ ...formData, obra_id: v })}>
                  <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Selecione a obra" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {obras.map(obra => (
                      <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-400">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="vigente">Vigente</SelectItem>
                    <SelectItem value="suspenso">Suspenso</SelectItem>
                    <SelectItem value="encerrado">Encerrado</SelectItem>
                    <SelectItem value="rescindido">Rescindido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-400">Contratante *</Label>
                <Input
                  value={formData.contratante}
                  onChange={(e) => setFormData({ ...formData, contratante: e.target.value })}
                  required
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Contratado *</Label>
                <Input
                  value={formData.contratado}
                  onChange={(e) => setFormData({ ...formData, contratado: e.target.value })}
                  required
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-gray-400">Objeto/Escopo do Contrato</Label>
                <Textarea
                  value={formData.objeto}
                  onChange={(e) => setFormData({ ...formData, objeto: e.target.value })}
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                  rows={3}
                />
              </div>
              <div>
                <Label className="text-gray-400">Valor Inicial (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.valor_inicial}
                  onChange={(e) => setFormData({ ...formData, valor_inicial: e.target.value })}
                  required
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Prazo (dias)</Label>
                <Input
                  type="number"
                  value={formData.prazo_dias}
                  onChange={(e) => setFormData({ ...formData, prazo_dias: e.target.value })}
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Data Assinatura *</Label>
                <Input
                  type="date"
                  value={formData.data_assinatura}
                  onChange={(e) => setFormData({ ...formData, data_assinatura: e.target.value })}
                  required
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Data Início</Label>
                <Input
                  type="date"
                  value={formData.data_inicio}
                  onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Data Fim Prevista</Label>
                <Input
                  type="date"
                  value={formData.data_fim_prevista}
                  onChange={(e) => setFormData({ ...formData, data_fim_prevista: e.target.value })}
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.location.href = createPageUrl('Contratos')}
            className="border-gray-700 text-gray-400"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="bg-amber-500 hover:bg-amber-600 text-gray-900 gap-2"
          >
            <Save className="w-4 h-4" />
            Salvar
          </Button>
        </div>
      </form>
    </div>
  );
}
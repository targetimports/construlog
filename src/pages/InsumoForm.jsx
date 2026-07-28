import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

const unidades = [
  { value: 'm', label: 'Metro' },
  { value: 'm2', label: 'Metro Quadrado' },
  { value: 'm3', label: 'Metro Cúbico' },
  { value: 'un', label: 'Unidade' },
  { value: 'kg', label: 'Quilograma' },
  { value: 'l', label: 'Litro' },
  { value: 'sc', label: 'Saco' },
  { value: 'cx', label: 'Caixa' },
  { value: 'h', label: 'Hora' },
  { value: 'dia', label: 'Dia' },
  { value: 'mes', label: 'Mês' },
  { value: 't', label: 'Tonelada' },
  { value: 'vb', label: 'Viagem' }
];

const grupos = [
  { value: 'material', label: 'Material' },
  { value: 'mao_obra', label: 'Mão de Obra' },
  { value: 'equipamento', label: 'Equipamento' },
  { value: 'servico', label: 'Serviço' },
  { value: 'outros', label: 'Outros' }
];

const bases = [
  { value: 'sinapi', label: 'SINAPI' },
  { value: 'propria', label: 'Base Própria' },
  { value: 'fornecedor', label: 'Fornecedor' }
];

export default function InsumoForm() {
  const [formData, setFormData] = useState({
    codigo: '',
    descricao: '',
    unidade: 'un',
    grupo: 'material',
    tipo: 'material',
    base: 'propria',
    preco_unitario: '',
    data_preco: new Date().toISOString().split('T')[0],
    ativo: true,
    salario: '',
    encargos_percentual: '',
    beneficios: '',
    observacoes: ''
  });

  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const insumoId = urlParams.get('id');
  const isEditing = !!insumoId;

  const { data: insumoData } = useQuery({
    queryKey: ['insumo', insumoId],
    queryFn: () => base44.entities.Insumo.get(insumoId),
    enabled: isEditing,
    onSuccess: (data) => {
      setFormData(data);
    }
  });

  const { mutate: saveInsumo, isPending } = useMutation({
    mutationFn: async (data) => {
      // Calcular custo total para mão de obra
      if (data.grupo === 'mao_obra') {
        const salario = parseFloat(data.salario) || 0;
        const encargos = parseFloat(data.encargos_percentual) || 0;
        const beneficios = parseFloat(data.beneficios) || 0;
        data.custo_total_mao_obra = salario + (salario * (encargos / 100)) + beneficios;
        data.preco_unitario = data.custo_total_mao_obra;
      }

      if (isEditing) {
        return base44.entities.Insumo.update(insumoId, data);
      } else {
        return base44.entities.Insumo.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      toast.success(isEditing ? 'Insumo atualizado com sucesso' : 'Insumo criado com sucesso');
      window.location.href = createPageUrl('Insumos');
    },
    onError: (error) => {
      toast.error('Erro ao salvar insumo: ' + error.message);
    }
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
      tipo: name === 'grupo' ? value : prev.tipo
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.codigo || !formData.descricao) {
      toast.error('Código e descrição são obrigatórios');
      return;
    }

    saveInsumo(formData);
  };

  const isMaoObra = formData.grupo === 'mao_obra';
  const custo_total_mao_obra = isMaoObra
    ? (parseFloat(formData.salario) || 0) + 
      ((parseFloat(formData.salario) || 0) * (parseFloat(formData.encargos_percentual) || 0) / 100) + 
      (parseFloat(formData.beneficios) || 0)
    : null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEditing ? 'Editar Insumo' : 'Novo Insumo'}
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Seção Básica */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="codigo">Código *</Label>
                  <Input
                    id="codigo"
                    name="codigo"
                    value={formData.codigo}
                    onChange={handleChange}
                    placeholder="Ex: MAT-001"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="unidade">Unidade *</Label>
                  <Select value={formData.unidade} onValueChange={(value) => handleSelectChange('unidade', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unidades.map(u => (
                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="descricao">Descrição *</Label>
                <Input
                  id="descricao"
                  name="descricao"
                  value={formData.descricao}
                  onChange={handleChange}
                  placeholder="Descreva o insumo"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="grupo">Grupo *</Label>
                  <Select value={formData.grupo} onValueChange={(value) => handleSelectChange('grupo', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {grupos.map(g => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="base">Base de Preço *</Label>
                  <Select value={formData.base} onValueChange={(value) => handleSelectChange('base', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {bases.map(b => (
                        <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <input
                    type="checkbox"
                    id="ativo"
                    name="ativo"
                    checked={formData.ativo}
                    onChange={handleChange}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="ativo" className="mb-0">Ativo</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seção Preços */}
          {!isMaoObra && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Preço</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="preco_unitario">Custo Unitário (R$) *</Label>
                    <Input
                      id="preco_unitario"
                      name="preco_unitario"
                      type="number"
                      step="0.01"
                      value={formData.preco_unitario}
                      onChange={handleChange}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="data_preco">Data do Preço</Label>
                    <Input
                      id="data_preco"
                      name="data_preco"
                      type="date"
                      value={formData.data_preco}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Seção Mão de Obra */}
          {isMaoObra && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Cálculo de Mão de Obra</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="salario">Salário (R$) *</Label>
                    <Input
                      id="salario"
                      name="salario"
                      type="number"
                      step="0.01"
                      value={formData.salario}
                      onChange={handleChange}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="encargos_percentual">Encargos (%)</Label>
                    <Input
                      id="encargos_percentual"
                      name="encargos_percentual"
                      type="number"
                      step="0.01"
                      value={formData.encargos_percentual}
                      onChange={handleChange}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="beneficios">Benefícios (R$)</Label>
                    <Input
                      id="beneficios"
                      name="beneficios"
                      type="number"
                      step="0.01"
                      value={formData.beneficios}
                      onChange={handleChange}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {custo_total_mao_obra !== null && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-blue-900">
                      Total (Custo Unitário): R$ {custo_total_mao_obra.toFixed(2)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Observações */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                name="observacoes"
                value={formData.observacoes}
                onChange={handleChange}
                placeholder="Adicione notas sobre este insumo..."
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Ações */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" asChild>
              <a href={createPageUrl('Insumos')}>Cancelar</a>
            </Button>
            <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
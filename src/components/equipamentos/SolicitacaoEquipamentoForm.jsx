import React, { useState } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SolicitacaoEquipamentoForm({ 
  obras, 
  equipamentos, 
  fornecedores,
  onSubmit, 
  isLoading, 
  onCancel 
}) {
  const [formData, setFormData] = useState({
    obra_id: '',
    tipo_solicitacao: 'proprio',
    equipamento_id: '',
    data_inicio: '',
    data_fim: '',
    motivo: '',
    prioridade: 'media',
    descricao_aluguel: '',
    fornecedor_aluguel_id: '',
    valor_estimado_aluguel: '',
    quantidade_aluguel: '',
    unidade_aluguel: 'dia',
    observacoes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.obra_id || !formData.data_inicio || !formData.data_fim || !formData.motivo) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    if (formData.tipo_solicitacao === 'proprio' && !formData.equipamento_id) {
      alert('Selecione um equipamento próprio');
      return;
    }

    if (formData.tipo_solicitacao === 'aluguel') {
      if (!formData.descricao_aluguel || !formData.valor_estimado_aluguel || !formData.quantidade_aluguel) {
        alert('Preencha todos os dados do aluguel');
        return;
      }
    }

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* SEÇÃO 1: Informações Básicas */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700">Informações da Solicitação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-gray-900">Obra *</Label>
              <Select value={formData.obra_id} onValueChange={(v) => setFormData({ ...formData, obra_id: v })}>
                <SelectTrigger className="mt-2 h-9">
                  <SelectValue placeholder="Selecione uma obra" />
                </SelectTrigger>
                <SelectContent>
                  {obras.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-900">Tipo de Solicitação *</Label>
              <Select value={formData.tipo_solicitacao} onValueChange={(v) => setFormData({ ...formData, tipo_solicitacao: v })}>
                <SelectTrigger className="mt-2 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="proprio">Equipamento Próprio</SelectItem>
                  <SelectItem value="aluguel">Alugar de Terceiros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 2: Equipamento Próprio */}
      {formData.tipo_solicitacao === 'proprio' && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-blue-900">Selecionar Equipamento Próprio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs font-semibold text-gray-900">Equipamento *</Label>
              <Select value={formData.equipamento_id} onValueChange={(v) => setFormData({ ...formData, equipamento_id: v })}>
                <SelectTrigger className="mt-2 h-9">
                  <SelectValue placeholder="Selecione um equipamento disponível" />
                </SelectTrigger>
                <SelectContent>
                  {equipamentos.map(eq => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.nome} ({eq.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SEÇÃO 2: Aluguel */}
      {formData.tipo_solicitacao === 'aluguel' && (
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-amber-900">Detalhes do Aluguel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-gray-900">Descrição do Equipamento *</Label>
              <Input
                value={formData.descricao_aluguel}
                onChange={(e) => setFormData({ ...formData, descricao_aluguel: e.target.value })}
                placeholder="Ex: Escavadeira CAT 320"
                className="mt-2 h-9"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-gray-900">Fornecedor</Label>
                <Select value={formData.fornecedor_aluguel_id} onValueChange={(v) => setFormData({ ...formData, fornecedor_aluguel_id: v })}>
                  <SelectTrigger className="mt-2 h-9">
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {fornecedores.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-900">Valor Estimado (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.valor_estimado_aluguel}
                  onChange={(e) => setFormData({ ...formData, valor_estimado_aluguel: e.target.value })}
                  placeholder="0.00"
                  className="mt-2 h-9"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-gray-900">Quantidade *</Label>
                <Input
                  type="number"
                  value={formData.quantidade_aluguel}
                  onChange={(e) => setFormData({ ...formData, quantidade_aluguel: e.target.value })}
                  placeholder="Ex: 5"
                  className="mt-2 h-9"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-900">Unidade *</Label>
                <Select value={formData.unidade_aluguel} onValueChange={(v) => setFormData({ ...formData, unidade_aluguel: v })}>
                  <SelectTrigger className="mt-2 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dia">Dias</SelectItem>
                    <SelectItem value="mes">Meses</SelectItem>
                    <SelectItem value="hora">Horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SEÇÃO 3: Período */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700">Período de Utilização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-gray-900">Data de Início *</Label>
              <Input
                type="date"
                value={formData.data_inicio}
                onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                className="mt-2 h-9"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-900">Data de Fim *</Label>
              <Input
                type="date"
                value={formData.data_fim}
                onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                className="mt-2 h-9"
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 4: Motivo e Prioridade */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700">Detalhes Adicionais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-gray-900">Motivo da Solicitação *</Label>
            <Input
              value={formData.motivo}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              placeholder="Ex: Escavação de fundações"
              className="mt-2 h-9"
              required
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-gray-900">Prioridade *</Label>
            <Select value={formData.prioridade} onValueChange={(v) => setFormData({ ...formData, prioridade: v })}>
              <SelectTrigger className="mt-2 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="critica">Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold text-gray-900">Observações</Label>
            <Input
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Informações adicionais"
              className="mt-2 h-9"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Enviando...' : 'Enviar Solicitação'}
        </Button>
      </div>
    </form>
  );
}
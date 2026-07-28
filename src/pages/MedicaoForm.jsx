import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import { 
  ArrowLeft, 
  Save, 
  Plus,
  Trash2,
  Calculator
} from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function MedicaoForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const medicaoId = urlParams.get('id');
  const limpaParam = (v) => (v && v !== 'undefined' && v !== 'null' ? v : '');
  const obraIdUrl = limpaParam(urlParams.get('obra_id'));
  const orcamentoIdUrl = limpaParam(urlParams.get('orcamento_id'));
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    obra_id: obraIdUrl,
    orcamento_id: orcamentoIdUrl,
    numero: '',
    periodo_inicio: '',
    periodo_fim: '',
    data_medicao: '', // Nova obrigatória
    responsavel_email: '', // Renomeado de responsavel_medicao
    contrato_id: '', // Nova obrigatória
    observacoes: ''
  });

  const [itens, setItens] = useState([]);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: usuarioLogado } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me()
  });

  // Contratos da obra selecionada (campo Contrato é opcional).
  const { data: contratos = [] } = useQuery({
    queryKey: ['contratos-obra', formData?.obra_id],
    queryFn: () => base44.entities.Contrato.filter({ obra_id: formData.obra_id }),
    enabled: !!formData?.obra_id
  });

  const { data: medicao } = useQuery({
    queryKey: ['medicao', medicaoId],
    queryFn: () => base44.entities.Medicao.filter({ id: medicaoId }),
    enabled: !!medicaoId
  });

  const { data: itensMedicao = [] } = useQuery({
    queryKey: ['itens-medicao', medicaoId],
    queryFn: () => base44.entities.ItemMedicao.filter({ medicao_id: medicaoId }),
    enabled: !!medicaoId
  });

  useEffect(() => {
    if (medicao && medicao.length > 0) {
      const m = medicao[0];
      setFormData({
        obra_id: m.obra_id || '',
        orcamento_id: m.orcamento_id || orcamentoIdUrl,
        numero: m.numero || '',
        periodo_inicio: m.periodo_inicio || '',
        periodo_fim: m.periodo_fim || '',
        data_medicao: m.data_medicao || '',
        responsavel_email: m.responsavel_email || '',
        contrato_id: m.contrato_id || '',
        observacoes: m.observacoes || ''
      });
    }
  }, [medicao]);

  useEffect(() => {
    if (itensMedicao.length > 0) {
      setItens(itensMedicao);
    }
  }, [itensMedicao]);

  // Pré-preenche responsável (usuário logado) e data da medição (hoje) ao criar.
  useEffect(() => {
    if (medicaoId) return;
    setFormData((prev) => ({
      ...prev,
      responsavel_email: prev.responsavel_email || usuarioLogado?.email || '',
      data_medicao: prev.data_medicao || new Date().toISOString().split('T')[0],
    }));
  }, [usuarioLogado, medicaoId]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      
      // Calcular totais
      const valorTotal = itens.reduce((acc, item) => acc + (item.valor_periodo || 0), 0);
      const obra = obras.find(o => o.id === data.obra_id);
      const valorOrcado = obra?.valor_orcado || obra?.total_orcamento || obra?.valor_contrato || 1;
      const percentualPeriodo = (valorTotal / valorOrcado) * 100;
      
      // Buscar medição anterior para calcular acumulado
      const medicoesAnteriores = await base44.entities.Medicao.filter(
        { obra_id: data.obra_id, status: 'aprovada' },
        '-created_date',
        1
      );
      const percentualAnterior = medicoesAnteriores.length > 0 
        ? medicoesAnteriores[0].percentual_fisico_acumulado || 0 
        : 0;
      const valorAnterior = medicoesAnteriores.length > 0
        ? medicoesAnteriores[0].valor_acumulado || 0
        : 0;

      const novaMedicao = await base44.entities.Medicao.create({
        ...data,
        orcamento_id: data.orcamento_id || null,
        contrato_id: data.contrato_id || null,
        percentual_fisico_anterior: percentualAnterior,
        percentual_fisico_periodo: percentualPeriodo,
        percentual_fisico_acumulado: percentualAnterior + percentualPeriodo,
        valor_medido: valorTotal,
        valor_acumulado: valorAnterior + valorTotal,
        responsavel_email: data.responsavel_email || user.email,
        status: 'rascunho'
      });

      // Criar itens
      for (const item of itens) {
        await base44.entities.ItemMedicao.create({
          ...item,
          medicao_id: novaMedicao.id
        });
      }

      return novaMedicao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicoes'] });
      toast.success('Medição criada!');
      window.location.href = createPageUrl('Medicoes');
    },
    onError: (error) => {
      toast.error('Erro ao criar medição: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      // Atualizar medição
      const valorTotal = itens.reduce((acc, item) => acc + (item.valor_periodo || 0), 0);
      const obra = obras.find(o => o.id === data.obra_id);
      const valorOrcado = obra?.valor_orcado || obra?.total_orcamento || obra?.valor_contrato || 1;
      const percentualPeriodo = (valorTotal / valorOrcado) * 100;
      
      const medicaoAtual = medicao[0];
      const percentualAnterior = medicaoAtual.percentual_fisico_anterior || 0;
      const valorAnterior = medicaoAtual.valor_acumulado - medicaoAtual.valor_medido;

      await base44.entities.Medicao.update(medicaoId, {
        ...data,
        percentual_fisico_periodo: percentualPeriodo,
        percentual_fisico_acumulado: percentualAnterior + percentualPeriodo,
        valor_medido: valorTotal,
        valor_acumulado: valorAnterior + valorTotal
      });

      // Deletar itens antigos e criar novos
      for (const item of itensMedicao) {
        await base44.entities.ItemMedicao.delete(item.id);
      }
      
      for (const item of itens) {
        await base44.entities.ItemMedicao.create({
          ...item,
          medicao_id: medicaoId
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicoes'] });
      queryClient.invalidateQueries({ queryKey: ['medicao', medicaoId] });
      toast.success('Medição atualizada!');
      window.location.href = createPageUrl('Medicoes');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar medição: ' + error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.obra_id) {
      toast.error('Selecione uma obra');
      return;
    }
    if (itens.length === 0) {
      toast.error('Adicione pelo menos um item à medição');
      return;
    }

    if (medicaoId) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const addItem = () => {
    setItens([...itens, {
      descricao: '',
      unidade: 'm2',
      quantidade_prevista: 0,
      quantidade_anterior: 0,
      quantidade_periodo: 0,
      quantidade_acumulada: 0,
      valor_unitario: 0,
      valor_periodo: 0,
      percentual_executado: 0
    }]);
  };

  const removeItem = (index) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const newItens = [...itens];
    newItens[index][field] = value;
    
    // Calcular campos automaticamente
    const item = newItens[index];
    if (field === 'quantidade_periodo') {
      item.quantidade_acumulada = (item.quantidade_anterior || 0) + parseFloat(value || 0);
      item.valor_periodo = parseFloat(value || 0) * (item.valor_unitario || 0);
      item.percentual_executado = item.quantidade_prevista > 0 
        ? (item.quantidade_acumulada / item.quantidade_prevista) * 100 
        : 0;
    }
    
    if (field === 'valor_unitario' && item.quantidade_periodo) {
      item.valor_periodo = (item.quantidade_periodo || 0) * parseFloat(value || 0);
    }

    setItens(newItens);
  };

  const valorTotal = itens.reduce((acc, item) => acc + (item.valor_periodo || 0), 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen rounded-lg">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.history.back()}
          className="text-slate-600 hover:text-slate-900 hover:bg-slate-200"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-4xl font-bold text-slate-900">
            {medicaoId ? 'Editar Medição' : 'Nova Medição'}
          </h1>
          <p className="text-slate-600 text-base">Preencha os dados da medição e seus itens</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados da Medição */}
        <Card className="bg-white border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-slate-900 text-2xl">Dados da Medição</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-slate-700 font-semibold text-base">Obra *</Label>
                <Select value={formData.obra_id} onValueChange={(v) => setFormData({ ...formData, obra_id: v })}>
                  <SelectTrigger className="mt-2 bg-white border-slate-300 text-slate-900 h-11">
                    <SelectValue placeholder="Selecione a obra" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-300">
                    {obras.filter(o => o.status !== 'concluida' && o.status !== 'cancelada').map(obra => (
                      <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-700 font-semibold text-base">Contrato</Label>
                {contratos.length > 0 ? (
                  <Select value={formData.contrato_id} onValueChange={(v) => setFormData({ ...formData, contrato_id: v })}>
                    <SelectTrigger className="mt-2 bg-white border-slate-300 text-slate-900 h-11">
                      <SelectValue placeholder="Selecione o contrato (opcional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-300">
                      {contratos.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.numero || c.titulo || c.id.slice(0, 8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={formData.contrato_id}
                    onChange={(e) => setFormData({ ...formData, contrato_id: e.target.value })}
                    placeholder="Nº do contrato (opcional)"
                    className="mt-2 bg-white border-slate-300 text-slate-900 text-base h-11"
                  />
                )}
              </div>
              <div>
                <Label className="text-slate-700 font-semibold text-base">Número da Medição *</Label>
                <Input
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  required
                  placeholder="Ex: 001/2026"
                  className="mt-2 bg-white border-slate-300 text-slate-900 text-base h-11"
                />
              </div>
              <div>
                <Label className="text-slate-700 font-semibold text-base">Período Início *</Label>
                <Input
                  type="date"
                  value={formData.periodo_inicio}
                  onChange={(e) => setFormData({ ...formData, periodo_inicio: e.target.value })}
                  required
                  className="mt-2 bg-white border-slate-300 text-slate-900 text-base h-11"
                />
              </div>
              <div>
               <Label className="text-slate-700 font-semibold text-base">Período Fim *</Label>
               <Input
                 type="date"
                 value={formData.periodo_fim}
                 onChange={(e) => setFormData({ ...formData, periodo_fim: e.target.value })}
                 required
                 className="mt-2 bg-white border-slate-300 text-slate-900 text-base h-11"
               />
              </div>
              <div>
               <Label className="text-slate-700 font-semibold text-base">Data da Medição *</Label>
               <Input
                 type="date"
                 value={formData.data_medicao}
                 onChange={(e) => setFormData({ ...formData, data_medicao: e.target.value })}
                 required
                 className="mt-2 bg-white border-slate-300 text-slate-900 text-base h-11"
               />
              </div>
              <div>
               <Label className="text-slate-700 font-semibold text-base">Responsável Email *</Label>
               <Input
                 type="email"
                 value={formData.responsavel_email}
                 onChange={(e) => setFormData({ ...formData, responsavel_email: e.target.value })}
                 required
                 placeholder="email@example.com"
                 className="mt-2 bg-white border-slate-300 text-slate-900 text-base h-11"
               />
              </div>
              <div className="md:col-span-2">
                <Label className="text-slate-700 font-semibold text-base">Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="mt-2 bg-white border-slate-300 text-slate-900 text-base"
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Itens da Medição */}
        <Card className="bg-white border-slate-200 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200">
            <CardTitle className="text-slate-900 text-2xl">Itens Medidos</CardTitle>
            <Button
              type="button"
              size="sm"
              onClick={addItem}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Item
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            {itens.length === 0 ? (
              <div className="text-center py-12">
                <Calculator className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 mb-4 text-lg">Nenhum item adicionado</p>
                <Button
                  type="button"
                  size="sm"
                  onClick={addItem}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Primeiro Item
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 bg-slate-50">
                      <TableHead className="text-slate-700 font-bold text-sm">Descrição</TableHead>
                      <TableHead className="text-slate-700 font-bold text-sm">Un</TableHead>
                      <TableHead className="text-slate-700 font-bold text-sm text-right">Qtd Prev</TableHead>
                      <TableHead className="text-slate-700 font-bold text-sm text-right">Qtd Ant</TableHead>
                      <TableHead className="text-slate-700 font-bold text-sm text-right">Qtd Período</TableHead>
                      <TableHead className="text-slate-700 font-bold text-sm text-right">Valor Un</TableHead>
                      <TableHead className="text-slate-700 font-bold text-sm text-right">Valor Total</TableHead>
                      <TableHead className="text-slate-700 font-bold text-sm text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((item, index) => (
                      <TableRow key={index} className="border-slate-200 hover:bg-slate-50">
                        <TableCell>
                          <Input
                            value={item.descricao}
                            onChange={(e) => updateItem(index, 'descricao', e.target.value)}
                            placeholder="Descrição do item"
                            className="bg-white border-slate-300 text-slate-900 text-sm h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.unidade}
                            onChange={(e) => updateItem(index, 'unidade', e.target.value)}
                            placeholder="m2"
                            className="bg-white border-slate-300 text-slate-900 text-sm h-9 w-16"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantidade_prevista}
                            onChange={(e) => updateItem(index, 'quantidade_prevista', e.target.value)}
                            className="bg-white border-slate-300 text-slate-900 text-sm h-9 text-right w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantidade_anterior}
                            onChange={(e) => updateItem(index, 'quantidade_anterior', e.target.value)}
                            className="bg-white border-slate-300 text-slate-900 text-sm h-9 text-right w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantidade_periodo}
                            onChange={(e) => updateItem(index, 'quantidade_periodo', e.target.value)}
                            className="bg-white border-slate-300 text-slate-900 text-sm h-9 text-right w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.valor_unitario}
                            onChange={(e) => updateItem(index, 'valor_unitario', e.target.value)}
                            className="bg-white border-slate-300 text-slate-900 text-sm h-9 text-right w-28"
                          />
                        </TableCell>
                        <TableCell className="text-slate-900 text-right font-bold text-sm">
                          {(item.valor_periodo || 0).toLocaleString('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL' 
                          })}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumo */}
        {itens.length > 0 && (
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300 shadow-lg">
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <span className="text-slate-700 text-lg font-semibold">Valor Total da Medição</span>
                <span className="text-blue-600 text-4xl font-bold">
                  {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ações */}
        <div className="flex justify-end gap-4 pt-6 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.location.href = createPageUrl('Medicoes')}
            className="border-slate-300 text-slate-700 hover:bg-slate-100 text-base h-11"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 text-base h-11 font-semibold"
          >
            <Save className="w-4 h-4" />
            {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar Medição'}
          </Button>
        </div>
      </form>
    </div>
  );
}
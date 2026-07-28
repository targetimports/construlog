import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Calendar,
  CreditCard,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import PagamentoContaModal from '../financeiro/PagamentoContaModal';

export default function GestaoFinanceiraObra({ obraId, obraNome, user }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showPrevisao, setShowPrevisao] = useState(false);
  const [showProjecao, setShowProjecao] = useState(false);
  const [tipoFiltro, setTipoFiltro] = useState('todas');
  const [statusFiltro, setStatusFiltro] = useState('todas');
  const [pagamentoModal, setPagamentoModal] = useState({ open: false, conta: null });

  const [formData, setFormData] = useState({
    tipo: 'pagar',
    descricao: '',
    valor: '',
    data_vencimento: '',
    categoria: 'material',
    fornecedor_cliente: '',
    nota_fiscal: '',
    observacao: ''
  });

  // Buscar contas da obra
  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['contas-obra', obraId],
    queryFn: () => base44.entities.ContaFinanceira.filter({ obra_id: obraId })
  });

  // Buscar obra
  const { data: obras = [] } = useQuery({
    queryKey: ['obra', obraId],
    queryFn: () => base44.entities.Obra.filter({ id: obraId })
  });
  const obra = obras[0];

  // Buscar medições da obra
  const { data: medicoes = [] } = useQuery({
    queryKey: ['medicoes-obra', obraId],
    queryFn: () => base44.entities.Medicao.filter({ obra_id: obraId })
  });

  // Buscar demandas para projeção
  const { data: demandas = [] } = useQuery({
    queryKey: ['demandas-projecao', obraId],
    queryFn: () => base44.entities.DemandaEstoqueObra.filter({ obra_id: obraId }),
    enabled: !!obraId
  });

  // Previsão de saldo com IA
  const { data: previsaoIA, refetch: refetchPrevisao } = useQuery({
    queryKey: ['previsao-saldo-obra', obraId],
    queryFn: async () => {
      const response = await base44.functions.invoke('preverSaldoObraIA', {
        obra_id: obraId,
        contas: contas,
        medicoes: medicoes,
        obra: obra
      });
      return response.data;
    },
    enabled: false
  });

  // Criar conta
  const createContaMutation = useMutation({
    mutationFn: (data) => base44.entities.ContaFinanceira.create({
      ...data,
      obra_id: obraId,
      status: 'pendente',
      valor: Number(data.valor)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['contas-obra', obraId]);
      toast.success('Conta cadastrada com sucesso!');
      setDialogOpen(false);
      resetForm();
    }
  });

  // Atualizar status da conta
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, data_pagamento }) => 
      base44.entities.ContaFinanceira.update(id, { 
        status, 
        data_pagamento: status === 'pago' ? data_pagamento || new Date().toISOString().split('T')[0] : null 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['contas-obra', obraId]);
      toast.success('Status atualizado!');
    }
  });

  const resetForm = () => {
    setFormData({
      tipo: 'pagar',
      descricao: '',
      valor: '',
      data_vencimento: '',
      categoria: 'material',
      fornecedor_cliente: '',
      nota_fiscal: '',
      observacao: ''
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createContaMutation.mutate(formData);
  };

  const handleGerarPrevisao = () => {
    setShowPrevisao(true);
    refetchPrevisao();
  };

  // Filtrar contas
  const contasFiltradas = contas.filter(conta => {
    const matchTipo = tipoFiltro === 'todas' || conta.tipo === tipoFiltro;
    const matchStatus = statusFiltro === 'todas' || conta.status === statusFiltro;
    return matchTipo && matchStatus;
  });

  // Calcular totais
  const totalPagar = contas
    .filter(c => c.tipo === 'pagar' && c.status === 'pendente')
    .reduce((sum, c) => sum + (c.valor || 0), 0);

  const totalReceber = contas
    .filter(c => c.tipo === 'receber' && c.status === 'pendente')
    .reduce((sum, c) => sum + (c.valor || 0), 0);

  const totalPago = contas
    .filter(c => c.tipo === 'pagar' && c.status === 'pago')
    .reduce((sum, c) => sum + (c.valor || 0), 0);

  const totalRecebido = contas
    .filter(c => c.tipo === 'receber' && c.status === 'pago')
    .reduce((sum, c) => sum + (c.valor || 0), 0);

  const saldoAtual = totalRecebido - totalPago;
  const saldoPrevisto = saldoAtual + totalReceber - totalPagar;

  // Projeção baseada em demandas (planejado)
  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos-projecao'],
    queryFn: () => base44.entities.Insumo.list('-preco_unitario', 1000)
  });

  const custoProjetadoMateriais = demandas.reduce((sum, d) => {
    const insumo = insumos.find(i => i.id === d.insumo_id);
    return sum + (d.quantidade_prevista * (insumo?.preco_unitario || 0));
  }, 0);

  const getStatusBadge = (status) => {
    const config = {
      pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      pago: { label: 'Pago', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
      atrasado: { label: 'Atrasado', color: 'bg-red-100 text-red-800', icon: AlertCircle }
    };
    const { label, color, icon: Icon } = config[status] || config.pendente;
    return (
      <Badge className={cn('gap-1', color)}>
        <Icon className="w-3 h-3" />
        {label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPIs Financeiros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">A Pagar</p>
              <ArrowDownRight className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">
              R$ {totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">A Receber</p>
              <ArrowUpRight className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">
              R$ {totalReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Saldo Atual</p>
              <Wallet className="w-4 h-4 text-blue-500" />
            </div>
            <p className={cn(
              "text-2xl font-bold",
              saldoAtual >= 0 ? "text-blue-600" : "text-red-600"
            )}>
              R$ {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Saldo Previsto</p>
              <TrendingUp className="w-4 h-4 text-purple-500" />
            </div>
            <p className={cn(
              "text-2xl font-bold",
              saldoPrevisto >= 0 ? "text-purple-600" : "text-red-600"
            )}>
              R$ {saldoPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ações e Filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Contas Financeiras</CardTitle>
              <CardDescription>Gerencie contas a pagar e receber da obra</CardDescription>
            </div>
            <div className="flex gap-2">
              {custoProjetadoMateriais > 0 && (
                <Button 
                  variant="outline" 
                  onClick={() => setShowProjecao(!showProjecao)}
                  className="gap-2"
                >
                  <TrendingUp className="w-4 h-4" />
                  {showProjecao ? 'Ocultar' : 'Mostrar'} Projeção
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={handleGerarPrevisao}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Previsão IA
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Nova Conta
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Cadastrar Conta Financeira</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Tipo *</Label>
                        <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pagar">Conta a Pagar</SelectItem>
                            <SelectItem value="receber">Conta a Receber</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Categoria *</Label>
                        <Select value={formData.categoria} onValueChange={(v) => setFormData({ ...formData, categoria: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="material">Material</SelectItem>
                            <SelectItem value="mao_de_obra">Mão de Obra</SelectItem>
                            <SelectItem value="equipamento">Equipamento</SelectItem>
                            <SelectItem value="transporte">Transporte</SelectItem>
                            <SelectItem value="servico">Serviço</SelectItem>
                            <SelectItem value="medicao">Medição</SelectItem>
                            <SelectItem value="imposto">Imposto</SelectItem>
                            <SelectItem value="outros">Outros</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label>Descrição *</Label>
                      <Input
                        value={formData.descricao}
                        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                        placeholder="Ex: Compra de cimento"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Valor (R$) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.valor}
                          onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                          placeholder="0,00"
                          required
                        />
                      </div>
                      <div>
                        <Label>Data de Vencimento *</Label>
                        <Input
                          type="date"
                          value={formData.data_vencimento}
                          onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>{formData.tipo === 'pagar' ? 'Fornecedor' : 'Cliente'}</Label>
                        <Input
                          value={formData.fornecedor_cliente}
                          onChange={(e) => setFormData({ ...formData, fornecedor_cliente: e.target.value })}
                          placeholder="Nome"
                        />
                      </div>
                      <div>
                        <Label>Nota Fiscal</Label>
                        <Input
                          value={formData.nota_fiscal}
                          onChange={(e) => setFormData({ ...formData, nota_fiscal: e.target.value })}
                          placeholder="Número da NF"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Observações</Label>
                      <Textarea
                        value={formData.observacao}
                        onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                        placeholder="Detalhes adicionais"
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={createContaMutation.isPending}>
                        {createContaMutation.isPending ? 'Salvando...' : 'Salvar'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex gap-3">
            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="pagar">A Pagar</SelectItem>
                <SelectItem value="receber">A Receber</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos Status</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="pago">Pagos</SelectItem>
                <SelectItem value="atrasado">Atrasados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lista de Contas */}
          <div className="space-y-2">
            {isLoading ? (
              <p className="text-center text-gray-500 py-8">Carregando...</p>
            ) : contasFiltradas.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Nenhuma conta encontrada</p>
            ) : (
              contasFiltradas.map(conta => (
                <div key={conta.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {conta.tipo === 'pagar' ? (
                          <ArrowDownRight className="w-4 h-4 text-red-500" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-green-500" />
                        )}
                        <h4 className="font-semibold">{conta.descricao}</h4>
                        {getStatusBadge(conta.status)}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Valor</p>
                          <p className={cn(
                            "font-semibold",
                            conta.tipo === 'pagar' ? "text-red-600" : "text-green-600"
                          )}>
                            R$ {conta.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Vencimento</p>
                          <p className="font-medium">{format(new Date(conta.data_vencimento), 'dd/MM/yyyy')}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Categoria</p>
                          <p className="font-medium capitalize">{conta.categoria.replace('_', ' ')}</p>
                        </div>
                        {conta.fornecedor_cliente && (
                          <div>
                            <p className="text-gray-500">{conta.tipo === 'pagar' ? 'Fornecedor' : 'Cliente'}</p>
                            <p className="font-medium">{conta.fornecedor_cliente}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {conta.status === 'pendente' && conta.tipo === 'pagar' && (
                      <Button size="sm" onClick={() => setPagamentoModal({ open: true, conta })}>
                        Pagar
                      </Button>
                    )}
                    {conta.status === 'pendente' && conta.tipo === 'receber' && (
                      <Button
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ id: conta.id, status: 'recebido', data_pagamento: new Date().toISOString().split('T')[0] })}
                        disabled={updateStatusMutation.isPending}
                      >
                        Marcar Recebido
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pagamento pela obra: baixa o caixa + a verba (rota pagarContaPagar) */}
      <PagamentoContaModal
        open={pagamentoModal.open}
        conta={pagamentoModal.conta}
        onClose={() => setPagamentoModal({ open: false, conta: null })}
        onSuccess={() => queryClient.invalidateQueries(['contas-obra', obraId])}
      />

      {/* Projeção Planejada */}
      {showProjecao && custoProjetadoMateriais > 0 && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              Projeção Custo Planejado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Custo Estimado (Materiais Planejados)</p>
              <p className="text-2xl font-bold text-purple-600">
                R$ {custoProjetadoMateriais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Baseado em {demandas.length} materiais com {demandas.reduce((s, d) => s + d.quantidade_prevista, 0).toFixed(0)} unidades planejadas
              </p>
            </div>
            <p className="text-xs text-gray-600 italic">
              Este valor é uma <strong>projeção</strong> baseada no planejado e não representa contas reais ainda lançadas.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Previsão IA */}
      {showPrevisao && previsaoIA && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Previsão de Saldo com IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Próximo Mês</p>
                <p className={cn(
                  "text-xl font-bold",
                  previsaoIA.previsao_30_dias >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  R$ {previsaoIA.previsao_30_dias?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Próximos 3 Meses</p>
                <p className={cn(
                  "text-xl font-bold",
                  previsaoIA.previsao_90_dias >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  R$ {previsaoIA.previsao_90_dias?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Risco Financeiro</p>
                <Badge className={cn(
                  previsaoIA.risco === 'baixo' && "bg-green-100 text-green-800",
                  previsaoIA.risco === 'medio' && "bg-yellow-100 text-yellow-800",
                  previsaoIA.risco === 'alto' && "bg-red-100 text-red-800"
                )}>
                  {previsaoIA.risco === 'baixo' && '✓ Baixo'}
                  {previsaoIA.risco === 'medio' && 'Médio'}
                  {previsaoIA.risco === 'alto' && 'Alto'}
                </Badge>
              </div>
            </div>

            {previsaoIA.recomendacoes && previsaoIA.recomendacoes.length > 0 && (
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-semibold mb-2">Recomendações</h4>
                <ul className="space-y-1 text-sm">
                  {previsaoIA.recomendacoes.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-purple-600">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {previsaoIA.analise && (
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-semibold mb-2">Análise Detalhada</h4>
                <p className="text-sm text-gray-700">{previsaoIA.analise}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
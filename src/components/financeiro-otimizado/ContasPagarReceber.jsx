import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Filter, Download, Bell, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function ContasPagarReceber({ contas, obras }) {
  const [tipo, setTipo] = useState('todos');
  const [status, setStatus] = useState('todos');
  const [obraFiltro, setObraFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [contaSelecionada, setContaSelecionada] = useState(null);
  
  const queryClient = useQueryClient();

  const pagarMutation = useMutation({
    mutationFn: ({ id, data_pagamento }) => 
      base44.entities.ContaFinanceira.update(id, { 
        status: 'pago',
        data_pagamento 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['contas-financeiras']);
      toast.success('Conta marcada como paga!');
      setContaSelecionada(null);
    }
  });

  const enviarLembreteMutation = useMutation({
    mutationFn: async (conta) => {
      const obra = obras.find(o => o.id === conta.obra_id);
      await base44.integrations.Core.SendEmail({
        to: conta.fornecedor_cliente || 'contato@exemplo.com',
        subject: `Lembrete: ${conta.tipo === 'pagar' ? 'Pagamento' : 'Recebimento'} pendente`,
        body: `
          Prezado(a),
          
          Este é um lembrete sobre a conta pendente:
          
          Descrição: ${conta.descricao}
          Valor: ${conta.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          Vencimento: ${new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}
          Obra: ${obra?.nome || 'N/A'}
          
          Atenciosamente,
          Equipe Financeiro
        `
      });
      return conta;
    },
    onSuccess: () => {
      toast.success('Lembrete enviado!');
    }
  });

  // Filtrar contas
  const contasFiltradas = contas.filter(conta => {
    const matchTipo = tipo === 'todos' || conta.tipo === tipo;
    const matchStatus = status === 'todos' || conta.status === status;
    const matchObra = obraFiltro === 'todos' || conta.obra_id === obraFiltro;
    const matchBusca = conta.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
                       conta.fornecedor_cliente?.toLowerCase().includes(busca.toLowerCase());
    
    let matchData = true;
    if (dataInicio) matchData = matchData && new Date(conta.data_vencimento) >= new Date(dataInicio);
    if (dataFim) matchData = matchData && new Date(conta.data_vencimento) <= new Date(dataFim);
    
    return matchTipo && matchStatus && matchObra && matchBusca && matchData;
  });

  // Estatísticas
  const hoje = new Date();
  const vencendoHoje = contasFiltradas.filter(c => 
    c.status === 'pendente' && 
    new Date(c.data_vencimento).toDateString() === hoje.toDateString()
  );
  const vencidas = contasFiltradas.filter(c => 
    c.status === 'pendente' && 
    new Date(c.data_vencimento) < hoje
  );
  const proximos7Dias = contasFiltradas.filter(c => {
    const venc = new Date(c.data_vencimento);
    const dias7 = new Date(hoje);
    dias7.setDate(dias7.getDate() + 7);
    return c.status === 'pendente' && venc > hoje && venc <= dias7;
  });

  const getObra = (id) => obras.find(o => o.id === id);

  const statusConfig = {
    pendente: { label: 'Pendente', color: 'bg-amber-100 text-amber-700', icon: Clock },
    pago: { label: 'Pago', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    atrasado: { label: 'Atrasado', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
    cancelado: { label: 'Cancelado', color: 'bg-gray-100 text-gray-700', icon: XCircle }
  };

  const exportarExcel = async () => {
    try {
      const response = await base44.functions.invoke('exportarContasExcel', {
        contas: contasFiltradas.map(c => ({
          ...c,
          obra_nome: getObra(c.obra_id)?.nome
        }))
      });
      
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contas_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      toast.success('Relatório exportado!');
    } catch (error) {
      toast.error('Erro ao exportar: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cards de Alertas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-600 text-sm font-medium">Vencidas</p>
                <p className="text-2xl font-bold text-red-900 mt-1">{vencidas.length}</p>
                <p className="text-sm mt-1 text-red-700">
                  {vencidas.reduce((s, c) => s + (c.valor || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-600 text-sm font-medium">Vencendo Hoje</p>
                <p className="text-2xl font-bold text-amber-900 mt-1">{vencendoHoje.length}</p>
                <p className="text-sm mt-1 text-amber-700">
                  {vencendoHoje.reduce((s, c) => s + (c.valor || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <Clock className="w-10 h-10 text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Próximos 7 Dias</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{proximos7Dias.length}</p>
                <p className="text-sm mt-1 text-blue-700">
                  {proximos7Dias.reduce((s, c) => s + (c.valor || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <Calendar className="w-10 h-10 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros Avançados
          </CardTitle>
          <Button variant="outline" onClick={exportarExcel} className="gap-2">
            <Download className="w-4 h-4" />
            Exportar Excel
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Input
              placeholder="Buscar..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pagar">A Pagar</SelectItem>
                <SelectItem value="receber">A Receber</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={obraFiltro} onValueChange={setObraFiltro}>
              <SelectTrigger>
                <SelectValue placeholder="Obra" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {obras.map(obra => (
                  <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              placeholder="Data início"
            />
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              placeholder="Data fim"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Contas */}
      <Card>
        <CardHeader>
          <CardTitle>Contas ({contasFiltradas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tipo</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Descrição</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Obra</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Valor</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Vencimento</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {contasFiltradas
                  .sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento))
                  .map(conta => {
                    const obra = getObra(conta.obra_id);
                    const config = statusConfig[conta.status] || statusConfig.pendente;
                    const StatusIcon = config.icon;
                    const vencimento = new Date(conta.data_vencimento);
                    const atrasada = conta.status === 'pendente' && vencimento < hoje;

                    return (
                      <tr key={conta.id} className={`hover:bg-gray-50 ${atrasada ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-3">
                          <Badge variant={conta.tipo === 'pagar' ? 'destructive' : 'default'}>
                            {conta.tipo === 'pagar' ? 'Pagar' : 'Receber'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {conta.descricao}
                          {conta.fornecedor_cliente && (
                            <p className="text-xs text-gray-600">{conta.fornecedor_cliente}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{obra?.nome || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                          {conta.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {vencimento.toLocaleDateString('pt-BR')}
                          {atrasada && (
                            <span className="ml-2 text-xs text-red-600 font-medium">ATRASADA</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${config.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {config.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {conta.status === 'pendente' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setContaSelecionada(conta)}
                                  className="text-green-600 hover:bg-green-50"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => enviarLembreteMutation.mutate(conta)}
                                  disabled={enviarLembreteMutation.isPending}
                                  className="text-blue-600 hover:bg-blue-50"
                                >
                                  <Bell className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Confirmar Pagamento */}
      <Dialog open={!!contaSelecionada} onOpenChange={() => setContaSelecionada(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
          </DialogHeader>
          {contaSelecionada && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Descrição</p>
                <p className="font-medium">{contaSelecionada.descricao}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Valor</p>
                <p className="font-bold text-lg">
                  {contaSelecionada.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Data do Pagamento</label>
                <Input
                  type="date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  onChange={(e) => contaSelecionada.data_pagamento_novo = e.target.value}
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setContaSelecionada(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => pagarMutation.mutate({
                    id: contaSelecionada.id,
                    data_pagamento: contaSelecionada.data_pagamento_novo || new Date().toISOString().split('T')[0]
                  })}
                  disabled={pagarMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirmar Pagamento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
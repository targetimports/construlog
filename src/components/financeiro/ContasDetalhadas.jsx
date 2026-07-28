import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export default function ContasDetalhadas({ contas }) {
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [busca, setBusca] = useState('');

  const contasFiltradas = useMemo(() => {
    return contas.filter(conta => {
      const tipoMatch = filtroTipo === 'todos' || conta.tipo === filtroTipo;
      const statusMatch = filtroStatus === 'todos' || conta.status === filtroStatus;
      const buscaMatch = !busca || conta.descricao.toLowerCase().includes(busca.toLowerCase()) || 
                         conta.fornecedor_cliente?.toLowerCase().includes(busca.toLowerCase());
      return tipoMatch && statusMatch && buscaMatch;
    });
  }, [contas, filtroTipo, filtroStatus, busca]);

  const statusConfig = {
    pendente: { icon: Clock, color: 'bg-amber-100 text-amber-700', label: 'Pendente' },
    pago: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700', label: 'Pago' },
    atrasado: { icon: AlertCircle, color: 'bg-red-100 text-red-700', label: 'Atrasado' },
    cancelado: { icon: AlertCircle, color: 'bg-gray-100 text-gray-700', label: 'Cancelado' },
    parcial: { icon: Clock, color: 'bg-blue-100 text-blue-700', label: 'Parcial' }
  };

  const totalizacao = useMemo(() => {
    return {
      total: contasFiltradas.reduce((acc, c) => acc + c.valor, 0),
      pendente: contasFiltradas.filter(c => c.status === 'pendente').reduce((acc, c) => acc + c.valor, 0),
      pago: contasFiltradas.filter(c => c.status === 'pago').reduce((acc, c) => acc + c.valor, 0),
      atrasado: contasFiltradas.filter(c => c.status === 'atrasado').reduce((acc, c) => acc + c.valor, 0)
    };
  }, [contasFiltradas]);

  const diasParaVencer = (data) => {
    const hoje = new Date();
    const vencimento = new Date(data);
    const diff = Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-sm text-gray-500 block mb-2">Tipo</label>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="bg-white border-gray-300 text-gray-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-300">
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pagar">A Pagar</SelectItem>
              <SelectItem value="receber">A Receber</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm text-gray-500 block mb-2">Status</label>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="bg-white border-gray-300 text-gray-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-300">
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm text-gray-500 block mb-2">Busca</label>
          <Input
            placeholder="Descrição ou fornecedor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="bg-white border-gray-300 text-gray-900"
          />
        </div>
      </div>

      {/* Totalizações */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-4">
            <div className="text-xs text-gray-500 mb-1">Total</div>
            <div className="text-lg font-bold text-gray-900">
              {totalizacao.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="pt-4">
            <div className="text-xs text-amber-600 mb-1">Pendente</div>
            <div className="text-lg font-bold text-amber-600">
              {totalizacao.pendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="pt-4">
            <div className="text-xs text-emerald-600 mb-1">Pago</div>
            <div className="text-lg font-bold text-emerald-600">
              {totalizacao.pago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="pt-4">
            <div className="text-xs text-red-600 mb-1">Atrasado</div>
            <div className="text-lg font-bold text-red-600">
              {totalizacao.atrasado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">{contasFiltradas.length} contas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {contasFiltradas.map((conta, idx) => {
              const config = statusConfig[conta.status] || statusConfig.pendente;
              const Icon = config.icon;
              const diasVencimento = diasParaVencer(conta.data_vencimento);

              return (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between hover:bg-gray-100 transition-all">
                  <div className="flex items-center gap-3 flex-1">
                    <Icon className={`w-4 h-4 ${config.color.split(' ')[1]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-900 text-sm font-medium truncate">{conta.descricao}</div>
                      <div className="text-xs text-gray-500">
                        {conta.fornecedor_cliente} • {new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-3">
                    {diasVencimento < 0 && (
                      <Badge className="bg-red-100 text-red-700 border-0 text-xs">{Math.abs(diasVencimento)} dias atrás</Badge>
                    )}
                    {diasVencimento >= 0 && diasVencimento <= 7 && (
                      <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">{diasVencimento} dias</Badge>
                    )}
                    <Badge className={config.color}>{config.label}</Badge>
                    <div className={`text-sm font-bold ${conta.tipo === 'receber' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {conta.tipo === 'receber' ? '+' : '-'} {conta.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
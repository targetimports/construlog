import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Calendar, Send, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function ControlePagamentos() {
  const [selecionados, setSelecionados] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dataAgendamento, setDataAgendamento] = useState('');
  const queryClient = useQueryClient();

  const { data: contas = [] } = useQuery({
    queryKey: ['contas-financeiras'],
    queryFn: () => base44.entities.ContaFinanceira.list()
  });

  // Planeja uma DATA de pagamento (nota visível na linha). Não é automação — o
  // pagamento continua sendo feito manualmente em Contas a Pagar. Faz todas as
  // contas de uma vez e fecha o diálogo só no fim (antes o forEach fechava no 1º).
  const planejarMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(selecionados.map((id) =>
        base44.entities.ContaFinanceira.update(id, { agendado_para: dataAgendamento, status_agendamento: 'planejado' }),
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-financeiras'] });
      toast.success('Data de pagamento planejada registrada.');
      setSelecionados([]);
      setDialogOpen(false);
      setDataAgendamento('');
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const pagamentosProximos = useMemo(() => {
    const hoje = new Date();
    const proximos30 = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);

    return contas
      .filter(c => 
        c.tipo === 'pagar' && 
        c.status === 'pendente' &&
        new Date(c.data_vencimento) <= proximos30 &&
        new Date(c.data_vencimento) >= hoje
      )
      .sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
  }, [contas]);

  const handleAgendarPagamentos = () => {
    if (selecionados.length === 0) {
      toast.error('Selecione pelo menos um pagamento');
      return;
    }
    setDialogOpen(true);
  };

  const handleConfirmarAgendamento = () => {
    if (!dataAgendamento) {
      toast.error('Selecione uma data');
      return;
    }
    planejarMutation.mutate();
  };

  const toggleSelecionado = (id) => {
    setSelecionados(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>Próximos Pagamentos (30 dias)</CardTitle>
          {selecionados.length > 0 && (
            <Button 
              onClick={handleAgendarPagamentos}
              className="gap-2"
            >
              <Calendar className="w-4 h-4" />
              Planejar data ({selecionados.length})
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {pagamentosProximos.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum pagamento próximo</p>
          ) : (
            <div className="space-y-2">
              {pagamentosProximos.map(conta => {
                const vencimento = new Date(conta.data_vencimento);
                const diasRestantes = Math.ceil((vencimento - new Date()) / (1000 * 60 * 60 * 24));
                const isUrgente = diasRestantes <= 3;

                return (
                  <div key={conta.id} className={`flex items-center gap-3 p-3 rounded-lg border ${isUrgente ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'} hover:bg-gray-100`}>
                    <Checkbox 
                      checked={selecionados.includes(conta.id)}
                      onCheckedChange={() => toggleSelecionado(conta.id)}
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{conta.descricao}</p>
                      <p className="text-sm text-gray-600">{conta.fornecedor_cliente}</p>
                      {conta.agendado_para && (
                        <p className="text-xs text-blue-600 mt-0.5">📅 Pagamento planejado: {new Date(conta.agendado_para + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">{conta.valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      <p className={`text-xs font-medium ${isUrgente ? 'text-red-600' : 'text-gray-500'}`}>
                        {isUrgente ? `${diasRestantes}d` : `${diasRestantes}d`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de agendamento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Planejar data de pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Definindo a data planejada de {selecionados.length} conta(s). É só uma anotação — o pagamento continua sendo feito em Contas a Pagar.</p>
            <input
              type="date"
              value={dataAgendamento}
              onChange={(e) => setDataAgendamento(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleConfirmarAgendamento} disabled={planejarMutation.isPending}>Salvar data</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
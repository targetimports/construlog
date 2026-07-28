import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Calendar, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function ProvisionamentoForm({ contratoId, onSuccess }) {
  const [valorTotal, setValorTotal] = useState('');
  const [numeroParcelas, setNumeroParcelas] = useState(3);
  const [parcelas, setParcelas] = useState([]);
  const queryClient = useQueryClient();

  const { data: contrato } = useQuery({
    queryKey: ['contrato', contratoId],
    queryFn: async () => {
      const contratos = await base44.entities.Contrato.filter({ id: contratoId });
      return contratos[0];
    }
  });

  // Atualizar parcelas quando mudar número
  React.useEffect(() => {
    if (!valorTotal || isNaN(valorTotal)) return;

    const valorParcela = parseFloat(valorTotal) / numeroParcelas;
    const hoje = new Date();
    const novasParcelas = [];

    for (let i = 0; i < numeroParcelas; i++) {
      const data = new Date(hoje);
      data.setMonth(data.getMonth() + i);
      
      novasParcelas.push({
        numero: i + 1,
        valor: valorParcela.toFixed(2),
        data: data.toISOString().split('T')[0]
      });
    }

    setParcelas(novasParcelas);
  }, [valorTotal, numeroParcelas]);

  const atualizarParcela = (idx, campo, valor) => {
    const novas = [...parcelas];
    novas[idx][campo] = valor;
    setParcelas(novas);
  };

  const criarMutation = useMutation({
    mutationFn: async () => {
      return base44.functions.invoke('criarProvisionamentoContrato', {
        contratoId,
        valorTotal: parseFloat(valorTotal),
        numeroParcelas,
        datas: parcelas.map(p => p.data)
      });
    },
    onSuccess: () => {
      toast.success('Provisionamento criado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['contrato', contratoId] });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  return (
    <div className="space-y-4">
      <Alert className="bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-900">
          Provisionamento: compromete o valor total do contrato em parcelas. Sistema bloqueará medições que ultrapassem este valor.
        </p>
      </Alert>

      {/* Valor Total */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div>
            <label className="text-sm font-medium">Valor Total do Contrato</label>
            <Input
              type="number"
              step="0.01"
              value={valorTotal}
              onChange={(e) => setValorTotal(e.target.value)}
              placeholder="33.100,00"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Número de Parcelas</label>
            <Input
              type="number"
              min="1"
              max="12"
              value={numeroParcelas}
              onChange={(e) => setNumeroParcelas(parseInt(e.target.value) || 1)}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Parcelas */}
      {parcelas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Parcelas ({parcelas.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {parcelas.map((parc, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-gray-600">Parcela {parc.numero}</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parc.valor}
                      onChange={(e) => atualizarParcela(idx, 'valor', e.target.value)}
                      className="text-sm h-8 mt-1"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-600">Data</label>
                    <Input
                      type="date"
                      value={parc.data}
                      onChange={(e) => atualizarParcela(idx, 'data', e.target.value)}
                      className="text-sm h-8 mt-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo */}
      {parcelas.length > 0 && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span>Total a Provisionar:</span>
                <span className="font-bold">R$ {parseFloat(valorTotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Valor por Parcela:</span>
                <span className="font-bold">R$ {(parseFloat(valorTotal || 0) / numeroParcelas).toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Button
        onClick={() => criarMutation.mutate()}
        disabled={!valorTotal || criarMutation.isPending || parcelas.length === 0}
        className="w-full gap-2"
      >
        <Save className="w-4 h-4" />
        Criar Provisionamento
      </Button>
    </div>
  );
}
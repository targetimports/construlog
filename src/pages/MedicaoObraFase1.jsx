import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function MedicaoObraFase1() {
  const [searchParams] = useSearchParams();
  const obra_id = searchParams.get('obra_id');
  const queryClient = useQueryClient();

  const { data: medicoes = [] } = useQuery({
    queryKey: ['medicoes', obra_id],
    queryFn: () => base44.entities.MedicaoObra.filter({ obra_id }),
    enabled: !!obra_id
  });

  const { data: orcamentos = [] } = useQuery({
    queryKey: ['orcamentos', obra_id],
    queryFn: () => base44.entities.OrcamentoObra.filter({ obra_id }),
    enabled: !!obra_id
  });

  const criarMedicaoMutation = useMutation({
    mutationFn: (data) => base44.entities.MedicaoObra.create({
      obra_id,
      ...data
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicoes'] });
      toast.success('Medição criada! Adicione itens.');
    }
  });

  const atualizarStatusMutation = useMutation({
    mutationFn: ({ id, status }) => 
      base44.entities.MedicaoObra.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicoes'] });
      toast.success('Status atualizado!');
    }
  });

  if (!obra_id) return <div className="text-center py-12">Obra não selecionada</div>;

  const orcamentoAprovado = orcamentos.find(o => o.status === 'aprovado');

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Medições da Obra</h1>
          <p className="text-gray-600">Medições baseadas no orçamento aprovado</p>
        </div>
        <Button 
          onClick={() => {
            if (!orcamentoAprovado) {
              toast.error('Orçamento aprovado é obrigatório!');
              return;
            }
            const periodo = prompt('Período (ex: 01/2025)');
            if (periodo) {
              criarMedicaoMutation.mutate({
                numero: periodo,
                periodo_inicio: new Date().toISOString().split('T')[0],
                periodo_fim: new Date().toISOString().split('T')[0]
              });
            }
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Medição
        </Button>
      </div>

      {!orcamentoAprovado && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">
              Orçamento aprovado é obrigatório para criar medições. 
              <Button variant="link" size="sm" className="ml-2">Ver orçamentos</Button>
            </p>
          </CardContent>
        </Card>
      )}

      {medicoes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">Nenhuma medição cadastrada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {medicoes.map(med => (
            <Card key={med.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{med.numero}</CardTitle>
                  <p className="text-sm text-gray-600">
                    {med.periodo_inicio} a {med.periodo_fim}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={med.status === 'aprovada' ? 'bg-green-600' : 'bg-blue-600'}>
                    {med.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">Valor Total</p>
                    <p className="text-lg font-bold text-gray-900">
                      R$ {med.valor_total_medido?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Status</p>
                    <p className="text-sm font-semibold">{med.status}</p>
                  </div>
                  <div className="text-right">
                    {med.status === 'rascunho' && (
                      <Button 
                        size="sm"
                        onClick={() => atualizarStatusMutation.mutate({ 
                          id: med.id, 
                          status: 'submetida' 
                        })}
                      >
                        Submeter
                      </Button>
                    )}
                    {med.status === 'submetida' && (
                      <Button 
                        size="sm"
                        onClick={() => atualizarStatusMutation.mutate({ 
                          id: med.id, 
                          status: 'aprovada' 
                        })}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Aprovar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
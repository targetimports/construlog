import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Plus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';

export default function RegrasMedicao() {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [novaRegra, setNovaRegra] = useState({
    obra_id: '',
    nome_regra: '',
    tipo_regra: 'percentual_maximo',
    percentual_maximo_medicao: 100,
    ativo: true
  });
  const queryClient = useQueryClient();

  const { data: regras = [] } = useQuery({
    queryKey: ['regras-medicao'],
    queryFn: () => base44.entities.RegraMedicao.list()
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const criarMutation = useMutation({
    mutationFn: (data) => base44.entities.RegraMedicao.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['regras-medicao']);
      toast.success('Regra criada!');
      setDialogAberto(false);
    }
  });

  const tipoRegraConfig = {
    percentual_maximo: 'Percentual Máximo',
    etapa_anterior: 'Etapa Anterior',
    aprovacao_necessaria: 'Aprovação Necessária',
    material_disponivel: 'Material Disponível',
    customizada: 'Customizada'
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Regras de Medição"
        subtitle="Configure quando e como pode medir na obra"
        action={() => setDialogAberto(true)}
        actionLabel="Nova Regra"
        actionIcon={Plus}
      />

      <div className="space-y-3">
        {regras.map(regra => {
          const obra = obras.find(o => o.id === regra.obra_id);
          return (
            <Card key={regra.id} className="bg-gradient-to-br from-slate-800/40 to-slate-900/20 border border-slate-700/50">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Shield className="w-5 h-5 text-blue-400" />
                      <h3 className="text-lg font-semibold text-white">{regra.nome_regra}</h3>
                      <Badge className={regra.ativo ? 'bg-emerald-600' : 'bg-slate-600'}>
                        {regra.ativo ? 'Ativa' : 'Inativa'}
                      </Badge>
                      <Badge className="bg-blue-600/20 text-blue-300">
                        {tipoRegraConfig[regra.tipo_regra]}
                      </Badge>
                    </div>
                    <p className="text-slate-400 mb-3">{obra?.nome || 'Todas as obras'}</p>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {regra.percentual_maximo_medicao && (
                        <div>
                          <p className="text-slate-500">Percentual Máximo</p>
                          <p className="text-white font-bold">{regra.percentual_maximo_medicao}%</p>
                        </div>
                      )}
                      {regra.mensagem_bloqueio && (
                        <div>
                          <p className="text-slate-500">Mensagem de Bloqueio</p>
                          <p className="text-amber-400 text-xs">{regra.mensagem_bloqueio}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Nova Regra de Medição</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-slate-400 mb-2 block text-sm">Nome da Regra</Label>
              <Input
                value={novaRegra.nome_regra}
                onChange={(e) => setNovaRegra({ ...novaRegra, nome_regra: e.target.value })}
                className="bg-slate-800/60 border-slate-700 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-400 mb-2 block text-sm">Obra</Label>
                <Select
                  value={novaRegra.obra_id}
                  onValueChange={(v) => setNovaRegra({ ...novaRegra, obra_id: v })}
                >
                  <SelectTrigger className="bg-slate-800/60 border-slate-700 text-white">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {obras.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-slate-400 mb-2 block text-sm">Tipo de Regra</Label>
                <Select
                  value={novaRegra.tipo_regra}
                  onValueChange={(v) => setNovaRegra({ ...novaRegra, tipo_regra: v })}
                >
                  <SelectTrigger className="bg-slate-800/60 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {Object.entries(tipoRegraConfig).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {novaRegra.tipo_regra === 'percentual_maximo' && (
              <div>
                <Label className="text-slate-400 mb-2 block text-sm">Percentual Máximo (%)</Label>
                <Input
                  type="number"
                  value={novaRegra.percentual_maximo_medicao}
                  onChange={(e) => setNovaRegra({ ...novaRegra, percentual_maximo_medicao: parseFloat(e.target.value) })}
                  className="bg-slate-800/60 border-slate-700 text-white"
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setDialogAberto(false)}
                className="flex-1 border-slate-700 text-slate-400"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => criarMutation.mutate(novaRegra)}
                disabled={!novaRegra.nome_regra || !novaRegra.obra_id}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Criar Regra
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
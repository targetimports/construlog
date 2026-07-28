import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Flag, 
  Plus, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  PlayCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const statusConfig = {
  pendente: { label: 'Pendente', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: Clock },
  em_andamento: { label: 'Em Andamento', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: PlayCircle },
  concluido: { label: 'Concluído', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle },
  atrasado: { label: 'Atrasado', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: AlertCircle }
};

export default function MarcosTimeline({ marcos, obraId }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    data_prevista: '',
    responsavel: ''
  });
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.MarcoObra.create({ ...data, obra_id: obraId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marcos-obra', obraId] });
      toast.success('Marco adicionado!');
      setDialogOpen(false);
      setFormData({ titulo: '', descricao: '', data_prevista: '', responsavel: '' });
    }
  });

  const marcosOrdenados = [...marcos].sort((a, b) => 
    new Date(a.data_prevista) - new Date(b.data_prevista)
  );

  const proximosMarcos = marcosOrdenados.filter(m => 
    m.status !== 'concluido' && new Date(m.data_prevista) >= new Date()
  ).slice(0, 3);

  return (
    <>
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Flag className="w-5 h-5 text-amber-500" />
            Próximos Marcos
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-gray-900"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {proximosMarcos.length === 0 ? (
            <div className="text-center py-8">
              <Flag className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">Nenhum marco definido</p>
              <Button
                size="sm"
                onClick={() => setDialogOpen(true)}
                className="bg-amber-500 hover:bg-amber-600 text-gray-900"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Marco
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {proximosMarcos.map((marco, idx) => {
                const status = statusConfig[marco.status] || statusConfig.pendente;
                const StatusIcon = status.icon;
                const diasRestantes = Math.floor(
                  (new Date(marco.data_prevista) - new Date()) / (1000 * 60 * 60 * 24)
                );

                return (
                  <div 
                    key={marco.id}
                    className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 hover:border-amber-500/30 transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                          idx === 0 ? "bg-amber-500 text-gray-900" : "bg-gray-700 text-gray-400"
                        )}>
                          {idx + 1}
                        </div>
                        <div>
                          <h4 className="text-white font-medium">{marco.titulo}</h4>
                          {marco.responsavel && (
                            <p className="text-gray-500 text-xs">Resp: {marco.responsavel}</p>
                          )}
                        </div>
                      </div>
                      <Badge className={cn("border", status.color)}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">
                        {new Date(marco.data_prevista).toLocaleDateString('pt-BR')}
                      </span>
                      <span className={cn(
                        "font-medium",
                        diasRestantes < 7 ? "text-red-400" : diasRestantes < 30 ? "text-amber-400" : "text-gray-400"
                      )}>
                        {diasRestantes} dias
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Novo Marco */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Adicionar Marco</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(formData);
            }}
            className="space-y-4"
          >
            <div>
              <Label className="text-gray-400">Título *</Label>
              <Input
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                required
                placeholder="Ex: Fundação concluída"
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Data Prevista *</Label>
              <Input
                type="date"
                value={formData.data_prevista}
                onChange={(e) => setFormData({ ...formData, data_prevista: e.target.value })}
                required
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Responsável</Label>
              <Input
                value={formData.responsavel}
                onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                placeholder="Nome do responsável"
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="border-gray-700 text-gray-400"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-gray-900"
              >
                Adicionar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
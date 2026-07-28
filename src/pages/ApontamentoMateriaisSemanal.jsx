import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, ClipboardList, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';
import ApontamentoForm from '../components/apontamentos/ApontamentoForm';
import ApontamentoDetalhes from '../components/apontamentos/ApontamentoDetalhes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ApontamentosMateriaisPage() {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [detalhesAberto, setDetalhesAberto] = useState(false);
  const [apontamentoSelecionado, setApontamentoSelecionado] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);
  const queryClient = useQueryClient();

  const { data: apontamentos = [] } = useQuery({
    queryKey: ['apontamentos-materiais'],
    queryFn: () => base44.entities.ApontamentoMateriaisSemanal.list('-created_date', 100)
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.ApontamentoMateriaisSemanal.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['apontamentos-materiais']);
      toast.success('Apontamento excluído!');
      setConfirmarExclusao(null);
    }
  });

  const statusConfig = {
    rascunho: { color: 'bg-gray-500/10 text-gray-400', label: 'Rascunho' },
    enviado: { color: 'bg-blue-500/10 text-blue-400', label: 'Enviado' },
    validado: { color: 'bg-amber-500/10 text-amber-400', label: 'Validado' },
    concluido: { color: 'bg-emerald-500/10 text-emerald-400', label: 'Concluído' }
  };

  const apontamentosFiltrados = apontamentos.filter(apt => {
    const matchStatus = filtroStatus === 'todos' || apt.status === filtroStatus;
    return matchStatus;
  });

  const getObraNome = (obraId) => {
    const obra = obras.find(o => o.id === obraId);
    return obra ? obra.nome : 'Obra não identificada';
  };

  const stats = {
    total: apontamentos.length,
    pendentes: apontamentos.filter(a => a.status === 'rascunho' || a.status === 'enviado').length,
    validados: apontamentos.filter(a => a.status === 'validado' || a.status === 'concluido').length
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apontamento de Materiais Semanal"
        subtitle="Inventário semanal de materiais nas obras"
        action={() => {
          setApontamentoSelecionado(null);
          setDialogAberto(true);
        }}
        actionLabel="Novo Apontamento"
        actionIcon={Plus}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-white mb-1">{stats.total}</div>
            <div className="text-sm text-gray-400">Total</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-blue-400 mb-1">{stats.pendentes}</div>
            <div className="text-sm text-gray-400">Pendentes</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-emerald-400 mb-1">{stats.validados}</div>
            <div className="text-sm text-gray-400">Validados</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full md:w-48">
            <label className="text-sm text-gray-400 mb-2 block">Status</label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="validado">Validado</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        {apontamentosFiltrados.map(apt => (
          <Card key={apt.id} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-all">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{getObraNome(apt.obra_id)}</h3>
                    <Badge className={statusConfig[apt.status]?.color}>
                      {statusConfig[apt.status]?.label}
                    </Badge>
                  </div>
                  <div className="flex gap-4 text-sm text-gray-400 mb-2">
                    <span>{apt.codigo || 'Sem código'}</span>
                    <span>Apontamento: {new Date(apt.data_apontamento).toLocaleDateString('pt-BR')}</span>
                    <span>Encarregado: {apt.encarregado}</span>
                  </div>
                  {apt.materiais && (
                    <div className="text-sm text-gray-500">
                      {apt.materiais.length} material(is) apontado(s)
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setApontamentoSelecionado(apt);
                      setDetalhesAberto(true);
                    }}
                    className="border-gray-700 text-gray-400 hover:bg-gray-800"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setApontamentoSelecionado(apt);
                      setDialogAberto(true);
                    }}
                    className="border-gray-700 text-gray-400 hover:bg-gray-800"
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmarExclusao(apt)}
                    className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {apontamentosFiltrados.length === 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="py-12 text-center">
              <ClipboardList className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Nenhum apontamento encontrado</p>
            </CardContent>
          </Card>
        )}
      </div>

      <ApontamentoForm
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        apontamento={apontamentoSelecionado}
      />

      <ApontamentoDetalhes
        open={detalhesAberto}
        onOpenChange={setDetalhesAberto}
        apontamento={apontamentoSelecionado}
      />

      <AlertDialog open={!!confirmarExclusao} onOpenChange={() => setConfirmarExclusao(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir este apontamento?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletarMutation.mutate(confirmarExclusao.id)}
              className="bg-red-500 hover:bg-red-600"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
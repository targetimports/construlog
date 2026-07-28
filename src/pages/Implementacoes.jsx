import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Lightbulb, Eye, Trash2, Pencil,
  ListChecks, CalendarClock, Loader2, CheckCircle2, User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PageHeader from '../components/ui/PageHeader';
import ImplementacaoForm from '../components/implementacoes/ImplementacaoForm';
import ImplementacaoDetalhes from '../components/implementacoes/ImplementacaoDetalhes';
import { ListSkeleton } from '@/components/shared/Skeletons';
import { Label } from '@/components/ui/label';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';
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

const statusConfig = {
  planejada: { color: 'bg-blue-100 text-blue-700', label: 'Planejada' },
  em_andamento: { color: 'bg-amber-100 text-amber-700', label: 'Em Andamento' },
  concluida: { color: 'bg-emerald-100 text-emerald-700', label: 'Concluída' },
  cancelada: { color: 'bg-red-100 text-red-700', label: 'Cancelada' },
  pausada: { color: 'bg-gray-100 text-gray-600', label: 'Pausada' },
};

const prioridadeConfig = {
  baixa: { color: 'bg-blue-100 text-blue-700', label: 'Baixa' },
  media: { color: 'bg-yellow-100 text-yellow-700', label: 'Média' },
  alta: { color: 'bg-orange-100 text-orange-700', label: 'Alta' },
  critica: { color: 'bg-red-100 text-red-700', label: 'Crítica' },
};

function KpiCard({ icon: Icon, label, value, color }) {
  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn('p-2.5 rounded-lg', color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900 leading-none">{value}</div>
          <div className="text-sm text-gray-500 mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ImplementacoesPage() {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [detalhesAberto, setDetalhesAberto] = useState(false);
  const [implementacaoSelecionada, setImplementacaoSelecionada] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('todas');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);
  const queryClient = useQueryClient();

  const { data: implementacoes = [], isLoading } = useQuery({
    queryKey: ['implementacoes'],
    queryFn: () => base44.entities.Implementacao.list('-created_date', 100),
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.Implementacao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['implementacoes']);
      toast.success('Implementação excluída!');
      setConfirmarExclusao(null);
    },
    onError: () => toast.error('Erro ao excluir implementação'),
  });

  const implementacoesFiltradas = implementacoes.filter((impl) => {
    const matchStatus = filtroStatus === 'todas' || impl.status === filtroStatus;
    const matchCategoria = filtroCategoria === 'todas' || impl.categoria === filtroCategoria;
    return matchStatus && matchCategoria;
  });

  const stats = {
    total: implementacoes.length,
    planejadas: implementacoes.filter((i) => i.status === 'planejada').length,
    em_andamento: implementacoes.filter((i) => i.status === 'em_andamento').length,
    concluidas: implementacoes.filter((i) => i.status === 'concluida').length,
  };

  const abrirDetalhes = (impl) => {
    setImplementacaoSelecionada(impl);
    setDetalhesAberto(true);
  };

  const abrirEdicao = (impl) => {
    setImplementacaoSelecionada(impl);
    setDialogAberto(true);
  };

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Controle de Implementações"
        subtitle="Gerencie novas implementações, melhorias e projetos"
        action={() => {
          setImplementacaoSelecionada(null);
          setDialogAberto(true);
        }}
        actionLabel="Nova Implementação"
        actionIcon={Plus}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={ListChecks} label="Total" value={stats.total} color="bg-gray-500/10 text-gray-600" />
        <KpiCard icon={CalendarClock} label="Planejadas" value={stats.planejadas} color="bg-blue-500/10 text-blue-600" />
        <KpiCard icon={Loader2} label="Em Andamento" value={stats.em_andamento} color="bg-amber-500/10 text-amber-600" />
        <KpiCard icon={CheckCircle2} label="Concluídas" value={stats.concluidas} color="bg-emerald-500/10 text-emerald-600" />
      </div>

      <FiltrosColapsaveis
        ativos={(filtroStatus !== 'todas' ? 1 : 0) + (filtroCategoria !== 'todas' ? 1 : 0)}
        onLimpar={() => { setFiltroStatus('todas'); setFiltroCategoria('todas'); }}
        rodape={<span className="text-xs text-gray-500">{implementacoesFiltradas.length} implementação(ões)</span>}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
            <ComboboxBusca
              options={[
                { value: 'todas', label: 'Todas' },
                { value: 'planejada', label: 'Planejadas' },
                { value: 'em_andamento', label: 'Em Andamento' },
                { value: 'concluida', label: 'Concluídas' },
                { value: 'pausada', label: 'Pausadas' },
                { value: 'cancelada', label: 'Canceladas' },
              ]}
              value={filtroStatus}
              onSelect={(v) => setFiltroStatus(v || 'todas')}
              placeholder="Todas" searchPlaceholder="Buscar status..."
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Categoria</Label>
            <ComboboxBusca
              options={[
                { value: 'todas', label: 'Todas' },
                { value: 'sistema', label: 'Sistema' },
                { value: 'processo', label: 'Processo' },
                { value: 'equipamento', label: 'Equipamento' },
                { value: 'infraestrutura', label: 'Infraestrutura' },
                { value: 'seguranca', label: 'Segurança' },
                { value: 'qualidade', label: 'Qualidade' },
                { value: 'tecnologia', label: 'Tecnologia' },
                { value: 'outros', label: 'Outros' },
              ]}
              value={filtroCategoria}
              onSelect={(v) => setFiltroCategoria(v || 'todas')}
              placeholder="Todas" searchPlaceholder="Buscar categoria..."
            />
          </div>
        </div>
      </FiltrosColapsaveis>

      <div className="space-y-4">
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : implementacoesFiltradas.length === 0 ? (
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="py-16 text-center">
              <Lightbulb className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">Nenhuma implementação encontrada</p>
              <p className="text-gray-400 text-sm mt-1">
                Crie uma nova implementação ou ajuste os filtros.
              </p>
            </CardContent>
          </Card>
        ) : (
          implementacoesFiltradas.map((impl) => (
            <Card
              key={impl.id}
              className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-base font-semibold text-gray-900">{impl.titulo}</h3>
                      <Badge className={cn('border-0', statusConfig[impl.status]?.color)}>
                        {statusConfig[impl.status]?.label || impl.status}
                      </Badge>
                      {impl.prioridade && (
                        <Badge className={cn('border-0', prioridadeConfig[impl.prioridade]?.color)}>
                          {prioridadeConfig[impl.prioridade]?.label || impl.prioridade}
                        </Badge>
                      )}
                      {impl.categoria && (
                        <Badge variant="outline" className="border-gray-200 text-gray-500 capitalize">
                          {impl.categoria}
                        </Badge>
                      )}
                    </div>
                    {impl.descricao && (
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{impl.descricao}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                      {impl.responsavel && (
                        <span className="flex items-center gap-1.5">
                          <UserIcon className="w-3.5 h-3.5" />
                          {impl.responsavel}
                        </span>
                      )}
                      {impl.data_prevista_conclusao && (
                        <span className="flex items-center gap-1.5">
                          <CalendarClock className="w-3.5 h-3.5" />
                          {new Date(impl.data_prevista_conclusao).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      {impl.percentual_concluido !== undefined && impl.percentual_concluido !== null && (
                        <span className="font-medium text-amber-600">
                          {impl.percentual_concluido}% concluído
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirDetalhes(impl)}
                      className="border-gray-200 text-gray-600 hover:bg-gray-50"
                      title="Ver detalhes"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirEdicao(impl)}
                      className="border-gray-200 text-gray-600 hover:bg-gray-50"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmarExclusao(impl)}
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {impl.percentual_concluido !== undefined && impl.percentual_concluido !== null && (
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-4">
                    <div
                      className="bg-amber-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${impl.percentual_concluido}%` }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <ImplementacaoForm
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        implementacao={implementacaoSelecionada}
      />

      <ImplementacaoDetalhes
        open={detalhesAberto}
        onOpenChange={setDetalhesAberto}
        implementacao={implementacaoSelecionada}
      />

      <AlertDialog open={!!confirmarExclusao} onOpenChange={() => setConfirmarExclusao(null)}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500">
              Tem certeza que deseja excluir "{confirmarExclusao?.titulo}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletarMutation.mutate(confirmarExclusao.id)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

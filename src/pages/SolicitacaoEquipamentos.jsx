import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Clock, CheckCircle, XCircle, ClipboardList } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';
import SolicitacaoEquipamentoForm from '../components/equipamentos/SolicitacaoEquipamentoForm.jsx';
import SolicitacaoEquipamentoList from '../components/equipamentos/SolicitacaoEquipamentoList.jsx';
import AprovacaoSolicitacoes from '../components/equipamentos/AprovacaoSolicitacoes.jsx';

export default function SolicitacaoEquipamentos() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ['solicitacoes-equipamentos'],
    queryFn: () => base44.entities.SolicitacaoEquipamento.list('-created_date')
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: equipamentos = [] } = useQuery({
    queryKey: ['equipamentos'],
    queryFn: () => base44.entities.Equipamento.list()
  });
  const equipamentosAtivos = useMemo(
    () => equipamentos.filter(e => e.status === 'ativo'),
    [equipamentos]
  );

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Pessoa.filter({ tipo: 'fornecedor' })
  });

  const criarSolicitacaoMutation = useMutation({
    mutationFn: (data) => base44.entities.SolicitacaoEquipamento.create({
      ...data,
      solicitante_email: user.email,
      status: 'pendente'
    }),
    onSuccess: () => {
      toast.success('Solicitação enviada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-equipamentos'] });
      setDialogOpen(false);
    },
    onError: (error) => toast.error(`Erro: ${error.message}`)
  });

  const minhasSolicitacoes = solicitacoes.filter(s => s.solicitante_email === user?.email);
  const solicitacoesPendentes = solicitacoes.filter(s => s.status === 'pendente');
  const role = String(user?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'programador' || user?.isOwner === true;

  const stats = useMemo(() => ({
    total: solicitacoes.length,
    pendentes: solicitacoes.filter(s => s.status === 'pendente').length,
    aprovadas: solicitacoes.filter(s => s.status === 'aprovada' || s.status === 'em_uso').length,
    rejeitadas: solicitacoes.filter(s => s.status === 'rejeitada').length
  }), [solicitacoes]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipamentos"
        subtitle="Solicite ou aprove equipamentos para as obras"
        action={() => setDialogOpen(true)}
        actionLabel="Nova Solicitação"
      />

      {/* Estatísticas */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pendentes</p>
                <p className="text-2xl font-bold text-amber-600">{stats.pendentes}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Aprovadas</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.aprovadas}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rejeitadas</p>
                <p className="text-2xl font-bold text-red-600">{stats.rejeitadas}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-red-50">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-gray-100">
                <ClipboardList className="w-6 h-6 text-gray-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="minhas" className="w-full">
        <TabsList className="flex w-full overflow-x-auto justify-start md:grid md:grid-cols-3">
          <TabsTrigger value="minhas">Minhas Solicitações</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="pendentes" className="relative">
              Aprovações Pendentes
              {solicitacoesPendentes.length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {solicitacoesPendentes.length}
                </span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* Minhas Solicitações */}
        <TabsContent value="minhas">
          <SolicitacaoEquipamentoList
            solicitacoes={minhasSolicitacoes}
            isLoading={isLoading}
            obras={obras}
            equipamentos={equipamentos}
          />
        </TabsContent>

        {/* Aprovações Pendentes (Admin) */}
        {isAdmin && (
          <TabsContent value="pendentes">
            <AprovacaoSolicitacoes
              solicitacoes={solicitacoesPendentes}
              isLoading={isLoading}
              obras={obras}
              equipamentos={equipamentos}
            />
          </TabsContent>
        )}

        {/* Histórico */}
        <TabsContent value="historico">
          <SolicitacaoEquipamentoList
            solicitacoes={solicitacoes.filter(s => s.status !== 'pendente')}
            isLoading={isLoading}
            obras={obras}
            equipamentos={equipamentos}
          />
        </TabsContent>
      </Tabs>

      {/* Dialog Nova Solicitação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Solicitação de Equipamento</DialogTitle>
          </DialogHeader>
          <SolicitacaoEquipamentoForm
            obras={obras}
            equipamentos={equipamentosAtivos}
            fornecedores={fornecedores}
            onSubmit={(data) => criarSolicitacaoMutation.mutate(data)}
            isLoading={criarSolicitacaoMutation.isPending}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
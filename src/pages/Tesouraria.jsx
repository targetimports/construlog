import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import { confirmar } from '@/lib/confirmar';
import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';
import { useEmpresa } from '@/components/shared/useEmpresaContext';

import ListaContas from '@/components/tesouraria/ListaContas';
import FormNovaConta from '@/components/tesouraria/FormNovaConta';
import FormMovimentacao from '@/components/tesouraria/FormMovimentacao';
import ExtratoConta from '@/components/tesouraria/ExtratoConta';
import CapitalGiroObras from '@/components/tesouraria/CapitalGiroObras';

export default function Tesouraria({ embedded = false }) {
  if (embedded) return <TesourariaContent />;
  return (
    <RouteGuardFinalV2 requiredPermissionKey="FINANCEIRO_VIEW">
      <TesourariaContent />
    </RouteGuardFinalV2>
  );
}

function TesourariaContent() {
  const queryClient = useQueryClient();
  const [showNovaConta, setShowNovaConta] = useState(false);
  const [editConta, setEditConta] = useState(null);
  const [showMov, setShowMov] = useState(null); // 'entrada' | 'saida' | 'transferencia' | null
  const [contaSelecionada, setContaSelecionada] = useState(null);
  const [tab, setTab] = useState('contas');

  // Buscar resumo via backend
  const { data: resumoData } = useQuery({
    queryKey: ['tesouraria-resumo'],
    queryFn: async () => {
      const res = await base44.functions.invoke('tesourariaMovimentar', { action: 'get_resumo' });
      return res.data;
    },
    staleTime: 15000,
  });

  // Buscar obras para vincular
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-tesouraria'],
    queryFn: () => base44.entities.Obra.list('-updated_date', 200),
    staleTime: 60000,
  });

  // Empresas do grupo — para o caixa ser vinculado a uma empresa (só global/matriz escolhe).
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list().catch(() => []),
    staleTime: 5 * 60 * 1000,
  });
  const { acessoGlobal } = useEmpresa();

  const contas = resumoData?.contas || [];

  const fecharForm = () => { setShowNovaConta(false); setEditConta(null); };

  // Mutation: criar conta
  const criarContaMutation = useMutation({
    mutationFn: async (data) => {
      const res = await base44.functions.invoke('tesourariaMovimentar', { action: 'criar_conta', ...data });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Conta criada com sucesso!');
      fecharForm();
      queryClient.invalidateQueries({ queryKey: ['tesouraria-resumo'] });
    },
    onError: (err) => toast.error(err?.response?.data?.error || err.message),
  });

  // Mutation: editar conta (só campos cadastrais — saldo é gerido por movimentações).
  const editarContaMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const patch = {
        nome: data.nome, tipo: data.tipo, banco: data.banco, agencia: data.agencia,
        numero_conta: data.numero_conta, empresa_id: data.empresa_id || null,
        obra_id: data.obra_id || null, permite_saldo_negativo: !!data.permite_saldo_negativo,
      };
      return base44.entities.ContaTesouraria.update(id, patch);
    },
    onSuccess: () => {
      toast.success('Conta atualizada!');
      fecharForm();
      queryClient.invalidateQueries({ queryKey: ['tesouraria-resumo'] });
    },
    onError: (err) => toast.error(err?.response?.data?.error || err.message),
  });

  // Mutation: movimentar
  const movimentarMutation = useMutation({
    mutationFn: async (data) => {
      const res = await base44.functions.invoke('tesourariaMovimentar', { action: 'movimentar', ...data });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Movimentação registrada! Novo saldo: R$ ${(data.saldo_posterior || 0).toFixed(2)}`);
      setShowMov(null);
      queryClient.invalidateQueries({ queryKey: ['tesouraria-resumo'] });
      queryClient.invalidateQueries({ queryKey: ['tesouraria-fluxo-projetado'] });
      if (contaSelecionada) {
        queryClient.invalidateQueries({ queryKey: ['movimentacoes-conta', contaSelecionada.id] });
      }
    },
    onError: (err) => toast.error(err?.response?.data?.error || err.message),
  });

  // Mutation: bloquear saldo
  const bloquearSaldoMutation = useMutation({
    mutationFn: async (conta) => {
      const res = await base44.functions.invoke('tesourariaMovimentar', { action: 'bloquear_saldo_inicial', conta_id: conta.id });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Saldo inicial bloqueado. Agora somente movimentações alteram o saldo.');
      queryClient.invalidateQueries({ queryKey: ['tesouraria-resumo'] });
    },
  });

  // Se estamos vendo extrato de uma conta
  if (contaSelecionada) {
    return (
      <div className="space-y-6 pb-6">
        <ExtratoConta conta={contaSelecionada} onBack={() => setContaSelecionada(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Caixa e Bancos</h1>
          <p className="text-gray-500 text-sm mt-1">Caixa, bancos e contas vinculadas a obras</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none gap-2 text-green-700 border-green-300 hover:bg-green-50" onClick={() => setShowMov('entrada')}>
            <ArrowDownCircle className="w-4 h-4" /> Entrada
          </Button>
          <Button variant="outline" className="flex-1 sm:flex-none gap-2 text-red-700 border-red-300 hover:bg-red-50" onClick={() => setShowMov('saida')}>
            <ArrowUpCircle className="w-4 h-4" /> Saída
          </Button>
          <Button variant="outline" className="flex-1 sm:flex-none gap-2 text-blue-700 border-blue-300 hover:bg-blue-50" onClick={() => setShowMov('transferencia')}>
            <ArrowLeftRight className="w-4 h-4" /> Transferência
          </Button>
          <Button className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => { setEditConta(null); setShowNovaConta(true); }}>
            <Plus className="w-4 h-4" /> Nova Conta
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full overflow-x-auto justify-start bg-gray-100/80 h-auto gap-1 p-1">
          <TabsTrigger value="contas" className="shrink-0 whitespace-nowrap">Contas</TabsTrigger>
          <TabsTrigger value="capital" className="shrink-0 whitespace-nowrap">Capital de Giro</TabsTrigger>
        </TabsList>

        <TabsContent value="contas" className="mt-4">
          <ListaContas
            contas={contas}
            onSelectConta={setContaSelecionada}
            onEditar={(conta) => { setEditConta(conta); setShowNovaConta(true); }}
            onBloquearSaldo={async (conta) => {
              if (await confirmar({ titulo: 'Bloquear saldo inicial', descricao: `Bloquear saldo inicial de "${conta.nome}"? Após o bloqueio, somente movimentações alteram o saldo.`, confirmar: 'Bloquear' })) {
                bloquearSaldoMutation.mutate(conta);
              }
            }}
          />
        </TabsContent>

        <TabsContent value="capital" className="mt-4">
          <CapitalGiroObras />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <FormNovaConta
        open={showNovaConta}
        onClose={fecharForm}
        conta={editConta}
        obras={obras}
        empresas={empresas}
        podeEscolherEmpresa={acessoGlobal}
        onSubmit={(data) => (data.id ? editarContaMutation.mutate({ id: data.id, data }) : criarContaMutation.mutate(data))}
        saving={criarContaMutation.isPending || editarContaMutation.isPending}
      />

      {showMov && (
        <FormMovimentacao
          open={!!showMov}
          onClose={() => setShowMov(null)}
          tipo={showMov}
          contas={contas}
          obras={obras}
          onSubmit={(data) => movimentarMutation.mutate(data)}
          saving={movimentarMutation.isPending}
        />
      )}
    </div>
  );
}
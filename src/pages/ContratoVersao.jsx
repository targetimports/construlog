import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import ContratoVersaoHeader from "../components/contrato/ContratoVersaoHeader";
import ContratoItemForm from "../components/contrato/ContratoItemForm";
import ContratoItensTable from "../components/contrato/ContratoItensTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageSkeleton, TableSkeleton } from '@/components/shared/Skeletons';

export default function ContratoVersao() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const contratoVersaoId = urlParams.get('id') || urlParams.get('contrato_versao_id');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: versao, isLoading: vLoading, error: vError } = useQuery({
    queryKey: ['contratoVersao', contratoVersaoId],
    queryFn: async () => {
      if (!contratoVersaoId) return null;
      const list = await base44.entities.ContratoVersao.filter({ id: contratoVersaoId });
      return list?.[0] || null;
    },
    enabled: Boolean(contratoVersaoId),
  });

  const { data: obra } = useQuery({
    queryKey: ['obra', versao?.obra_id],
    queryFn: async () => {
      if (!versao?.obra_id) return null;
      const list = await base44.entities.Obra.filter({ id: versao.obra_id });
      return list?.[0] || null;
    },
    enabled: Boolean(versao?.obra_id),
  });

  const { data: itens, isLoading: iLoading } = useQuery({
    queryKey: ['contratoItems', contratoVersaoId],
    queryFn: async () => {
      if (!contratoVersaoId) return [];
      return base44.entities.ContratoItem.filter({ contrato_versao_id: contratoVersaoId });
    },
    enabled: Boolean(contratoVersaoId),
    initialData: [],
  });

  const recalcMutation = useMutation({
    mutationFn: async () => {
      if (!contratoVersaoId) return;
      await base44.functions.invoke('recalcContratoVersao', { contrato_versao_id: contratoVersaoId, persist: true });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contratoItems', contratoVersaoId] }),
        queryClient.invalidateQueries({ queryKey: ['contratoVersao', contratoVersaoId] }),
      ]);
    }
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      // preco_total será recalculado pelo serviço central; enviamos 0 para cumprir o schema
      return base44.entities.ContratoItem.create({ ...payload, contrato_versao_id: contratoVersaoId, preco_total: 0 });
    },
    onSuccess: async () => {
      await recalcMutation.mutateAsync();
      setShowForm(false);
      setEditing(null);
      toast.success('Item adicionado ao contrato.');
    },
    onError: (err) => toast.error('Erro ao adicionar item: ' + (err?.response?.data?.error || err.message)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      return base44.entities.ContratoItem.update(id, payload);
    },
    onSuccess: async () => {
      await recalcMutation.mutateAsync();
      setShowForm(false);
      setEditing(null);
      toast.success('Item atualizado.');
    },
    onError: (err) => toast.error('Erro ao atualizar item: ' + (err?.response?.data?.error || err.message)),
  });

  const totalContrato = useMemo(() => versao?.total_contrato ?? 0, [versao]);

  if (!contratoVersaoId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-2">Contrato - Versão</h1>
        <p className="text-gray-600">Informe o parâmetro id ou contrato_versao_id na URL para carregar a versão do contrato.</p>
      </div>
    );
  }

  if (vLoading) return <div className="p-6"><PageSkeleton cols={9} /></div>;
  if (vError) return <div className="p-6 text-red-600">Erro ao carregar versão.</div>;
  if (!versao) return <div className="p-6">Versão não encontrada.</div>;

  return (
    <div className="p-6 space-y-4">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition"
        aria-label="Voltar"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <ContratoVersaoHeader
        versao={versao}
        obra={obra}
        totalContrato={totalContrato}
        onRecalc={() => recalcMutation.mutate()}
        recalcLoading={recalcMutation.isPending}
      />

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Itens do Contrato</h2>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          Adicionar Item
        </Button>
      </div>

      {/* Edição/adição de item em MODAL (padrão do sistema), no lugar da antiga
          div fixa no topo da página. */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) { setShowForm(false); setEditing(null); } }}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Editar Item do Contrato' : 'Adicionar Item do Contrato'}</DialogTitle>
          </DialogHeader>
          <ContratoItemForm
            initialItem={editing}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            onSave={(data) => {
              if (editing?.id) {
                updateMutation.mutate({ id: editing.id, payload: data });
              } else {
                createMutation.mutate(data);
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {iLoading ? (
        <TableSkeleton rows={6} cols={9} />
      ) : (
        <ContratoItensTable
          items={itens}
          onEdit={(it) => { setEditing(it); setShowForm(true); }}
        />
      )}
    </div>
  );
}
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle2, Clock, AlertCircle, Plus, Eye, ExternalLink } from 'lucide-react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from '@/components/ui/alert-dialog';
import { createPageUrl } from '@/utils';
import { formatBRL } from '@/components/shared/moneyBR';
import { ListSkeleton } from '@/components/shared/Skeletons';

export default function Medicoes() {
  return (
    <RouteGuardFinalV2 requiredPermissionKey="MEDICOES_VIEW">
      <MedicoesContent />
    </RouteGuardFinalV2>
  );
}

const BM_STATUS_CONFIG = {
  RASCUNHO:   { label: 'Rascunho',   bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
  APROVADA:   { label: 'Aprovada',   bg: 'bg-green-100',  text: 'text-green-800',  icon: CheckCircle2 },
  RETIFICADA: { label: 'Retificada', bg: 'bg-blue-100',   text: 'text-blue-800',   icon: AlertCircle },
};

function MedicoesContent() {
  const [filtroStatus, setFiltroStatus] = useState('todas');
  const [obraIdSelecionada, setObraIdSelecionada] = useState('todas');
  const [criando, setCriando] = useState(false);
  const [semItensDialog, setSemItensDialog] = useState(null); // { contrato_versao_id, obra_id }
  const queryClient = useQueryClient();

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-medicoes'],
    queryFn: () => base44.entities.Obra.list('-updated_date', 200),
    staleTime: 60000,
  });

  // Query por obra_id quando selecionada, ou lista geral
  const queryKey = ['bms-medicoes-lista', obraIdSelecionada];
  const { data: bms = [], isLoading: bmsLoading } = useQuery({
    queryKey,
    queryFn: () =>
      obraIdSelecionada !== 'todas'
        ? base44.entities.BM.filter({ obra_id: obraIdSelecionada }, '-created_date', 200)
        : base44.entities.BM.list('-created_date', 500),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const obraMap = Object.fromEntries(obras.map(o => [o.id, o.nome]));

  const handleNovaBM = async () => {
    // Determinar obra_id para criação
    let obra_id = obraIdSelecionada !== 'todas' ? obraIdSelecionada : null;
    if (!obra_id) {
      const ativas = obras.filter(o => ['ativa', 'em_andamento', 'EM_ANDAMENTO', 'a_iniciar'].includes(o.status || o.fase));
      const src = ativas.length > 0 ? ativas : obras;
      if (!src.length) {
        toast.error('Nenhuma obra cadastrada. Crie uma obra antes de criar uma medição.');
        return;
      }
      obra_id = src[0].id;
    }

    setCriando(true);
    try {
      const res = await base44.functions.invoke('criarBMSemWizard', { obra_id });
      const data = res.data;
      if (!data?.ok) {
        // Interceptar erro CONTRATO_SEM_ITENS para mostrar dialog amigável
        if (data?.code === 'CONTRATO_SEM_ITENS') {
          setSemItensDialog({ contrato_versao_id: data.contrato_versao_id, obra_id: data.obra_id || obra_id });
          return;
        }
        toast.error(data?.error || 'Erro ao criar BM');
        return;
      }
      toast.success(`BM #${data.numero} criada!`);
      await queryClient.invalidateQueries({ queryKey: ['bms-medicoes-lista'] });
      window.location.href = createPageUrl(`BMDetalhes?bm_id=${data.bm_id}`);
    } catch (err) {
      // Axios wraps 4xx in error — check response data
      const errData = err?.response?.data;
      if (errData?.code === 'CONTRATO_SEM_ITENS') {
        setSemItensDialog({ contrato_versao_id: errData.contrato_versao_id, obra_id: errData.obra_id || obra_id });
        return;
      }
      toast.error(errData?.error || err.message || 'Erro ao criar BM');
    } finally {
      setCriando(false);
    }
  };

  const bmsFiltradas = bms.filter(b =>
    (filtroStatus === 'todas' || b.status === filtroStatus)
  );

  // KPIs
  const total       = bms.length;
  const rascunhos   = bms.filter(b => b.status === 'RASCUNHO').length;
  const aprovadas   = bms.filter(b => b.status === 'APROVADA').length;
  const retificadas = bms.filter(b => b.status === 'RETIFICADA').length;
  const totalFaturado = bms
    .filter(b => b.status === 'APROVADA')
    .reduce((s, b) => s + (b.total_periodo || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Medições (BM)</h1>
          <p className="text-gray-600 mt-1">Boletins de Medição por Contrato</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.location.href = createPageUrl('MedicaoForm')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Medição Legado
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={handleNovaBM}
            disabled={criando}
          >
            <Plus className="w-4 h-4 mr-2" />
            {criando ? 'Criando...' : 'Nova BM'}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: total, icon: FileText, color: 'text-blue-600' },
          { label: 'Rascunho', value: rascunhos, icon: Clock, color: 'text-yellow-600' },
          { label: 'Aprovadas', value: aprovadas, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Retificadas', value: retificadas, icon: AlertCircle, color: 'text-blue-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-5 text-center">
              <Icon className={`w-7 h-7 ${color} mx-auto mb-1`} />
              <p className="text-gray-500 text-xs">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-5 text-center">
            <p className="text-gray-600 text-xs mb-1">Total Faturado (Aprovadas)</p>
            <p className="text-lg font-bold text-green-700">{formatBRL(totalFaturado)}</p>
            <p className="text-xs text-gray-500 mt-1">somente BMs APROVADAS</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={obraIdSelecionada}
          onChange={(e) => setObraIdSelecionada(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="todas">Todas as Obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="todas">Todos os Status</option>
          <option value="RASCUNHO">Rascunho</option>
          <option value="APROVADA">Aprovada</option>
          <option value="RETIFICADA">Retificada</option>
        </select>
        <span className="text-xs text-gray-500">{bmsFiltradas.length} resultado(s)</span>
      </div>

      {/* Lista BMs */}
      <div className="space-y-3">
        {bmsLoading ? (
          <ListSkeleton rows={6} />
        ) : bmsFiltradas.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-gray-500">Nenhuma BM encontrada</CardContent></Card>
        ) : (
          bmsFiltradas.map(bm => {
            const cfg = BM_STATUS_CONFIG[bm.status] || BM_STATUS_CONFIG.RASCUNHO;
            const Icon = cfg.icon;
            const isAprovada = bm.status === 'APROVADA';
            const periodoLabel = [
              bm.data_inicio && new Date(bm.data_inicio).toLocaleDateString('pt-BR'),
              bm.data_fim && new Date(bm.data_fim).toLocaleDateString('pt-BR'),
            ].filter(Boolean).join(' → ');

            return (
              <Card key={bm.id} className={`hover:shadow-md transition-shadow ${isAprovada ? 'border-l-4 border-l-green-400' : 'border-l-4 border-l-yellow-300'}`}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Icon className={`w-5 h-5 flex-shrink-0 ${isAprovada ? 'text-green-600' : 'text-yellow-600'}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">BM #{bm.numero}</span>
                          <Badge className={`${cfg.bg} ${cfg.text} text-xs`}>{cfg.label}</Badge>
                          {isAprovada && <span className="text-xs text-green-600 font-semibold">✓ OFICIAL</span>}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{obraMap[bm.obra_id] || bm.obra_id}</p>
                        {periodoLabel && <p className="text-xs text-gray-400">{periodoLabel}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Período</p>
                        <p className={`font-semibold ${isAprovada ? 'text-green-700' : 'text-yellow-700'}`}>
                          {formatBRL(bm.total_periodo || 0)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Acumulado</p>
                        <p className="font-semibold text-blue-700">{formatBRL(bm.total_acumulado || 0)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">% Conc.</p>
                        <p className="font-semibold">{(bm.percent_concluida || 0).toFixed(1)}%</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = createPageUrl(`BMDetalhes?bm_id=${bm.id}`)}
                        className="gap-1"
                      >
                        <Eye className="w-3 h-3" /> Ver
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
      {/* Dialog: Contrato sem itens */}
      <AlertDialog open={!!semItensDialog} onOpenChange={() => setSemItensDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Contrato sem Itens</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Você precisa cadastrar itens do contrato antes de criar uma medição.</p>
              <p className="text-xs text-gray-400">
                Versão do contrato: <code>{semItensDialog?.contrato_versao_id}</code>
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const vId = semItensDialog?.contrato_versao_id;
                setSemItensDialog(null);
                window.location.href = createPageUrl(`ContratoVersao?id=${vId}`);
              }}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Ir para Contrato
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
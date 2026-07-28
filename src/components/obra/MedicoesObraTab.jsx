import React, { useState, useMemo } from 'react';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, Plus, ClipboardList, AlertCircle, TrendingUp, DollarSign, FileText, ExternalLink } from 'lucide-react';
import { formatBRL, formatBRLcompact } from '@/components/shared/moneyBR';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  RASCUNHO: { label: 'Rascunho', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  APROVADA: { label: 'Aprovada', color: 'bg-green-100 text-green-800 border-green-200' },
  RETIFICADA: { label: 'Retificada', color: 'bg-blue-100 text-blue-800 border-blue-200' },
};

export default function MedicoesObraTab({ obraId, onSelectRascunho, podeEditar = true }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [generatingContrato, setGeneratingContrato] = useState(false);

  // Buscar versão ativa do contrato
  const { data: versoes = [], isLoading: loadingVersoes } = useQuery({
    queryKey: ['contrato-versoes-obra', obraId],
    queryFn: () => base44.entities.ContratoVersao.filter({ obra_id: obraId, status: 'ATIVA' }),
    enabled: !!obraId,
  });

  const versaoAtiva = versoes[0] || null;

  // Buscar todas as BMs da obra (independente da versão)
  const { data: bms = [], isLoading: loadingBMs } = useQuery({
    queryKey: ['bms-obra', obraId],
    queryFn: async () => {
      const list = await base44.entities.BM.filter({ obra_id: obraId });
      return list.sort((a, b) => (b.numero || 0) - (a.numero || 0));
    },
    enabled: !!obraId,
  });

  // Buscar itens do contrato para validar
  const { data: contratoItens = [], isLoading: loadingItens } = useQuery({
    queryKey: ['contrato-itens-versao', versaoAtiva?.id],
    queryFn: () => base44.entities.ContratoItem.filter({ contrato_versao_id: versaoAtiva.id }),
    enabled: !!versaoAtiva?.id,
  });

  // Buscar orçamento da obra (para saber se pode gerar contrato)
  const { data: orcamentos = [] } = useQuery({
    queryKey: ['orcamento-obra-medicoes', obraId],
    queryFn: () => base44.entities.Orcamento.filter({ obra_id: obraId }),
    enabled: !!obraId && !versaoAtiva,
  });

  const { data: itensOrcamento = [] } = useQuery({
    queryKey: ['itens-orcamento-medicoes', orcamentos[0]?.id],
    queryFn: () => base44.entities.ItemOrcamento.filter({ orcamento_id: orcamentos[0].id }),
    enabled: !!orcamentos[0]?.id && !versaoAtiva,
  });

  const temOrcamentoComItens = orcamentos.length > 0 && itensOrcamento.length > 0;

  // Gerar contrato a partir do orçamento
  const handleGerarContrato = async () => {
    setGeneratingContrato(true);
    try {
      const res = await base44.functions.invoke('gerarContratoDoOrcamento', { obra_id: obraId });
      if (res.data?.ok) {
        toast.success(res.data.message || 'Contrato gerado com sucesso!');
        queryClient.invalidateQueries({ queryKey: ['contrato-versoes-obra', obraId] });
        queryClient.invalidateQueries({ queryKey: ['contrato-itens-versao'] });
      } else {
        toast.error(res.data?.error || 'Erro ao gerar contrato.');
      }
    } catch (err) {
      toast.error(err?.message || 'Erro ao gerar contrato.');
    } finally {
      setGeneratingContrato(false);
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    const aprovadas = bms.filter(b => b.status === 'APROVADA');
    const rascunhos = bms.filter(b => b.status === 'RASCUNHO');
    const ultimaAprovada = aprovadas.sort((a, b) => (b.numero || 0) - (a.numero || 0))[0];
    // "Total Contrato" reflete o contrato VIVO (versão ativa); cai para o snapshot
    // da última aprovada só se não houver versão ativa. O % concluído é recalculado
    // sobre o contrato vivo para os dois números baterem no topo.
    const totalContrato = versaoAtiva?.total_contrato || ultimaAprovada?.total_contrato || 0;
    const totalAcumulado = ultimaAprovada?.total_acumulado || 0;
    const percentConcluida = totalContrato > 0 ? (totalAcumulado / totalContrato) * 100 : 0;
    return {
      total: bms.length,
      aprovadas: aprovadas.length,
      rascunhos: rascunhos.length,
      totalAcumulado,
      totalContrato,
      percentConcluida,
    };
  }, [bms, versaoAtiva]);

  // Criar nova BM
  const handleNovaBM = async () => {
    if (!versaoAtiva) {
      toast.error('Nenhuma versão de contrato ativa encontrada.');
      return;
    }
    if (contratoItens.length === 0) {
      toast.error('O contrato ativo não possui itens. Cadastre itens antes de criar uma medição.');
      return;
    }
    setCreating(true);
    try {
      const res = await base44.functions.invoke('criarBMSemWizard', { obra_id: obraId });
      if (res.data?.bm_id) {
        toast.success(`BM #${res.data.numero || ''} criada com sucesso!`);
        queryClient.invalidateQueries({ queryKey: ['bms-obra', obraId] });
        navigate(createPageUrl(`BMDetalhes?bm_id=${res.data.bm_id}`));
      } else {
        toast.error(res.data?.error || 'Erro ao criar medição.');
      }
    } catch (err) {
      toast.error(err?.message || 'Erro ao criar medição.');
    } finally {
      setCreating(false);
    }
  };

  const isLoading = loadingVersoes || loadingBMs || loadingItens;

  if (isLoading) {
    return <TableSkeleton rows={6} cols={6} />;
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 uppercase">Total Medições</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.total}</p>
            <div className="flex gap-2 mt-1">
              <span className="text-xs text-emerald-600">{kpis.aprovadas} aprovadas</span>
              {kpis.rascunhos > 0 && <span className="text-xs text-amber-500">{kpis.rascunhos} rascunho</span>}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 min-w-0">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 uppercase">Acumulado</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 tabular-nums truncate">
              <span className="sm:hidden">{formatBRLcompact(kpis.totalAcumulado)}</span>
              <span className="hidden sm:inline">{formatBRL(kpis.totalAcumulado)}</span>
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 min-w-0">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 uppercase">Total Contrato</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 tabular-nums truncate">
              <span className="sm:hidden">{formatBRLcompact(kpis.totalContrato)}</span>
              <span className="hidden sm:inline">{formatBRL(kpis.totalContrato)}</span>
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 uppercase">% Concluída</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{(kpis.percentConcluida || 0).toFixed(2)}%</p>
            <Progress value={kpis.percentConcluida || 0} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Cabeçalho + Botão Nova Medição */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 min-w-0">
          <ClipboardList className="w-5 h-5 text-blue-600 flex-shrink-0" />
          Boletins de Medição
        </h2>
        {podeEditar && (
          <Button
            onClick={handleNovaBM}
            disabled={creating || !versaoAtiva || contratoItens.length === 0}
            className="bg-blue-600 hover:bg-blue-700 gap-2 flex-shrink-0"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span className="sm:hidden">Nova</span>
            <span className="hidden sm:inline">Nova Medição</span>
          </Button>
        )}
      </div>

      {/* Info do contrato ativo */}
      {versaoAtiva && contratoItens.length > 0 && (
        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">Contrato Versão #{versaoAtiva.numero_versao}</p>
                  <p className="text-xs text-gray-400">
                    {contratoItens.length} iten(s) · Total: {formatBRL(versaoAtiva.total_contrato)}
                  </p>
                </div>
                <Badge className="bg-emerald-50 text-emerald-600 border-green-700 text-xs flex-shrink-0">ATIVA</Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-600 text-gray-600 hover:bg-gray-50 gap-1 w-full sm:w-auto flex-shrink-0"
                onClick={() => navigate(createPageUrl(`ContratoVersao?id=${versaoAtiva.id}&obra_id=${obraId}`))}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ver Contrato
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aviso se não há contrato */}
      {!versaoAtiva && !loadingVersoes && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-sm font-medium text-amber-800">
              Nenhuma versão de contrato ativa encontrada
            </p>
            <p className="text-xs text-amber-600">
              Para criar medições (BMs), é necessário ter um contrato com itens cadastrados.
            </p>

            {temOrcamentoComItens ? (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-emerald-600">
                  ✓ Orçamento encontrado com {itensOrcamento.length} iten(s). Gere o contrato automaticamente:
                </p>
                <Button
                  onClick={handleGerarContrato}
                  disabled={generatingContrato}
                  className="bg-green-600 hover:bg-green-700 gap-2"
                >
                  {generatingContrato ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
                  {generatingContrato ? 'Gerando contrato...' : 'Gerar Contrato do Orçamento'}
                </Button>
              </div>
            ) : (
              <div className="flex justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-200 text-amber-800 hover:bg-amber-50 gap-1"
                  onClick={() => navigate(createPageUrl(`ImportarOrcaFacil?obra_id=${obraId}`))}
                >
                  Importar Orçamento
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aviso se contrato sem itens */}
      {versaoAtiva && contratoItens.length === 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-800 min-w-0">
              O contrato ativo não possui itens cadastrados. Adicione itens ao contrato para criar medições.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto sm:ml-auto flex-shrink-0 border-amber-200 text-amber-800 hover:bg-amber-50"
              onClick={() => navigate(createPageUrl(`ContratoVersao?id=${versaoAtiva.id}&obra_id=${obraId}`))}
            >
              Ir para Contrato
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Lista de BMs */}
      {bms.length === 0 ? (
        <Card className="bg-white border-gray-200">
          <CardContent className="text-center py-12 text-gray-500">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 text-gray-600" />
            <p>Nenhum boletim de medição cadastrado</p>
            <p className="text-xs mt-1">Clique em "Nova Medição" para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bms.map((bm) => {
            const cfg = STATUS_CONFIG[bm.status] || STATUS_CONFIG.RASCUNHO;
            return (
              <Card key={bm.id} className="bg-white border-gray-200 hover:border-gray-600 transition">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-semibold text-gray-900">BM #{bm.numero}</span>
                        <Badge className={`${cfg.color} text-xs border`}>{cfg.label}</Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        {bm.data_inicio && new Date(bm.data_inicio).toLocaleDateString('pt-BR')}
                        {bm.data_fim && ` até ${new Date(bm.data_fim).toLocaleDateString('pt-BR')}`}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                          Período: <strong className="text-gray-900 whitespace-nowrap">{formatBRL(bm.total_periodo)}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                          Acumulado: <strong className="text-gray-900 whitespace-nowrap">{formatBRL(bm.total_acumulado)}</strong>
                        </span>
                        <span>
                          Progresso: <strong className="text-gray-900">{(bm.percent_concluida || 0).toFixed(2)}%</strong>
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        if (bm.status === 'RASCUNHO' && onSelectRascunho) {
                          onSelectRascunho(bm.percent_concluida);
                        }
                        navigate(createPageUrl(`BMDetalhes?bm_id=${bm.id}`));
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto sm:ml-4 gap-2 flex-shrink-0 border-gray-600 text-gray-600 hover:bg-gray-50"
                    >
                      <Eye className="w-4 h-4" />
                      Ver
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
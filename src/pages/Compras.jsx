import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ShoppingCart, CheckCircle2, Clock, AlertCircle, Plus,
  Search, TrendingUp, Package, Filter, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import DashboardCompras from '../components/compras/DashboardCompras';
import FluxoTimeline from '../components/compras/FluxoTimeline';
import SolicitarCompraModal from '../components/compras/SolicitarCompraModal';
import RequisicaoDetalheFluxo from '../components/compras/RequisicaoDetalheFluxo';
import { CardGridSkeleton } from '@/components/shared/Skeletons';

export default function Compras() {
  return (
    <RouteGuardFinalV2 requiredPermissionKey="COMPRAS_VIEW">
      <ComprasContent />
    </RouteGuardFinalV2>
  );
}

// ── Status config ──────────────────────────────────────────────────────────
const STATUS_CFG = {
  aguardando:          { label: 'Aguardando',   bg: 'bg-amber-100',  text: 'text-amber-800',  etapa: 'requisicao' },
  aguardando_aprovacao: { label: 'Aguardando',   bg: 'bg-amber-100',  text: 'text-amber-800',  etapa: 'requisicao' },
  aprovada:            { label: 'Aprovada',      bg: 'bg-emerald-100',text: 'text-emerald-800',etapa: 'cotacao'    },
  em_cotacao:          { label: 'Em Cotação',    bg: 'bg-blue-100',   text: 'text-blue-800',   etapa: 'cotacao'    },
  em_compra:           { label: 'Em Compra',     bg: 'bg-purple-100', text: 'text-purple-800', etapa: 'ordem'      },
  recebida:            { label: 'Recebida',      bg: 'bg-emerald-100',text: 'text-emerald-800',etapa: 'recebimento'},
  comprada:            { label: 'No Financeiro', bg: 'bg-indigo-100', text: 'text-indigo-800', etapa: 'financeiro' },
  cancelada:           { label: 'Cancelada',     bg: 'bg-red-100',    text: 'text-red-800',    etapa: 'requisicao' },
  recusada:            { label: 'Recusada',      bg: 'bg-red-100',    text: 'text-red-800',    etapa: 'requisicao' },
};

// Reflete a aprovação mesmo se o stage não avançou (robustez entre telas).
const statusEfetivoReq = (req) => {
  if (req.fluxo_concluido) return 'comprada';
  if (STATUS_CFG[req.status] && req.status !== 'aguardando' && req.status !== 'aguardando_aprovacao') return req.status;
  if (req.status_aprovacao === 'aprovada') return 'em_cotacao';
  if (req.status_aprovacao === 'recusada') return 'recusada';
  return req.status || 'aguardando_aprovacao';
};

// Casa a requisição com a aba de filtro (trata o alias aguardando/aguardando_aprovacao).
const matchFiltro = (req, f) => {
  const eff = statusEfetivoReq(req);
  if (f === 'aguardando_aprovacao') return eff === 'aguardando' || eff === 'aguardando_aprovacao';
  return eff === f;
};
const FILTROS = ['todas', 'aguardando_aprovacao', 'em_cotacao', 'em_compra', 'recebida', 'comprada'];
const FILTRO_LABELS = {
  todas: 'Todas',
  aguardando_aprovacao: 'Aguardando',
  em_cotacao: 'Em Cotação',
  em_compra: 'Em Compra',
  recebida: 'Recebidas',
  comprada: 'Financeiro',
};

const fmtBRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDt  = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

function ComprasContent() {
  const [filtro, setFiltro] = useState('todas');
  const [busca, setBusca] = useState('');
  const [modalSolicitar, setModalSolicitar] = useState(false);
  const [requisicaoDetalhe, setRequisicaoDetalhe] = useState(null);
  const qc = useQueryClient();

  const { data: requisicoes = [], isLoading } = useQuery({
    queryKey: ['requisicoes-compra'],
    queryFn: () => base44.entities.RequisicaoCompra.list('-updated_date', 200),
  });

  const { data: ordensCompra = [] } = useQuery({
    queryKey: ['ordens-compra'],
    queryFn: () => base44.entities.OrdemCompra.list('-updated_date', 200),
  });

  // ── KPIs ──
  const kpis = useMemo(() => {
    const mesAtual = new Date();
    mesAtual.setDate(1); mesAtual.setHours(0, 0, 0, 0);

    const doMes = requisicoes.filter(r => new Date(r.created_date) >= mesAtual);
    const valorTotal = ordensCompra.reduce((s, o) => s + (o.valor_total || 0), 0);
    const concluidas = requisicoes.filter(r => r.status === 'recebida').length;

    const temposAprovacao = requisicoes
      .filter(r => r.data_aprovacao && r.created_date)
      .map(r => (new Date(r.data_aprovacao) - new Date(r.created_date)) / 86400000);
    const tempoMedio = temposAprovacao.length
      ? (temposAprovacao.reduce((a, b) => a + b, 0) / temposAprovacao.length).toFixed(1)
      : '—';

    return { valorTotal, totalMes: doMes.length, total: requisicoes.length, concluidas, tempoMedio };
  }, [requisicoes, ordensCompra]);

  // ── Filtro + busca ──
  const requisicoesFiltradas = useMemo(() => {
    let list = filtro === 'todas' ? requisicoes : requisicoes.filter(r => matchFiltro(r, filtro));
    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter(r =>
        (r.titulo || '').toLowerCase().includes(q) ||
        (r.descricao_resumo || '').toLowerCase().includes(q) ||
        (r.solicitante_nome || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [requisicoes, filtro, busca]);

  // Se está vendo detalhe
  if (requisicaoDetalhe) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <RequisicaoDetalheFluxo
          requisicaoId={requisicaoDetalhe}
          onVoltar={() => { setRequisicaoDetalhe(null); qc.invalidateQueries(['requisicoes-compra']); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 py-6">

      {/* ── HEADER ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fluxo de Compras</h1>
          <p className="text-sm text-gray-500 mt-0.5">Requisição → Cotação → Ordem → Recebimento → Financeiro</p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700 shadow font-semibold gap-2 px-5"
          onClick={() => setModalSolicitar(true)}
        >
          <ShoppingCart className="w-4 h-4" /> Solicitar Compra
        </Button>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1 text-gray-500 text-xs">
              <TrendingUp className="w-3.5 h-3.5" /> Valor Total (OCs)
            </div>
            <div className="text-xl font-bold text-blue-600">{fmtBRL(kpis.valorTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1 text-gray-500 text-xs">
              <Package className="w-3.5 h-3.5" /> Requisições
            </div>
            <div className="text-xl font-bold text-gray-900">{kpis.total}</div>
            <div className="text-xs text-gray-400">{kpis.totalMes} este mês</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1 text-gray-500 text-xs">
              <Clock className="w-3.5 h-3.5" /> Tempo Médio Aprovação
            </div>
            <div className="text-xl font-bold text-orange-600">{kpis.tempoMedio} {kpis.tempoMedio !== '—' ? 'dias' : ''}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1 text-gray-500 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" /> Concluídas
            </div>
            <div className="text-xl font-bold text-emerald-600">{kpis.concluidas}</div>
          </CardContent>
        </Card>
      </div>

      {/* ── DASHBOARD GRÁFICOS ── */}
      <DashboardCompras requisicoes={requisicoes} />

      {/* ── LISTA DE REQUISIÇÕES ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-900">Requisições</h2>
          <div className="flex items-center gap-2 flex-1 min-w-0 max-w-xs">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <Input
              placeholder="Buscar..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          {FILTROS.map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filtro === f
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {FILTRO_LABELS[f]}
              {f !== 'todas' && (
                <span className="ml-1 opacity-70">
                  ({requisicoes.filter(r => matchFiltro(r, f)).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Lista */}
        {isLoading ? (
          <CardGridSkeleton count={5} cols="grid-cols-1" />
        ) : requisicoesFiltradas.length === 0 ? (
          <Card>
            <CardContent className="py-14 text-center">
              <ShoppingCart className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhuma requisição encontrada</p>
              <p className="text-sm text-gray-400 mt-1">
                {filtro !== 'todas' ? 'Tente outro filtro ou ' : ''}
                clique em "Solicitar Compra" para criar a primeira.
              </p>
              <Button className="mt-4 bg-blue-600 hover:bg-blue-700" onClick={() => setModalSolicitar(true)}>
                <Plus className="w-4 h-4 mr-2" /> Solicitar Compra
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {requisicoesFiltradas.map(req => {
              const cfg = STATUS_CFG[statusEfetivoReq(req)] || STATUS_CFG['aguardando_aprovacao'];
              const etapa = cfg.etapa;
              const isUrgente = req.prioridade === 'urgente';

              return (
                <Card
                  key={req.id}
                  className={`hover:shadow-md transition-shadow cursor-pointer border ${isUrgente ? 'border-red-200' : ''}`}
                  onClick={() => setRequisicaoDetalhe(req.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Título + badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-gray-900 text-sm truncate">
                            {req.titulo || (req.solicitante_nome ? `Solicitação de ${req.solicitante_nome}` : (req.descricao_resumo || 'Requisição de compra'))}
                          </h3>
                          <Badge className={`${req.fluxo_concluido ? 'bg-emerald-100 text-emerald-800' : `${cfg.bg} ${cfg.text}`} text-xs`}>{req.fluxo_concluido ? 'Concluída' : cfg.label}</Badge>
                          {isUrgente && <Badge className="bg-red-100 text-red-700 text-xs">Urgente</Badge>}
                        </div>

                        {/* Descrição */}
                        {req.descricao_resumo && (
                          <p className="text-xs text-gray-500 mb-2 truncate">{req.descricao_resumo}</p>
                        )}

                        {/* Metadados */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span>{req.solicitante_nome}</span>
                          <span>{fmtDt(req.data_solicitacao)}</span>
                          {req.qtd_itens > 0 && <span>{req.qtd_itens} item(ns)</span>}
                          {req.valor_total_estimado > 0 && <span>{fmtBRL(req.valor_total_estimado)}</span>}
                        </div>

                        {/* Timeline compacta */}
                        <div className="mt-3">
                          <FluxoTimeline etapaAtual={etapa} statusEtapaAtual={req.status === 'cancelada' ? 'cancelado' : (req.fluxo_concluido ? 'concluido' : 'ativo')} compact />
                        </div>
                      </div>

                      <Button variant="ghost" size="icon" className="flex-shrink-0 text-gray-400 hover:text-blue-600">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Solicitar Compra */}
      <SolicitarCompraModal
        open={modalSolicitar}
        onClose={() => setModalSolicitar(false)}
        onSuccess={(data) => {
          setModalSolicitar(false);
          setRequisicaoDetalhe(data.id);
        }}
      />
    </div>
  );
}
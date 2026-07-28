import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  FileText, ShoppingCart, Package, DollarSign, CheckCircle2,
  Clock, AlertCircle, ChevronRight, ArrowLeft, Loader2, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import CotacaoForm from './CotacaoForm';
import GerarOCDaCotacao from './GerarOCDaCotacao';
import FormRecebimento from './FormRecebimento';

// ── Helpers ───────────────────────────────────────────────────────────────
const fmtBRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDt  = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const PRIORIDADE_COLORS = {
  urgente: 'bg-red-100 text-red-700',
  alta: 'bg-orange-100 text-orange-700',
  normal: 'bg-blue-100 text-blue-700',
  baixa: 'bg-gray-100 text-gray-600',
};

const STATUS_ETAPA = {
  pendente:  { icon: Clock,        cls: 'text-amber-500', bg: 'bg-amber-50 border-amber-200' },
  ativo:     { icon: Clock,        cls: 'text-blue-500',  bg: 'bg-blue-50 border-blue-200'   },
  concluido: { icon: CheckCircle2, cls: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-200' },
  cancelado: { icon: AlertCircle,  cls: 'text-red-500',   bg: 'bg-red-50 border-red-200'     },
};

function EtapaCard({ titulo, icon: Icon, status = 'pendente', data, responsavel, valor, children, actions }) {
  const cfg = STATUS_ETAPA[status] || STATUS_ETAPA.pendente;
  const IconStatus = cfg.icon;
  return (
    <div className={`border rounded-xl p-4 ${cfg.bg}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-gray-600" />
          <span className="font-semibold text-gray-800 text-sm">{titulo}</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <IconStatus className={`w-3.5 h-3.5 ${cfg.cls}`} />
          <span className={cfg.cls + ' capitalize font-medium'}>{status}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 mb-3">
        {data && <span>Data: <strong>{fmtDt(data)}</strong></span>}
        {responsavel && <span>Resp.: <strong>{responsavel}</strong></span>}
        {valor != null && <span>Valor: <strong>{fmtBRL(valor)}</strong></span>}
      </div>
      {children}
      {actions && <div className="flex flex-wrap gap-2 mt-3">{actions}</div>}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────
export default function RequisicaoDetalheFluxo({ requisicaoId, onVoltar }) {
  const qc = useQueryClient();
  const [modalCotacao, setModalCotacao] = useState(false);
  const [modalOC, setModalOC] = useState(false);
  const [modalRecebimento, setModalRecebimento] = useState(false);
  const [ocParaReceber, setOcParaReceber] = useState(null);

  const { data: user } = useQuery({ queryKey: ['user'], queryFn: () => base44.auth.me() });

  const { data: req, isLoading: loadingReq } = useQuery({
    queryKey: ['req-detalhe', requisicaoId],
    queryFn: async () => {
      const r = await base44.entities.RequisicaoCompra.filter({ id: requisicaoId });
      return r[0];
    },
    enabled: !!requisicaoId,
  });

  const { data: cotacoes = [] } = useQuery({
    queryKey: ['cotacoes-req', requisicaoId],
    queryFn: () => base44.entities.CotacaoFornecedor.filter({ requisicao_id: requisicaoId }),
    enabled: !!requisicaoId,
  });

  const { data: ordens = [] } = useQuery({
    queryKey: ['ordens-req', requisicaoId],
    queryFn: () => base44.entities.OrdemCompra.filter({ requisicao_id: requisicaoId }),
    enabled: !!requisicaoId,
  });

  const { data: recebimentos = [] } = useQuery({
    queryKey: ['receb-req', requisicaoId],
    queryFn: () => base44.entities.RecebimentoMaterial.filter({ requisicao_id: requisicaoId }),
    enabled: !!requisicaoId,
  });

  const invalidateAll = () => {
    qc.invalidateQueries(['req-detalhe', requisicaoId]);
    qc.invalidateQueries(['cotacoes-req', requisicaoId]);
    qc.invalidateQueries(['ordens-req', requisicaoId]);
    qc.invalidateQueries(['receb-req', requisicaoId]);
    qc.invalidateQueries(['requisicoes-compra']);
  };

  const aprovarMutation = useMutation({
    mutationFn: () => base44.entities.RequisicaoCompra.update(requisicaoId, {
      status_aprovacao: 'aprovada',
      status: 'em_cotacao',
      aprovado_por: user?.email,
      data_aprovacao: new Date().toISOString(),
    }),
    onSuccess: () => { toast.success('Requisição aprovada!'); invalidateAll(); },
  });

  // Gera a conta a pagar (Financeiro / Contas a Pagar) + custo da obra a partir
  // da OC. Idempotente no fluxo: só é chamada quando ainda não foi para o financeiro.
  const gerarContaPagar = async () => {
    // Idempotente: se já existe conta a pagar desta requisição, não cria outra
    // (evita duplicar por duplo-clique / corrida entre "Enviar" e "Concluir").
    const jaExiste = await base44.entities.ContaFinanceira
      .filter({ requisicao_id: requisicaoId, tipo: 'pagar' }).catch(() => []);
    if (jaExiste.length > 0) return;

    const oc = ordens[0];
    const valor = oc?.valor_total || req.valor_compra || 0;
    const venc = new Date();
    venc.setDate(venc.getDate() + 30);
    await base44.entities.ContaFinanceira.create({
      tipo: 'pagar',
      obra_id: req.obra_id || null,
      descricao: `Compra - OC ${oc?.numero || ''} (${req.titulo || 'Requisição'})`,
      fornecedor_cliente: oc?.fornecedor || req.fornecedor_escolhido || null,
      valor,
      status: 'pendente',
      categoria: 'compras',
      data_emissao: new Date().toISOString().split('T')[0],
      data_vencimento: venc.toISOString().split('T')[0],
      referencia_tipo: 'ordem_compra',
      referencia_id: oc?.id || null,
      requisicao_id: requisicaoId,
      ordem_compra_id: oc?.id || null,
    });
    // Obs.: NÃO cria LancamentoCustoObra — a DRE já contabiliza o custo pela
    // ContaFinanceira; criar os dois duplicava o custo de material no relatório.
  };

  const enviarFinanceiroMutation = useMutation({
    mutationFn: async () => {
      await gerarContaPagar();
      await base44.entities.RequisicaoCompra.update(requisicaoId, { status: 'comprada' });
    },
    onSuccess: () => { toast.success('Enviado ao financeiro! Conta a pagar gerada.'); invalidateAll(); },
    onError: (err) => { toast.error('Erro ao enviar ao financeiro: ' + (err?.message || 'tente novamente')); },
  });

  const concluirMutation = useMutation({
    mutationFn: async () => {
      // Se ainda não foi enviada ao financeiro, gera a conta a pagar agora
      // (um clique conclui todo o fluxo a partir do recebimento).
      if (req.status !== 'comprada') {
        await gerarContaPagar();
      }
      await base44.entities.RequisicaoCompra.update(requisicaoId, {
        status: 'comprada',
        fluxo_concluido: true,
        data_conclusao: new Date().toISOString(),
      });
    },
    onSuccess: () => { toast.success('Requisição concluída!'); invalidateAll(); },
    onError: (err) => { toast.error('Erro ao concluir: ' + (err?.message || 'tente novamente')); },
  });

  // Vincular OC à requisição se não tiver. (Mantido aqui, antes de qualquer
  // return condicional, para não violar a ordem dos hooks — React error #310.)
  const vincularOcMutation = useMutation({
    mutationFn: (ocId) => base44.entities.OrdemCompra.update(ocId, { requisicao_id: requisicaoId }),
    onSuccess: () => { toast.success('OC vinculada ao fluxo'); invalidateAll(); },
  });

  if (loadingReq) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );
  if (!req) return <div className="text-center py-10 text-gray-500">Requisição não encontrada</div>;

  // ── Status derivados ──
  const isAprovada = req.status_aprovacao === 'aprovada';
  const temCotacao = cotacoes.length > 0;
  const cotacaoAprovada = cotacoes.find(c => c.status === 'selecionada' || c.status === 'aprovada');
  const temOC = ordens.length > 0;
  const ocEmitida = ordens.find(o => o.status === 'emitida' || o.status === 'confirmada' || o.status === 'parcial');
  const temRecebimento = recebimentos.length > 0;
  const recebimentoTotal = recebimentos.find(r => r.status === 'recebido_total' || r.status_entrega === 'recebido_total');
  const isConcluida = !!req.fluxo_concluido;

  const perfisQueAprovam = ['admin', 'programador', 'owner', 'superadmin', 'gestao', 'engenharia', 'financeiro', 'compras'];
  const podeAprovar = !isAprovada && (
    perfisQueAprovam.includes(user?.role) || perfisQueAprovam.includes(user?.perfil_acesso)
  );
  const podeCotacao = isAprovada && !temCotacao;
  const podeOC = temCotacao && !temOC;
  const podeRecebimento = temOC && !recebimentoTotal;
  const podeFinanceiro = (temRecebimento || recebimentoTotal) && req.status !== 'comprada';
  const podeConcluir = !req.fluxo_concluido && (req.status === 'comprada' || temRecebimento || recebimentoTotal);

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onVoltar} className="text-gray-500">
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 truncate">{req.titulo || (req.solicitante_nome ? `Solicitação de ${req.solicitante_nome}` : (req.descricao_resumo || 'Requisição de compra'))}</h2>
          <p className="text-xs text-gray-500">{fmtDt(req.data_solicitacao)}{req.solicitante_nome ? ` · ${req.solicitante_nome}` : ''}</p>
        </div>
        <Badge className={PRIORIDADE_COLORS[req.prioridade] || 'bg-gray-100 text-gray-600'}>
          {req.prioridade}
        </Badge>
      </div>

      {req.descricao_resumo && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{req.descricao_resumo}</p>
      )}

      {/* Itens da requisição */}
      {req.itens?.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Itens ({req.itens.length})
          </div>
          <div className="divide-y">
            {req.itens.map((item, i) => (
              <div key={i} className="px-4 py-2 flex items-center justify-between text-sm">
                <span className="text-gray-800">{item.descricao}</span>
                <span className="text-gray-500">{item.quantidade_solicitada} {item.unidade}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ETAPAS DO FLUXO ── */}
      <div className="space-y-3">

        {/* 1. Requisição */}
        <EtapaCard
          titulo="1. Requisição"
          icon={FileText}
          status={isAprovada ? 'concluido' : req.status_aprovacao === 'rejeitada' ? 'cancelado' : 'ativo'}
          data={req.data_solicitacao}
          responsavel={req.solicitante_nome}
          actions={podeAprovar ? [
            <Button key="ap" size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => aprovarMutation.mutate()} disabled={aprovarMutation.isPending}>
              {aprovarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Aprovar Requisição
            </Button>
          ] : undefined}
        />

        {/* 2. Cotação */}
        <EtapaCard
          titulo="2. Cotação"
          icon={FileText}
          status={!isAprovada ? 'pendente' : cotacaoAprovada ? 'concluido' : temCotacao ? 'ativo' : 'pendente'}
          data={cotacoes[0]?.created_date}
          responsavel={cotacoes[0]?.fornecedor}
          valor={cotacaoAprovada?.valor_total}
        >
          {temCotacao && (
            <div className="space-y-1">
              {cotacoes.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between text-xs bg-white rounded px-3 py-1.5 border">
                  <span className="text-gray-700">{c.fornecedor || `Fornecedor ${i + 1}`}</span>
                  <div className="flex items-center gap-2">
                    {c.valor_total ? <span className="font-medium">{fmtBRL(c.valor_total)}</span> : null}
                    <Badge className={c.status === 'aprovada' || c.status === 'selecionada' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}>
                      {c.status || 'pendente'}
                    </Badge>
                    {!cotacaoAprovada && (
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={async () => {
                        await base44.entities.CotacaoFornecedor.update(c.id, { status: 'aprovada' });
                        invalidateAll();
                        toast.success('Cotação aprovada!');
                      }}>
                        Selecionar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {podeCotacao && (
            <div className="mt-2">
              <Button size="sm" variant="outline" className="gap-1 border-blue-300 text-blue-700" onClick={() => setModalCotacao(true)}>
                <FileText className="w-4 h-4" /> Criar Cotação
              </Button>
            </div>
          )}
        </EtapaCard>

        {/* 3. Ordem de Compra */}
        <EtapaCard
          titulo="3. Ordem de Compra (OC)"
          icon={ShoppingCart}
          status={!temCotacao ? 'pendente' : ordens.length > 0 ? (recebimentoTotal ? 'concluido' : 'ativo') : 'pendente'}
          data={ordens[0]?.created_date}
          valor={ordens[0]?.valor_total}
        >
          {ordens.length > 0 && (
            <div className="space-y-1">
              {ordens.map(oc => (
                <div key={oc.id} className="flex items-center justify-between text-xs bg-white rounded px-3 py-1.5 border">
                  <span className="text-gray-700">OC #{oc.numero || oc.id.slice(-6)}</span>
                  <div className="flex items-center gap-2">
                    {oc.valor_total ? <span className="font-medium">{fmtBRL(oc.valor_total)}</span> : null}
                    <Badge className="bg-blue-100 text-blue-700">{oc.status || 'emitida'}</Badge>
                    {podeRecebimento && (
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => {
                        setOcParaReceber(oc);
                        setModalRecebimento(true);
                      }}>
                        Registrar Recebimento
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {podeOC && (
            <div className="mt-2">
              <Button size="sm" variant="outline" className="gap-1 border-blue-300 text-blue-700" onClick={() => setModalOC(true)}>
                <ShoppingCart className="w-4 h-4" /> Gerar OC
              </Button>
            </div>
          )}
        </EtapaCard>

        {/* 4. Recebimento */}
        <EtapaCard
          titulo="4. Recebimento"
          icon={Package}
          status={!temOC ? 'pendente' : recebimentoTotal ? 'concluido' : temRecebimento ? 'ativo' : 'pendente'}
          data={recebimentos[0]?.created_date}
        >
          {recebimentos.length > 0 && (
            <div className="space-y-1">
              {recebimentos.map(r => (
                <div key={r.id} className="flex items-center justify-between text-xs bg-white rounded px-3 py-1.5 border">
                  <span className="text-gray-700">Recebimento {fmtDt(r.data_recebimento || r.created_date)}</span>
                  <Badge className={r.status_entrega === 'recebido_total' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                    {r.status_entrega || r.status || 'parcial'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          {podeRecebimento && !temRecebimento && (
            <div className="mt-2">
              <Button size="sm" variant="outline" className="gap-1 border-amber-300 text-amber-700" onClick={() => {
                setOcParaReceber(ordens[0]);
                setModalRecebimento(true);
              }}>
                <Package className="w-4 h-4" /> Registrar Recebimento
              </Button>
            </div>
          )}
        </EtapaCard>

        {/* 5. Financeiro */}
        <EtapaCard
          titulo="5. Financeiro"
          icon={DollarSign}
          status={req.fluxo_concluido ? 'concluido' : req.status === 'comprada' ? 'ativo' : 'pendente'}
          valor={ordens[0]?.valor_total}
        >
          {podeFinanceiro && (
            <Button size="sm" variant="outline" className="gap-1 border-purple-300 text-purple-700 mt-2" onClick={() => enviarFinanceiroMutation.mutate()} disabled={enviarFinanceiroMutation.isPending}>
              {enviarFinanceiroMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
              Enviar ao Financeiro
            </Button>
          )}
          {podeConcluir && (
            <Button size="sm" className="mt-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => concluirMutation.mutate()} disabled={concluirMutation.isPending}>
              {concluirMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Concluir Fluxo
            </Button>
          )}
          {isConcluida && (
            <div className="flex items-center gap-2 text-emerald-600 text-sm mt-1">
              <CheckCircle2 className="w-4 h-4" /> Fluxo de compra concluído
            </div>
          )}
        </EtapaCard>
      </div>

      {/* Modais */}
      <CotacaoForm
        requisicao_id={requisicaoId}
        open={modalCotacao}
        onClose={() => setModalCotacao(false)}
        onSuccess={() => { setModalCotacao(false); invalidateAll(); }}
      />
      <GerarOCDaCotacao
        requisicao_id={requisicaoId}
        open={modalOC}
        onClose={() => setModalOC(false)}
        onSuccess={() => { setModalOC(false); invalidateAll(); }}
      />
      {ocParaReceber && (
        <FormRecebimento
          oc={ocParaReceber}
          open={modalRecebimento}
          onClose={() => { setModalRecebimento(false); setOcParaReceber(null); }}
          onSuccess={() => { setModalRecebimento(false); setOcParaReceber(null); invalidateAll(); }}
        />
      )}
    </div>
  );
}
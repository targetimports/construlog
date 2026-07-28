import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Edit, LayoutDashboard, DollarSign, ShoppingCart,
  Wrench, Truck, FileSignature, Receipt, Clock, BarChart3, Info } from
'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import BannerPendenciasObra from '../components/obra/BannerPendenciasObra';
import WorkspacePainel from '../components/workspace/WorkspacePainel';
import GestaoFinanceiraObra from '../components/obra/GestaoFinanceiraObra';
import ComprasDaObra from '../components/obra/ComprasDaObra';
import OperacoesObra from '../components/obra/OperacoesObra';
import MenuOperacoes from '../components/obra/MenuOperacoes';
import GestaoEquipamentosObra from '../components/obra/GestaoEquipamentosObra';
import ContratosObra from '../components/obra/ContratosObra';
import GerenciadorDocumentosObra from '../components/obra/GerenciadorDocumentosObra';
import ContasReceberObra from '../components/conta-receber/ContasReceberObra';
import CronogramaObraTab from '../components/obra/CronogramaObraTab';
import OrcamentoPlanejadoTab from '../components/obra/OrcamentoPlanejadoTab';
import FinanceiroObraTab from '../components/obra/FinanceiroObraTab';

const ABAS = [
{ id: 'painel', label: 'Painel', icon: LayoutDashboard },
{ id: 'financeiro', label: 'Financeiro', icon: DollarSign },
{ id: 'compras', label: 'Compras', icon: ShoppingCart },
{ id: 'operacoes', label: 'Operações', icon: Wrench },
{ id: 'equipamentos', label: 'Equipamentos', icon: Truck },
{ id: 'contratos', label: 'Contratos', icon: FileSignature },
{ id: 'contas_receber', label: 'Conta a Receber', icon: Receipt },
{ id: 'cronograma', label: 'Cronograma', icon: Clock },
{ id: 'orc_planejado', label: 'Orçamento Planejado', icon: BarChart3 },
{ id: 'informacoes', label: 'Informações', icon: Info }];


const statusConfig = {
  planejamento: { label: 'Planejamento', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  orcamento: { label: 'Orçamento', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  em_andamento: { label: 'Em Andamento', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  pausada: { label: 'Pausada', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  concluida: { label: 'Concluída', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-700 border-red-200' }
};

export default function ObraWorkspace() {
  const urlParams = new URLSearchParams(window.location.search);
  const obraId = urlParams.get('id') || urlParams.get('obraId');
  const abaUrl = urlParams.get('aba') || 'painel';
  const [abaAtiva, setAbaAtiva] = useState(abaUrl);
  const [operacaoSelecionada, setOperacaoSelecionada] = useState('resumo');

  const { data: user } = useQuery({ queryKey: ['user'], queryFn: () => base44.auth.me() });
  const { data: obraData, isLoading } = useQuery({
    queryKey: ['obra', obraId],
    queryFn: () => base44.entities.Obra.filter({ id: obraId }),
    enabled: !!obraId
  });
  const { data: contas = [] } = useQuery({
    queryKey: ['contas-obra', obraId],
    queryFn: () => base44.entities.ContaFinanceira.filter({ obra_id: obraId }),
    enabled: !!obraId
  });

  if (isLoading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>);


  const obra = obraData?.[0];
  if (!obra) return (
    <div className="p-12 text-center">
      <p className="text-gray-500 mb-4">Obra não encontrada</p>
      <Link to={createPageUrl('Obras')}><Button>Voltar</Button></Link>
    </div>);


  const status = statusConfig[obra.status] || statusConfig.planejamento;

  const mudarAba = (id) => {
    setAbaAtiva(id);
    const url = new URL(window.location.href);
    url.searchParams.set('aba', id);
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="bg-gray-50 flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost" size="icon"
              onClick={() => window.location.href = createPageUrl(`ObraDetalhes?id=${obraId}`)}
              className="text-gray-500 hover:text-gray-900 flex-shrink-0 h-8 w-8">

              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">{obra.nome}</h1>
                <Badge className={cn('border text-xs flex-shrink-0', status.color)}>{status.label}</Badge>
              </div>
              {obra.cliente && <p className="text-xs text-gray-500 truncate">{obra.cliente}</p>}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link to={createPageUrl(`ObraDetalhes?id=${obraId}`)}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                <LayoutDashboard className="w-3 h-3" /> Padrão
              </Button>
            </Link>
            <Link to={createPageUrl(`ObraForm?id=${obraId}`)}>
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-gray-900 gap-1.5 text-xs h-7">
                <Edit className="w-3 h-3" /> Editar
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Corpo: sidebar de seções + conteúdo */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-60 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Workspace</h2>
          </div>
          <nav className="p-3 space-y-1">
            {ABAS.map((aba) => {
              const Icon = aba.icon;
              const ativa = abaAtiva === aba.id;
              return (
                <button
                  key={aba.id}
                  onClick={() => mudarAba(aba.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm',
                    ativa ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  )}
                >
                  <Icon className={cn('w-[18px] h-[18px] flex-shrink-0', ativa ? 'text-gray-900' : 'text-gray-400')} />
                  {aba.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0 overflow-auto bg-gray-50">
          {/* Banner de completude */}
          <div className="px-4 sm:px-6 pt-3">
            <BannerPendenciasObra
              obra={obra}
              autoOpenIfPending={false}
              readOnly={user?.role !== 'admin' && user?.role !== 'programador' && user?.perfil_acesso !== 'engenharia' && user?.perfil_acesso !== 'gerente'}
              onSaved={() => {}} />
          </div>

          <div className="p-4 sm:p-6">
        {abaAtiva === 'painel' &&
        <WorkspacePainel obra={obra} obraId={obraId} contas={contas} user={user} />
        }
        {abaAtiva === 'financeiro' &&
        <GestaoFinanceiraObra obraId={obraId} obraNome={obra.nome} user={user} />
        }
        {abaAtiva === 'compras' &&
        <ComprasDaObra obraId={obraId} />
        }
        {abaAtiva === 'operacoes' &&
        <div className="flex gap-6">
            <MenuOperacoes selected={operacaoSelecionada} onSelect={setOperacaoSelecionada} />
            <div className="flex-1 space-y-6">
              {operacaoSelecionada === 'resumo' &&
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <OperacoesObra obraId={obraId} tipo="material" />
                  <OperacoesObra obraId={obraId} tipo="mao_obra" />
                </div>
            }
              {['nf', 'mao_obra', 'material', 'alimentacao', 'aluguel', 'frete', 'estadia', 'imposto', 'retirada'].map((tipo) =>
            operacaoSelecionada === tipo ? <OperacoesObra key={tipo} obraId={obraId} tipo={tipo} /> : null
            )}
            </div>
          </div>
        }
        {abaAtiva === 'equipamentos' &&
        <GestaoEquipamentosObra obraId={obraId} />
        }
        {abaAtiva === 'contratos' &&
        <div className="space-y-6">
            <GerenciadorDocumentosObra obraId={obraId} user={user} />
            <ContratosObra obraId={obraId} obraStatus={obra.status} />
          </div>
        }
        {abaAtiva === 'contas_receber' &&
        <ContasReceberObra obraId={obraId} />
        }
        {abaAtiva === 'cronograma' &&
        <CronogramaObraTab obraId={obraId} />
        }
        {abaAtiva === 'orc_planejado' &&
        <>
            <OrcamentoPlanejadoTab obraId={obraId} />
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumo Financeiro</h3>
              <FinanceiroObraTab obraId={obraId} />
            </div>
          </>
        }
        {abaAtiva === 'informacoes' &&
        <WorkspaceInfoObra obra={obra} obraId={obraId} />
        }
          </div>
        </div>
      </div>
    </div>);

}

function WorkspaceInfoObra({ obra, obraId }) {
  const { data: historico = [] } = useQuery({
    queryKey: ['historico-obra', obraId],
    queryFn: () => base44.entities.HistoricoObra.filter({ obra_id: obraId }, '-data_hora', 50),
    enabled: !!obraId
  });

  const campos = [
  { label: 'Cliente', value: obra.cliente },
  { label: 'Localização', value: obra.localizacao },
  { label: 'Status', value: obra.status },
  { label: 'Data Início', value: obra.data_inicio ? new Date(obra.data_inicio).toLocaleDateString('pt-BR') : null },
  { label: 'Previsão de Término', value: obra.data_prevista_fim ? new Date(obra.data_prevista_fim).toLocaleDateString('pt-BR') : null },
  { label: 'Responsável Técnico', value: obra.responsavel_tecnico },
  { label: 'Responsável Administrativo', value: obra.responsavel_administrativo },
  { label: 'Responsável Financeiro', value: obra.responsavel_financeiro },
  { label: 'Centro de Custo', value: obra.centro_custo },
  { label: 'Número do Contrato', value: obra.contrato_numero },
  { label: 'Órgão Público', value: obra.orgao_publico }].
  filter((c) => c.value);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Dados da Obra</h2>
          <Link to={createPageUrl(`ObraForm?id=${obraId}`)}>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <Edit className="w-3.5 h-3.5" /> Editar
            </Button>
          </Link>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {campos.map((c) =>
          <div key={c.label}>
              <dt className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</dt>
              <dd className="text-sm font-medium text-gray-900 mt-0.5">{c.value}</dd>
            </div>
          )}
        </dl>
        {obra.descricao &&
        <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Descrição</p>
            <p className="text-sm text-gray-700">{obra.descricao}</p>
          </div>
        }
      </div>

      {historico.length > 0 &&
      <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Histórico</h2>
          <div className="space-y-3">
            {historico.map((item) =>
          <div key={item.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{item.descricao}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.usuario} · {new Date(item.data_hora).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
          )}
          </div>
        </div>
      }
    </div>);

}
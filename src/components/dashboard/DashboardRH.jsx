import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import {
  Users, UserPlus, Briefcase, Wallet, ArrowUpRight,
  Clock, ShieldCheck, HardHat, CalendarClock } from
'lucide-react';
import { cn } from '@/lib/utils';

const moeda = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(v) || 0);

const custoColaborador = (c) =>
  Number(c?.remuneracao?.custo_total_mensal_empresa) ||
  Number(c?.remuneracao?.salario_bruto) ||
  Number(c?.salario) || 0;

// Dashboard dedicado ao perfil RH / Dep. Pessoal: usa só dados de Pessoas
// (Colaborador) — quadro ativo, admissões do mês, distribuição por função e
// custo estimado de folha — com atalhos para as rotinas de RH.
export default function DashboardRH({ colaboradores = [], isLoading }) {
  const navigate = useNavigate();

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-rh-dash'],
    queryFn: () => base44.entities.Empresa.list().catch(() => []),
    staleTime: 300000
  });
  const nomeEmpresa = (id) => {
    const e = empresas.find((x) => x.id === id);
    return e?.nome || e?.nome_fantasia || e?.razao_social || null;
  };

  const ativos = colaboradores.filter((c) => (c.status || 'ativo') === 'ativo');
  const totalAtivos = ativos.length;

  const agora = new Date();
  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const admitidosMes = colaboradores.filter((c) => String(c.data_admissao || '').slice(0, 7) === mesAtual);

  const custoFolha = ativos.reduce((s, c) => s + custoColaborador(c), 0);

  // Distribuição por função (cargo), ordenada por quantidade.
  const porFuncaoMap = {};
  ativos.forEach((c) => {
    const f = (c.cargo || c.funcao || 'Sem função').trim();
    porFuncaoMap[f] = (porFuncaoMap[f] || 0) + 1;
  });
  const porFuncao = Object.entries(porFuncaoMap).sort((a, b) => b[1] - a[1]);
  const maxFuncao = porFuncao.length ? porFuncao[0][1] : 1;

  // Distribuição por empresa (só se conseguir resolver nomes).
  const porEmpresaMap = {};
  ativos.forEach((c) => {
    const nome = nomeEmpresa(c.empresa_id);
    if (nome) porEmpresaMap[nome] = (porEmpresaMap[nome] || 0) + 1;
  });
  const porEmpresa = Object.entries(porEmpresaMap).sort((a, b) => b[1] - a[1]);

  // Admissões mais recentes.
  const admissoesRecentes = [...colaboradores]
    .filter((c) => c.data_admissao)
    .sort((a, b) => String(b.data_admissao).localeCompare(String(a.data_admissao)))
    .slice(0, 6);

  const fmtData = (d) => {
    if (!d) return '';
    const [y, m, dia] = String(d).slice(0, 10).split('-');
    return `${dia}/${m}/${y}`;
  };

  const atalhos = [
    { label: 'Colaboradores', desc: 'Cadastro e acesso', page: 'Colaboradores', icon: Users, color: 'text-purple-600', bg: 'bg-purple-500/10' },
    { label: 'Folha de Pagamento', desc: 'Gerar e conferir', page: 'FolhasPagamento', icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
    { label: 'Apontamento de Horas', desc: 'Jornada e horas', page: 'ApontamentoHoras', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-500/10' },
    { label: 'EPIs / SST', desc: 'Segurança do trabalho', page: 'ControleEPIs', icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-500/10' }
  ];

  const kpis = [
    { title: 'Colaboradores Ativos', value: totalAtivos, subtitle: 'No quadro atual', icon: Users, color: 'text-purple-600', bg: 'bg-purple-500/10', page: 'Colaboradores' },
    { title: 'Admissões no Mês', value: admitidosMes.length, subtitle: 'Entradas neste mês', icon: UserPlus, color: 'text-emerald-600', bg: 'bg-emerald-500/10', page: 'Colaboradores' },
    { title: 'Funções Distintas', value: porFuncao.length, subtitle: 'Cargos no quadro', icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-500/10', page: 'GestaoMaoDeObra' },
    { title: 'Folha Estimada / Mês', value: moeda(custoFolha), subtitle: 'Custo total com encargos', icon: Wallet, color: 'text-indigo-600', bg: 'bg-indigo-500/10', page: 'FolhasPagamento' }
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs de RH */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <button
              key={k.title}
              onClick={() => navigate(createPageUrl(k.page))}
              className="text-left bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-500 text-sm">{k.title}</p>
                  <p className="text-gray-900 text-2xl font-bold mt-1">{k.value}</p>
                  <p className="text-gray-400 text-xs mt-1">{k.subtitle}</p>
                </div>
                <div className={cn('p-2.5 rounded-xl', k.bg)}>
                  <Icon className={cn('w-5 h-5', k.color)} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Atalhos de RH */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {atalhos.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.page}
              onClick={() => navigate(createPageUrl(a.page))}
              className="flex items-center gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all text-left">
              <div className={cn('p-2.5 rounded-xl flex-shrink-0', a.bg)}>
                <Icon className={cn('w-5 h-5', a.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-gray-900 text-sm font-semibold truncate">{a.label}</p>
                <p className="text-gray-500 text-xs truncate">{a.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Grid: Quadro por função + Admissões recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quadro por função */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-gray-900 text-base font-semibold flex items-center gap-2">
              <HardHat className="w-4 h-4 text-gray-400" /> Quadro por função
            </h3>
            <button onClick={() => navigate(createPageUrl('GestaoMaoDeObra'))} className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
              Ver mão de obra <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {porFuncao.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum colaborador no quadro</p>
            </div>
          ) : (
            <div className="space-y-3">
              {porFuncao.map(([funcao, qtd]) => (
                <div key={funcao} className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-40 truncate flex-shrink-0">{funcao}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(qtd / maxFuncao) * 100}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 w-8 text-right">{qtd}</span>
                </div>
              ))}
            </div>
          )}

          {porEmpresa.length > 1 && (
            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Por empresa</p>
              <div className="flex flex-wrap gap-2">
                {porEmpresa.map(([nome, qtd]) => (
                  <span key={nome} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-sm text-gray-700">
                    {nome} <span className="font-semibold text-gray-900">{qtd}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Admissões recentes */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-gray-900 text-base font-semibold flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-gray-400" /> Admissões recentes
            </h3>
          </div>
          {admissoesRecentes.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <UserPlus className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhuma admissão registrada</p>
            </div>
          ) : (
            <div className="space-y-1">
              {admissoesRecentes.map((c) => (
                <div
                  key={c.id}
                  onClick={() => navigate(createPageUrl('Colaboradores'))}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                    {(c.nome || '?').split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 text-sm font-medium truncate">{c.nome}</p>
                    <p className="text-gray-500 text-xs truncate">{c.cargo || c.funcao || 'Colaborador'}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{fmtData(c.data_admissao)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

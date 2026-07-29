import React from 'react';
import {
  LayoutDashboard, Calendar, Building2, ShoppingCart, Boxes, Users, Truck,
  FileText, CircleDollarSign, TrendingUp, TrendingDown, ClipboardList, ChevronRight,
  Search, Bell, ChevronDown, DollarSign, Package, FolderOpen, BarChart3, PanelLeft,
  Settings, ArrowLeft, Edit, Home, Plus, User, Menu, MessageCircle,
} from 'lucide-react';
import dados from './mockSistema.json';

// PREVIEW DO SISTEMA NA LANDING
//
// Réplica fiel da tela ObraDetalhes › Visão Geral. Copia a estrutura real:
//   rail de ícones (#18181B) → topbar branca → painel "SEÇÕES" (w-64, branco)
//   → header da obra (voltar, título, badge, cliente | empresa, Editar Obra)
//   → barra "Progresso da obra" → KPIs → cards → diários.
//
// A escala é menor que a do app (cabe num mockup), mas os rótulos, a ordem e as
// cores são os mesmos de ObraDetalhes.jsx, ObraDetalhesSidebar.jsx e
// SecaoVisaoGeral.jsx. Os dados vêm de mockSistema.json — fictícios, nunca de
// cliente real.

const ICONES = {
  LayoutDashboard, Calendar, Building2, ShoppingCart, Boxes, Users, Truck, FileText,
  CircleDollarSign, TrendingUp, TrendingDown, ClipboardList, DollarSign, Package,
  FolderOpen, BarChart3, PanelLeft, Search, Bell, Settings,
};

function Janela({ children, url }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 h-9 border-b border-gray-100 bg-gray-50">
        <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
        <span className="ml-3 rounded-md bg-white border border-gray-200 px-2.5 py-0.5 text-[12px] text-gray-400 truncate">
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}

/** Rail de ícones — a sidebar do sistema fica recolhida, sem texto. */
function Rail() {
  return (
    <aside className="hidden sm:flex w-[48px] shrink-0 flex-col items-center gap-2.5 bg-[#18181B] py-3">
      {dados.menu.map((nome, i) => {
        const Icon = ICONES[nome] || Building2;
        return (
          <span
            key={`${nome}-${i}`}
            className={`grid place-items-center w-7 h-7 rounded-md ${
              i === 4 ? 'bg-white/10 text-white' : 'text-zinc-400'
            }`}
          >
            <Icon className="w-3 h-3" />
          </span>
        );
      })}
    </aside>
  );
}

/** Topbar branca — título da página, "Bem-vindo(a)", chip da empresa, sino e usuário. */
function Topbar({ titulo }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-200/70 bg-white/85 px-3 h-10 shrink-0">
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-gray-900 leading-tight truncate">{titulo}</p>
        <p className="text-[9px] text-gray-500 truncate">
          Bem-vindo(a), <span className="font-semibold text-gray-700">{dados.usuario.nome}</span>
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="hidden md:flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-medium text-gray-700">
          <Building2 className="w-2 h-2" />
          {dados.empresa}
        </span>
        <span className="relative">
          <Bell className="w-3 h-3 text-gray-400" />
          <span className="absolute -top-1 -right-1 grid place-items-center min-w-[10px] h-[10px] rounded-full bg-red-500 px-0.5 text-[7px] font-bold text-white">9+</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="hidden lg:block text-right leading-none">
            <span className="block text-[9px] font-semibold text-gray-900">{dados.usuario.nome.split(' ')[0].toUpperCase()}</span>
            <span className="block text-[8px] text-gray-400">{dados.usuario.papel}</span>
          </span>
          <span className="grid place-items-center w-4 h-4 rounded-full bg-blue-600 text-[8px] font-semibold text-white">
            {dados.usuario.iniciais}
          </span>
          <ChevronDown className="w-2 h-2 text-gray-400" />
        </span>
      </div>
    </div>
  );
}

/** Painel "SEÇÕES" — a navegação interna da obra (bg-white, ativo bg-gray-100). */
function PainelSecoes({ ativa = 'visao_geral' }) {
  return (
    <div className="hidden md:flex w-[150px] lg:w-[168px] shrink-0 flex-col bg-white border-r border-gray-200">
      <div className="px-3 py-2 border-b border-gray-200">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">Seções</p>
      </div>
      <nav className="p-1.5 space-y-0.5">
        {dados.secoes.map((s) => {
          const Icon = ICONES[s.icone] || FileText;
          const isAtiva = s.id === ativa;
          return (
            <div
              key={s.id}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 ${
                isAtiva ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600'
              }`}
            >
              <Icon className={`w-3 h-3 shrink-0 ${isAtiva ? 'text-gray-900' : 'text-gray-400'}`} />
              <span className="text-[10px] truncate">{s.nome}</span>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

function CardKpi({ label, valor, sub, cor, icone }) {
  const Icon = ICONES[icone] || FileText;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-1 mb-1">
        <Icon className="w-2.5 h-2.5 text-gray-400 shrink-0" />
        <span className="text-[9px] text-gray-500 font-medium truncate">{label}</span>
      </div>
      <p className={`text-[12px] font-bold ${cor}`}>{valor}</p>
      {sub && <p className="text-[8px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function LinkSecao({ children }) {
  return (
    <span className="flex items-center gap-0.5 text-[9px] font-medium text-blue-700 shrink-0">
      {children} <ChevronRight className="w-2 h-2" />
    </span>
  );
}

/** Tela 1 — ObraDetalhes › Visão Geral (a tela real, item por item). */
export function MockPainel() {
  const { obra, visaoGeral } = dados;
  return (
    <Janela url={`construlog.com.br/ObraDetalhes?id=${obra.codigo}`}>
      <div className="flex h-[400px] sm:h-[480px] bg-gray-50">
        <Rail />
        <div className="flex-1 min-w-0 flex flex-col">
          <Topbar titulo="Detalhes da Obra" />

          <div className="flex-1 flex min-h-0">
            <PainelSecoes ativa="visao_geral" />

            <div className="flex-1 min-w-0 flex flex-col">
              {/* Header da obra */}
              <div className="border-b border-gray-200 bg-white px-3 py-2.5 shrink-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-1.5 min-w-0">
                    <ArrowLeft className="w-3 h-3 text-gray-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h1 className="text-[15px] font-bold text-gray-900 truncate">{obra.nome}</h1>
                        <span className="rounded-full border border-green-200 bg-green-100 px-1.5 py-0.5 text-[9px] font-medium text-green-800">
                          {obra.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] text-gray-500 truncate">{obra.cliente}</span>
                        <span className="text-gray-300 text-[9px]">|</span>
                        <span className="text-[9px] text-gray-400 truncate">{obra.empresaResponsavel}</span>
                      </div>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[9px] font-medium text-white shrink-0">
                    <Edit className="w-2 h-2" /> Editar Obra
                  </span>
                </div>

                {/* Progresso da obra */}
                <div className="mt-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[8px] font-medium uppercase tracking-wide text-gray-400">Progresso da obra</span>
                    <span className="text-[9px] font-semibold text-gray-700">{obra.percentualExecutado}% concluída</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${obra.percentualExecutado}%` }} />
                  </div>
                </div>
              </div>

              {/* Conteúdo (fundo cinza, como no app) */}
              <div className="flex-1 bg-gray-50 p-3 space-y-2.5 overflow-hidden">
                <div className="grid grid-cols-4 gap-2">
                  {visaoGeral.kpis.map((k) => <CardKpi key={k.label} {...k} />)}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Última Medição */}
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <ClipboardList className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                        <span className="text-[10px] font-semibold text-gray-900">Última Medição</span>
                      </div>
                      <LinkSecao>Ver medições</LinkSecao>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-medium text-gray-700">BM {visaoGeral.ultimaMedicao.numero}</span>
                      <span className="text-[10px] font-bold text-blue-700">{visaoGeral.ultimaMedicao.percentual}% concluída</span>
                    </div>
                    <p className="mt-1 text-[9px] text-gray-500 truncate">
                      Acumulado: <span className="font-semibold text-gray-800">{visaoGeral.ultimaMedicao.acumulado}</span> · até {visaoGeral.ultimaMedicao.data}
                    </p>
                  </div>

                  {/* Contrato & Prazo */}
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <FileText className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                        <span className="text-[10px] font-semibold text-gray-900">Contrato &amp; Prazo</span>
                      </div>
                      <LinkSecao>Ver cronograma</LinkSecao>
                    </div>
                    <div className="space-y-0.5">
                      {[
                        ['Período', visaoGeral.contratoPrazo.periodo],
                        ['Avanço físico', visaoGeral.contratoPrazo.avancoFisico],
                        ['Saldo a executar', visaoGeral.contratoPrazo.saldoExecutar],
                      ].map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between gap-2">
                          <span className="text-[9px] text-gray-500">{k}</span>
                          <span className="text-[9px] text-gray-800 tabular-nums">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Últimos Diários de Obra */}
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1">
                      <FileText className="w-2.5 h-2.5 text-gray-400" />
                      <span className="text-[10px] font-semibold text-gray-900">Últimos Diários de Obra</span>
                    </div>
                    <LinkSecao>Ver diário</LinkSecao>
                  </div>
                  {visaoGeral.diarios.map((d) => (
                    <div key={d.data} className="flex items-center justify-between border-t border-gray-50 py-1">
                      <span className="text-[9px] text-gray-700">{d.data}</span>
                      <span className="text-[9px] text-gray-400">{d.clima}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Botão flutuante do assistente, como no app */}
        <span className="absolute" />
      </div>
    </Janela>
  );
}

/** Tela 2 — Orçamento. */
export function MockOrcamento() {
  const { orcamento } = dados;
  return (
    <Janela url="construlog.com.br/Orcamento">
      <div className="flex h-[400px] sm:h-[480px] bg-gray-50">
        <Rail />
        <div className="flex-1 min-w-0 flex flex-col">
          <Topbar titulo="Orçamento" />
          <div className="flex-1 p-2.5 space-y-2 overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 w-40">
                <Search className="w-2.5 h-2.5 text-gray-400" />
                <span className="text-[9px] text-gray-400">Buscar item...</span>
              </div>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-medium text-blue-800">
                {orcamento.totalItens} itens
              </span>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="grid grid-cols-[54px_1fr_22px_44px_56px_60px] gap-1.5 bg-gray-50 border-b border-gray-200 px-2 py-1.5 text-[8px] font-semibold text-gray-500 uppercase">
                <span>Código</span><span>Descrição</span><span>Un</span>
                <span className="text-right">Qtd</span><span className="text-right">Unitário</span><span className="text-right">Total</span>
              </div>
              {orcamento.itens.map((i) => (
                <div key={i.codigo} className="grid grid-cols-[54px_1fr_22px_44px_56px_60px] gap-1.5 px-2 py-1.5 text-[9px] border-b border-gray-100 last:border-0">
                  <span className="font-mono text-gray-400 truncate">{i.codigo}</span>
                  <span className="text-gray-800 truncate">{i.descricao}</span>
                  <span className="text-gray-400">{i.unidade}</span>
                  <span className="text-right tabular-nums text-gray-600">{i.qtd}</span>
                  <span className="text-right tabular-nums text-gray-600">{i.unitario}</span>
                  <span className="text-right tabular-nums font-semibold text-gray-900">{i.total}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <div className="rounded-lg bg-white border border-gray-200 px-2.5 py-1">
                <span className="text-[9px] text-gray-500">Total do orçamento </span>
                <span className="text-[11px] font-bold text-gray-900 tabular-nums">{orcamento.total}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Janela>
  );
}

/** Tela 3 — Financeiro. */
export function MockFinanceiro() {
  const { financeiro } = dados;
  const badge = (status) => {
    if (status === 'Recebido') return 'bg-emerald-100 text-emerald-800';
    if (status === 'Pago') return 'bg-blue-100 text-blue-800';
    return 'bg-amber-100 text-amber-800';
  };
  return (
    <Janela url="construlog.com.br/Financeiro">
      <div className="flex h-[400px] sm:h-[480px] bg-gray-50">
        <Rail />
        <div className="flex-1 min-w-0 flex flex-col">
          <Topbar titulo="Financeiro" />
          <div className="flex-1 p-2.5 space-y-2 overflow-hidden">
            <div className="grid grid-cols-3 gap-1.5">
              {financeiro.kpis.map((k) => (
                <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-3">
                  <p className="text-[9px] text-gray-500 font-medium">{k.label}</p>
                  <p className={`mt-0.5 text-[12px] font-bold ${k.cor}`}>{k.valor}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="grid grid-cols-[1fr_54px_48px_60px_48px] gap-1.5 bg-gray-50 border-b border-gray-200 px-2 py-1.5 text-[8px] font-semibold text-gray-500 uppercase">
                <span>Descrição</span><span>Categoria</span><span>Vencim.</span>
                <span className="text-right">Valor</span><span className="text-center">Status</span>
              </div>
              {financeiro.lancamentos.map((l) => (
                <div key={l.descricao} className="grid grid-cols-[1fr_54px_48px_60px_48px] gap-1.5 items-center px-2 py-1.5 text-[9px] border-b border-gray-100 last:border-0">
                  <span className="text-gray-800 truncate">{l.descricao}</span>
                  <span className="text-gray-500 truncate">{l.categoria}</span>
                  <span className="text-gray-400">{l.vencimento}</span>
                  <span className={`text-right tabular-nums font-semibold ${l.tipo === 'receber' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {l.tipo === 'receber' ? '+' : '−'}{l.valor}
                  </span>
                  <span className="flex justify-center">
                    <span className={`rounded-full px-1 py-0.5 text-[8px] font-medium ${badge(l.status)}`}>{l.status}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Janela>
  );
}

/** Tela 4 — a MESMA obra, no celular.
 *
 *  Cópia do mobile real: header branco (ícone escuro + "Construlog", sino com
 *  badge, hambúrguer); título grande com o badge de status ABAIXO; "Editar Obra"
 *  ocupando a largura toda; progresso; as seções viram ABAS HORIZONTAIS
 *  roláveis; KPIs em 2 colunas; e a bottom bar em pílula preta flutuante.
 *  No mobile não há topbar de desktop nem sidebar — só isso. */
export function MockDiario() {
  const { obra, visaoGeral, secoes } = dados;
  return (
    <div className="mx-auto w-[248px] rounded-[34px] border-[7px] border-gray-900 bg-gray-900 shadow-[0_30px_60px_-30px_rgba(15,23,42,0.6)]">
      <div className="relative rounded-[27px] bg-gray-50 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 rounded-b-2xl bg-gray-900 z-20" />

        {/* Header mobile */}
        <div className="relative z-10 flex items-center justify-between gap-2 bg-white/85 border-b border-gray-200/70 px-2.5 pt-5 pb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="grid place-items-center w-5 h-5 rounded-md bg-gray-900 text-[9px] font-bold text-white shrink-0">C</span>
            <span className="text-[11px] font-bold tracking-tight text-gray-900 truncate">Construlog</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="relative">
              <Bell className="w-3.5 h-3.5 text-gray-700" />
              <span className="absolute -top-1.5 -right-1.5 grid place-items-center min-w-[12px] h-[12px] rounded-full bg-red-500 px-0.5 text-[7px] font-bold text-white">9+</span>
            </span>
            <Menu className="w-4 h-4 text-gray-700" />
          </div>
        </div>

        <div className="pb-12">
          {/* Cabeçalho da obra — empilhado, como no celular */}
          <div className="bg-white px-3 py-2.5 border-b border-gray-200">
            <div className="flex items-start gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5 text-gray-500 mt-1 shrink-0" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-gray-900 leading-snug">{obra.nome}</p>
                <span className="mt-1 inline-block rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-[9px] font-medium text-green-800">
                  {obra.status}
                </span>
                <p className="mt-1.5 text-[9px] text-gray-500 leading-snug">
                  {obra.cliente} <span className="text-gray-300">|</span>
                </p>
                <p className="text-[9px] text-gray-400 leading-snug">{obra.empresaResponsavel}</p>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-center gap-1 rounded-md bg-blue-600 py-2 text-[10px] font-medium text-white">
              <Edit className="w-3 h-3" /> Editar Obra
            </div>

            <div className="mt-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8px] font-medium uppercase tracking-wide text-gray-400">Progresso da obra</span>
                <span className="text-[9px] font-semibold text-gray-700">{obra.percentualExecutado}% concluída</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${obra.percentualExecutado}%` }} />
              </div>
            </div>
          </div>

          {/* Seções viram abas horizontais roláveis */}
          <div className="bg-white border-b border-gray-200 overflow-hidden">
            <div className="flex gap-1 p-1.5">
              {secoes.slice(0, 3).map((s, i) => {
                const Icon = ICONES[s.icone] || FileText;
                return (
                  <span
                    key={s.id}
                    className={`flex items-center gap-1 rounded-lg px-2 py-1 whitespace-nowrap ${
                      i === 0 ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600'
                    }`}
                  >
                    <Icon className={`w-2.5 h-2.5 shrink-0 ${i === 0 ? 'text-gray-900' : 'text-gray-400'}`} />
                    <span className="text-[9px]">{s.nome}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Conteúdo */}
          <div className="p-2.5 space-y-2">
            {/* KPIs em 2 colunas */}
            <div className="grid grid-cols-2 gap-2">
              {visaoGeral.kpis.map((k) => {
                const Icon = ICONES[k.icone] || FileText;
                return (
                  <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Icon className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                      <span className="text-[8px] text-gray-500 font-medium truncate">{k.label}</span>
                    </div>
                    <p className={`text-[10px] font-bold leading-tight ${k.cor}`}>{k.valor}</p>
                    {k.sub && <p className="text-[7px] text-gray-400">{k.sub}</p>}
                  </div>
                );
              })}
            </div>

            {/* Última Medição */}
            <div className="bg-white border border-gray-200 rounded-lg p-2">
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1 min-w-0">
                  <ClipboardList className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                  <span className="text-[9px] font-semibold text-gray-900">Última Medição</span>
                </div>
                <span className="flex items-center gap-0.5 text-[8px] font-medium text-blue-700 shrink-0">
                  Ver medições <ChevronRight className="w-2 h-2" />
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-gray-700">BM {visaoGeral.ultimaMedicao.numero}</span>
                <span className="text-[10px] font-bold text-blue-700">{visaoGeral.ultimaMedicao.percentual}% concluída</span>
              </div>
              <p className="mt-0.5 text-[8px] text-gray-500 truncate">
                Acumulado: <span className="font-semibold text-gray-800">{visaoGeral.ultimaMedicao.acumulado}</span>
              </p>
            </div>

            {/* Contrato & Prazo — cortado pela dobra, como na tela real */}
            <div className="bg-white border border-gray-200 rounded-lg p-2">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  <FileText className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                  <span className="text-[9px] font-semibold text-gray-900">Contrato &amp; Prazo</span>
                </div>
                <span className="flex items-center gap-0.5 text-[8px] font-medium text-blue-700 shrink-0">
                  Ver cronograma <ChevronRight className="w-2 h-2" />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Botão flutuante do assistente */}
        <span className="absolute right-2.5 bottom-14 grid place-items-center w-7 h-7 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/40">
          <MessageCircle className="w-3.5 h-3.5" />
        </span>

        {/* Bottom bar — pílula preta flutuante */}
        <div className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-around rounded-full bg-[#18181B] px-3 py-1 shadow-[0_12px_30px_rgba(0,0,0,0.4)]">
          <span className="grid place-items-center w-7 h-7 rounded-full text-white/70">
            <Home className="w-3.5 h-3.5" />
          </span>
          <span className="grid place-items-center w-7 h-7 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/40">
            <Plus className="w-3.5 h-3.5" />
          </span>
          <span className="grid place-items-center w-7 h-7 rounded-full text-white/70">
            <User className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

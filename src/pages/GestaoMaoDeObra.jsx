import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Users, Briefcase, Pencil, LogIn } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Pagination from '@/components/shared/Pagination';
import FormAlocacao from '../components/mao_obra/FormAlocacao';

const POR_PAGINA = 20;

const statusAlocacao = {
  planejada: { label: 'Planejada', color: 'bg-blue-100 text-blue-700' },
  ativa: { label: 'Ativa', color: 'bg-emerald-100 text-emerald-700' },
  pausada: { label: 'Pausada', color: 'bg-amber-100 text-amber-700' },
  finalizada: { label: 'Finalizada', color: 'bg-gray-100 text-gray-600' },
};

const iniciais = (nome) => (nome || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
const dataBR = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '');

// Rodapé de paginação — usa o componente compartilhado (padrão do sistema).
function Paginacao({ pagina, setPagina, total }) {
  return (
    <Pagination
      currentPage={pagina}
      totalPages={Math.max(1, Math.ceil(total / POR_PAGINA))}
      onPageChange={setPagina}
      startIndex={(pagina - 1) * POR_PAGINA}
      endIndex={Math.min(pagina * POR_PAGINA, total)}
      totalItems={total}
    />
  );
}

export default function GestaoMaoDeObra() {
  const [formAlocacaoAberto, setFormAlocacaoAberto] = useState(false);
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState(null);
  const [alocacaoSelecionada, setAlocacaoSelecionada] = useState(null);
  const [pagAloc, setPagAloc] = useState(1);
  const [pagCol, setPagCol] = useState(1);

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list('-created_date', 100),
  });

  const { data: alocacoes = [] } = useQuery({
    queryKey: ['alocacoes'],
    queryFn: () => base44.entities.AlocacaoObra.list('-created_date', 200),
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list(),
  });

  const { data: habilidades = [] } = useQuery({
    queryKey: ['habilidades'],
    queryFn: () => base44.entities.HabilidadeColaborador.list(),
  });

  // Estatísticas
  const alocacoesAtivas = alocacoes.filter((a) => a.status === 'ativa').length;

  const novaAlocacao = () => {
    setColaboradorSelecionado(null);
    setAlocacaoSelecionada(null);
    setFormAlocacaoAberto(true);
  };

  const editarAlocacao = (alocacao) => {
    setColaboradorSelecionado(null);
    setAlocacaoSelecionada(alocacao);
    setFormAlocacaoAberto(true);
  };

  const alocarColaborador = (col) => {
    setAlocacaoSelecionada(null);
    setColaboradorSelecionado(col);
    setFormAlocacaoAberto(true);
  };

  const alocPage = alocacoes.slice((pagAloc - 1) * POR_PAGINA, pagAloc * POR_PAGINA);
  const colPage = colaboradores.slice((pagCol - 1) * POR_PAGINA, pagCol * POR_PAGINA);

  return (
    <div className="space-y-6">
      <PageHeader title="Gestão de Mão de Obra" subtitle="Alocações e equipe por obra" />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500 mb-2">Colaboradores</div>
            <div className="text-2xl font-bold text-gray-900">{colaboradores.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500 mb-2">Alocações Ativas</div>
            <div className="text-2xl font-bold text-emerald-600">{alocacoesAtivas}</div>
          </CardContent>
        </Card>
      </div>

      {/* Abas */}
      <Tabs defaultValue="alocacoes" className="w-full space-y-4">
        <TabsList className="flex w-full overflow-x-auto justify-start bg-gray-100/80 h-auto gap-1 p-1">
          <TabsTrigger value="alocacoes" className="gap-2 shrink-0 whitespace-nowrap"><Briefcase className="w-4 h-4" /> Alocações em Obras</TabsTrigger>
          <TabsTrigger value="colaboradores" className="gap-2 shrink-0 whitespace-nowrap"><Users className="w-4 h-4" /> Colaboradores</TabsTrigger>
        </TabsList>

        {/* Alocações */}
        <TabsContent value="alocacoes" className="space-y-4">
          <div className="flex sm:justify-end">
            <Button onClick={novaAlocacao} className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4" /> Nova Alocação</Button>
          </div>
          <Card className="bg-white border-gray-200">
            <CardContent className="p-0">
              {alocacoes.length === 0 ? (
                <div className="p-12 text-center">
                  <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Nenhuma alocação cadastrada</h3>
                  <p className="text-sm text-gray-500 mb-5">Aloque um colaborador a uma obra</p>
                  <Button onClick={novaAlocacao} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" />Nova Alocação</Button>
                </div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Colaborador</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Obra</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Cargo</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Período</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Carga</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Status</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {alocPage.map((a) => {
                          const col = colaboradores.find((c) => c.id === a.colaborador_id);
                          const obra = obras.find((o) => o.id === a.obra_id);
                          const st = statusAlocacao[a.status] || statusAlocacao.planejada;
                          return (
                            <tr key={a.id} className="hover:bg-gray-50">
                              <td className="p-3 font-medium text-gray-900">{col?.nome || '—'}</td>
                              <td className="p-3 text-gray-600">{obra?.nome || '—'}</td>
                              <td className="p-3 text-gray-600">{a.cargo_alocado || '—'}</td>
                              <td className="p-3 text-gray-600">{dataBR(a.data_inicio)}{a.data_fim ? ` – ${dataBR(a.data_fim)}` : ' – Contínuo'}</td>
                              <td className="p-3 text-gray-600">{a.horas_diarias}h/dia · {a.turno}</td>
                              <td className="p-3"><Badge className={`border-0 ${st.color}`}>{st.label}</Badge></td>
                              <td className="p-3">
                                <div className="flex justify-end">
                                  <Button variant="ghost" size="icon" title="Editar" onClick={() => editarAlocacao(a)}><Pencil className="w-4 h-4 text-gray-400" /></Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Cards (mobile) */}
                  <div className="md:hidden flex flex-col gap-2 p-2">
                    {alocPage.map((a) => {
                      const col = colaboradores.find((c) => c.id === a.colaborador_id);
                      const obra = obras.find((o) => o.id === a.obra_id);
                      const st = statusAlocacao[a.status] || statusAlocacao.planejada;
                      return (
                        <div key={a.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 break-words">{col?.nome || '—'}</p>
                              <p className="text-xs text-gray-500 break-words">{obra?.nome || '—'}</p>
                            </div>
                            <Badge className={`border-0 shrink-0 ${st.color}`}>{st.label}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                            {a.cargo_alocado && <span>{a.cargo_alocado}</span>}
                            <span>{a.horas_diarias}h/dia · {a.turno}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                            <span className="text-xs text-gray-500">{dataBR(a.data_inicio)}{a.data_fim ? ` – ${dataBR(a.data_fim)}` : ' – Contínuo'}</span>
                            <Button variant="ghost" size="sm" className="gap-1 h-8" onClick={() => editarAlocacao(a)}><Pencil className="w-3.5 h-3.5 text-gray-400" /> Editar</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Paginacao pagina={pagAloc} setPagina={setPagAloc} total={alocacoes.length} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colaboradores */}
        <TabsContent value="colaboradores" className="space-y-4">
          <Card className="bg-white border-gray-200">
            <CardContent className="p-0">
              {colaboradores.length === 0 ? (
                <p className="text-center py-12 text-gray-400">Nenhum colaborador cadastrado.</p>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Colaborador</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Acesso</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Habilidades</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Alocações ativas</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {colPage.map((col) => {
                          const ativas = alocacoes.filter((a) => a.colaborador_id === col.id && a.status === 'ativa').length;
                          const habs = habilidades.filter((h) => h.colaborador_id === col.id);
                          return (
                            <tr key={col.id} className="hover:bg-gray-50">
                              <td className="p-3">
                                <div className="flex items-center gap-3">
                                  <Avatar className="w-9 h-9"><AvatarFallback className="bg-blue-600 text-white font-semibold text-xs">{iniciais(col.nome)}</AvatarFallback></Avatar>
                                  <div className="min-w-0">
                                    <p className="font-medium text-gray-900 truncate">{col.nome}</p>
                                    <p className="text-xs text-gray-500 truncate">{col.cargo || '—'}{col.departamento ? ` · ${col.departamento}` : ''}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3">
                                {col.user_email
                                  ? <Badge className="bg-green-100 text-green-700 border-0 gap-1"><LogIn className="w-3 h-3" />Com acesso</Badge>
                                  : <Badge className="bg-gray-100 text-gray-500 border-0">Sem acesso</Badge>}
                              </td>
                              <td className="p-3">
                                {habs.length === 0 ? <span className="text-gray-400 italic text-xs">—</span> : (
                                  <div className="flex gap-1 flex-wrap">
                                    {habs.slice(0, 3).map((h, i) => <Badge key={i} variant="outline" className="text-xs border-gray-300 text-gray-600">{h.habilidade}</Badge>)}
                                    {habs.length > 3 && <Badge variant="outline" className="text-xs border-gray-300 text-gray-600">+{habs.length - 3}</Badge>}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-gray-700 font-medium">{ativas}</td>
                              <td className="p-3">
                                <div className="flex justify-end">
                                  <Button size="sm" variant="outline" onClick={() => alocarColaborador(col)} className="h-8 border-gray-300 text-gray-700">Alocar</Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Cards (mobile) */}
                  <div className="md:hidden flex flex-col gap-2 p-2">
                    {colPage.map((col) => {
                      const ativas = alocacoes.filter((a) => a.colaborador_id === col.id && a.status === 'ativa').length;
                      const habs = habilidades.filter((h) => h.colaborador_id === col.id);
                      return (
                        <div key={col.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className="w-9 h-9 shrink-0"><AvatarFallback className="bg-blue-600 text-white font-semibold text-xs">{iniciais(col.nome)}</AvatarFallback></Avatar>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 truncate">{col.nome}</p>
                                <p className="text-xs text-gray-500 truncate">{col.cargo || '—'}{col.departamento ? ` · ${col.departamento}` : ''}</p>
                              </div>
                            </div>
                            {col.user_email
                              ? <Badge className="bg-green-100 text-green-700 border-0 gap-1 shrink-0"><LogIn className="w-3 h-3" />Acesso</Badge>
                              : <Badge className="bg-gray-100 text-gray-500 border-0 shrink-0">Sem acesso</Badge>}
                          </div>
                          {habs.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {habs.slice(0, 4).map((h, i) => <Badge key={i} variant="outline" className="text-xs border-gray-300 text-gray-600">{h.habilidade}</Badge>)}
                              {habs.length > 4 && <Badge variant="outline" className="text-xs border-gray-300 text-gray-600">+{habs.length - 4}</Badge>}
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                            <span className="text-xs text-gray-500">{ativas} alocação(ões) ativa(s)</span>
                            <Button size="sm" variant="outline" onClick={() => alocarColaborador(col)} className="h-8 border-gray-300 text-gray-700">Alocar</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Paginacao pagina={pagCol} setPagina={setPagCol} total={colaboradores.length} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FormAlocacao
        open={formAlocacaoAberto}
        onOpenChange={setFormAlocacaoAberto}
        colaborador={colaboradorSelecionado}
        alocacao={alocacaoSelecionada}
      />
    </div>
  );
}

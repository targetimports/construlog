import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, Search, AlertCircle, AlertTriangle, Plus, Pencil, UserPlus } from 'lucide-react';
import FormAlocacao from '@/components/mao_obra/FormAlocacao';

// A EQUIPE reflete as ALOCAÇÕES (Gestão de Mão de Obra) — fonte única com período,
// carga horária e turno (o que o financeiro usa). Cadastro/edição só lá; aqui é leitura.
// Quem está vinculado à obra sem alocação formal aparece marcado como "Sem alocação".
const statusAlocacao = {
  planejada: { label: 'Planejada', color: 'bg-blue-100 text-blue-700' },
  ativa: { label: 'Ativa', color: 'bg-emerald-100 text-emerald-700' },
  pausada: { label: 'Pausada', color: 'bg-amber-100 text-amber-700' },
  finalizada: { label: 'Finalizada', color: 'bg-gray-100 text-gray-600' },
  sem_alocacao: { label: 'Sem alocação', color: 'bg-amber-100 text-amber-700' },
};
const dataBR = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '');
const prioridade = { ativa: 0, planejada: 1, pausada: 2, finalizada: 3 };

export default function EquipeObraTab({ obraId, podeEditar = true }) {
  const [busca, setBusca] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState(null);   // alocação em edição
  const [colabAlvo, setColabAlvo] = useState(null);  // colaborador ao alocar um "sem alocação"

  const abrirNova = () => { setEditando(null); setColabAlvo(null); setFormOpen(true); };
  const abrirEditar = (l) => {
    setEditando(l._aloc || null);
    setColabAlvo(l.temAlocacao ? null : { id: l.colaborador_id, cargo: l.cargo });
    setFormOpen(true);
  };

  // Alocações da obra (fonte principal).
  const { data: alocacoes = [], isLoading: loadingAloc } = useQuery({
    queryKey: ['alocacoesObra', obraId],
    queryFn: () => base44.entities.AlocacaoObra.filter({ obra_id: obraId }, '-data_inicio', 200).catch(() => []),
    enabled: !!obraId,
  });

  // Vínculos diretos (ObraColaborador) — para pegar quem está na obra SEM alocação.
  const { data: equipeDados, error: equipeError } = useQuery({
    queryKey: ['equipeObra', obraId],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('listarColaboradoresObra', { obra_id: obraId });
      return data;
    },
    enabled: !!obraId,
  });

  const { data: todosCols = [] } = useQuery({
    queryKey: ['todosColaboradores'],
    queryFn: () => base44.entities.Colaborador.list('-created_date', 5000).catch(() => []),
  });

  const colInfo = useMemo(() => {
    const m = {};
    (todosCols || []).forEach((c) => { m[c.id] = { nome: c.nome, cargo: c.cargo }; });
    return m;
  }, [todosCols]);

  // Linha unificada por colaborador: alocação (mais relevante) ou "sem alocação".
  const linhas = useMemo(() => {
    const porColab = new Map();
    // 1) alocações — escolhe a mais relevante (ativa > planejada > pausada > finalizada).
    for (const a of alocacoes) {
      if (!a.colaborador_id) continue;
      const atual = porColab.get(a.colaborador_id);
      if (atual && (prioridade[atual._status] ?? 9) <= (prioridade[a.status] ?? 9)) continue;
      porColab.set(a.colaborador_id, {
        colaborador_id: a.colaborador_id,
        // Nunca só "—": se o cadastro sumiu, diz o que houve em vez de deixar a
        // linha muda (era o caso de alocação criada com id de usuário).
        nome: colInfo[a.colaborador_id]?.nome || a.colaborador_nome || 'Colaborador não encontrado',
        cargo: a.cargo_alocado || colInfo[a.colaborador_id]?.cargo || '—',
        periodo: `${dataBR(a.data_inicio)}${a.data_fim ? ` – ${dataBR(a.data_fim)}` : ' – Contínuo'}`,
        carga: `${a.horas_diarias || '—'}h/dia · ${a.turno || '—'}`,
        status: a.status || 'planejada',
        _status: a.status || 'planejada',
        temAlocacao: true,
        _aloc: a,
      });
    }
    // 2) vínculos sem alocação → "sem alocação".
    for (const v of (equipeDados?.colaboradores || [])) {
      if (!v.colaborador_id || porColab.has(v.colaborador_id)) continue;
      if ((v.status || 'ativo') === 'inativo') continue;
      porColab.set(v.colaborador_id, {
        colaborador_id: v.colaborador_id,
        nome: v.nome || colInfo[v.colaborador_id]?.nome || '—',
        cargo: v.cargo || colInfo[v.colaborador_id]?.cargo || '—',
        periodo: '—',
        carga: '—',
        status: 'sem_alocacao',
        _status: 'sem_alocacao',
        temAlocacao: false,
      });
    }
    return [...porColab.values()].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [alocacoes, equipeDados, colInfo]);

  const linhasFiltradas = useMemo(() => {
    if (!busca) return linhas;
    const q = busca.toLowerCase();
    return linhas.filter((l) => l.nome.toLowerCase().includes(q) || (l.cargo || '').toLowerCase().includes(q));
  }, [linhas, busca]);

  const semAlocacao = linhas.filter((l) => !l.temAlocacao).length;

  if (equipeError) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
        <AlertCircle className="w-5 h-5 text-red-600" />
        <span className="text-red-700">Erro ao carregar equipe: {equipeError.message}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho + ação */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> Equipe da Obra
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Reflete as <strong>alocações</strong> de mão de obra (período, carga e turno). Use "Nova Alocação" para adicionar ou editar.
          </p>
        </div>
        {podeEditar && (
          <Button onClick={abrirNova} className="bg-blue-600 hover:bg-blue-700 gap-2 w-full sm:w-auto flex-shrink-0">
            <Plus className="w-4 h-4" /> Nova Alocação
          </Button>
        )}
      </div>

      {/* Aviso: sem alocação */}
      {semAlocacao > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            {semAlocacao} {semAlocacao === 1 ? 'pessoa está' : 'pessoas estão'} na equipe <strong>sem alocação formal</strong>.
            Clique em "Alocar" na linha para definir período/carga (necessário para o financeiro).
          </span>
        </div>
      )}

      {/* Busca */}
      <div className="relative sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input className="pl-9 h-11" placeholder="Buscar por nome ou cargo..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {/* Tabela unificada (read-only) */}
      {loadingAloc ? (
        <div className="text-center py-8 text-gray-500">Carregando equipe...</div>
      ) : linhasFiltradas.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400">{busca ? 'Nenhum resultado.' : 'Nenhuma pessoa na equipe. Aloque colaboradores em Gestão de Mão de Obra.'}</p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Colaborador</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Cargo</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Período</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Carga</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                  {podeEditar && <th className="px-4 py-3 text-right font-semibold text-gray-700">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {linhasFiltradas.map((l) => {
                  const st = statusAlocacao[l.status] || statusAlocacao.planejada;
                  return (
                    <tr key={l.colaborador_id} className={`hover:bg-gray-50 ${!l.temAlocacao ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{l.nome}</td>
                      <td className="px-4 py-3 text-gray-600">{l.cargo}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{l.periodo}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{l.carga}</td>
                      <td className="px-4 py-3"><Badge className={`border-0 ${st.color}`}>{st.label}</Badge></td>
                      {podeEditar && (
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => abrirEditar(l)} className="gap-1 text-gray-600 hover:text-blue-600 h-8">
                            {l.temAlocacao ? <><Pencil className="w-4 h-4" /> Editar</> : <><UserPlus className="w-4 h-4" /> Alocar</>}
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile */}
          <div className="md:hidden space-y-2">
            {linhasFiltradas.map((l) => {
              const st = statusAlocacao[l.status] || statusAlocacao.planejada;
              return (
                <div key={l.colaborador_id} className={`border rounded-lg p-3 ${!l.temAlocacao ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{l.nome}</p>
                      <p className="text-xs text-gray-500">{l.cargo}</p>
                    </div>
                    <Badge className={`border-0 shrink-0 ${st.color}`}>{st.label}</Badge>
                  </div>
                  {l.temAlocacao && (
                    <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                      <p>{l.periodo}</p>
                      <p>{l.carga}</p>
                    </div>
                  )}
                  {podeEditar && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => abrirEditar(l)} className="gap-1 text-gray-600 hover:text-blue-600 h-8">
                        {l.temAlocacao ? <><Pencil className="w-4 h-4" /> Editar</> : <><UserPlus className="w-4 h-4" /> Alocar</>}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal de alocação (criar/editar) */}
      <FormAlocacao
        open={formOpen}
        onOpenChange={setFormOpen}
        obraId={obraId}
        alocacao={editando}
        colaborador={colabAlvo}
      />

      {/* Resumo */}
      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
        Total na equipe: <strong>{linhas.length}</strong>
        {semAlocacao > 0 && <span> · {linhas.length - semAlocacao} com alocação, {semAlocacao} sem</span>}
      </div>
    </div>
  );
}

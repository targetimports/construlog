import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, FileText, Ruler, ChevronLeft, ChevronRight } from 'lucide-react';
import FormContratoModal from '@/components/contratos/FormContratoModal';
import FormMedicaoContrato from '@/components/medicao/FormMedicaoContrato';
import DashboardMedicaoContrato from '@/components/medicao/DashboardMedicaoContrato';

const LIMIT = 10;
const num = (v) => Number(v) || 0;
const fmtBRL = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d) => (d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '—');
const TIPO_LABEL = { empreitada: 'Empreitada', fornecimento: 'Fornecimento', prestacao_servico: 'Prestação de Serviço', subcontratacao: 'Subcontratação' };
const STATUS_CLS = { ativo: 'bg-green-100 text-green-800', encerrado: 'bg-gray-100 text-gray-600', suspenso: 'bg-amber-100 text-amber-700' };

export default function ContratosObraTab({ obraId, podeEditar = true }) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [medindo, setMedindo] = useState(null); // contrato aberto no modal de medição
  const [pagina, setPagina] = useState(1);

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ['contratos-obra', obraId],
    queryFn: () => base44.entities.Contrato.filter({ obra_id: obraId }, '-created_date', 1000),
    enabled: !!obraId,
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores-contratos-obra'],
    queryFn: () => base44.entities.Fornecedor.list('-created_date', 2000).catch(() => []),
  });
  const fornMap = useMemo(() => Object.fromEntries(fornecedores.map((f) => [f.id, f.nome || f.razao_social])), [fornecedores]);

  // Medido por contrato (medições aprovadas) — vira custo de "Serviços" da obra.
  const { data: medidoPorContrato = {} } = useQuery({
    queryKey: ['medido-contratos-obra', obraId, contratos.map((c) => c.id).join(',')],
    queryFn: async () => {
      const mapa = {};
      await Promise.all(contratos.slice(0, 100).map(async (c) => {
        const meds = await base44.entities.MedicaoContrato.filter({ contrato_id: c.id }, '-data_medicao', 200).catch(() => []);
        mapa[c.id] = meds.filter((m) => String(m.status).toLowerCase() === 'aprovada').reduce((s, m) => s + num(m.valor_medido ?? m.valor_total), 0);
      }));
      return mapa;
    },
    enabled: contratos.length > 0,
  });

  const totalContratado = contratos.reduce((s, c) => s + num(c.valor_total), 0);
  const totalMedido = Object.values(medidoPorContrato).reduce((s, v) => s + num(v), 0);

  const totalPaginas = Math.max(1, Math.ceil(contratos.length / LIMIT));
  const pagAtual = Math.min(pagina, totalPaginas);
  const pageItens = contratos.slice((pagAtual - 1) * LIMIT, pagAtual * LIMIT);

  const onSave = () => { queryClient.invalidateQueries({ queryKey: ['contratos-obra', obraId] }); setEditando(null); };
  const nomeContratado = (c) => c.contratado_nome || fornMap[c.fornecedor_id] || '—';

  // Ao fechar o modal de medição, atualiza medido/saldo e as contas a pagar geradas.
  const fecharMedicao = () => {
    setMedindo(null);
    queryClient.invalidateQueries({ queryKey: ['medido-contratos-obra', obraId] });
    queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
  };

  const Acoes = ({ c }) => (
    <div className="flex gap-1 justify-end">
      <Button size="sm" variant="outline" className="h-8 gap-1 border-gray-300 text-gray-700" onClick={() => setMedindo(c)}>
        <Ruler className="w-3.5 h-3.5" /> Medir
      </Button>
      {podeEditar && (
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600" title="Editar contrato" onClick={() => { setEditando(c); setModalOpen(true); }}>
          <Pencil className="w-4 h-4" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-gray-900">Contratos da Obra</h2>
          <p className="text-gray-500 text-sm mt-1 hidden sm:block">Contratos com fornecedores/terceiros (serviços medidos viram custo/conta a pagar)</p>
        </div>
        {podeEditar && (
          <Button onClick={() => { setEditando({ obra_id: obraId }); setModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 gap-2 flex-shrink-0">
            <Plus className="w-4 h-4" />
            <span className="sm:hidden">Novo</span>
            <span className="hidden sm:inline">Novo Contrato</span>
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="bg-white border-gray-200"><CardContent className="p-4">
          <p className="text-xs text-gray-500 font-semibold">Contratos</p>
          <p className="text-lg sm:text-xl font-bold text-gray-900">{contratos.length}</p>
        </CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-4">
          <p className="text-xs text-gray-500 font-semibold">Total Contratado</p>
          <p className="text-lg sm:text-xl font-bold text-gray-900 tabular-nums break-words">{fmtBRL(totalContratado)}</p>
        </CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-4">
          <p className="text-xs text-gray-500 font-semibold">Total Medido</p>
          <p className="text-lg sm:text-xl font-bold text-emerald-600 tabular-nums break-words">{fmtBRL(totalMedido)}</p>
        </CardContent></Card>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Carregando contratos...</div>
      ) : contratos.length === 0 ? (
        <Card className="bg-white border-gray-200">
          <CardContent className="py-16 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-600">Nenhum contrato nesta obra</p>
            <p className="text-xs text-gray-400 mt-1">Cadastre contratos com fornecedores/terceiros desta obra.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white border-gray-200">
          <CardContent className="p-0">
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-3 text-xs font-semibold text-gray-500">Contrato</th>
                    <th className="text-left p-3 text-xs font-semibold text-gray-500">Contratado</th>
                    <th className="text-left p-3 text-xs font-semibold text-gray-500">Tipo</th>
                    <th className="text-right p-3 text-xs font-semibold text-gray-500">Contratado (R$)</th>
                    <th className="text-right p-3 text-xs font-semibold text-gray-500">Medido</th>
                    <th className="text-right p-3 text-xs font-semibold text-gray-500">Saldo</th>
                    <th className="text-left p-3 text-xs font-semibold text-gray-500">Período</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pageItens.map((c) => {
                    const medido = num(medidoPorContrato[c.id]);
                    const saldo = num(c.valor_total) - medido;
                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{c.titulo || c.numero}</span>
                            <Badge variant="outline" className="text-[10px] text-gray-500 border-gray-300">{c.numero}</Badge>
                            <Badge className={`text-[10px] border-0 ${STATUS_CLS[c.status] || 'bg-gray-100 text-gray-600'}`}>{c.status || '—'}</Badge>
                          </div>
                        </td>
                        <td className="p-3 text-gray-700 max-w-[12rem] truncate" title={nomeContratado(c)}>{nomeContratado(c)}</td>
                        <td className="p-3 text-gray-600">{TIPO_LABEL[c.tipo] || c.tipo || '—'}</td>
                        <td className="p-3 text-right tabular-nums font-medium text-gray-900">{fmtBRL(c.valor_total)}</td>
                        <td className="p-3 text-right tabular-nums text-emerald-600">{fmtBRL(medido)}</td>
                        <td className={`p-3 text-right tabular-nums ${saldo < 0 ? 'text-red-600' : 'text-gray-700'}`}>{fmtBRL(saldo)}</td>
                        <td className="p-3 text-gray-600 whitespace-nowrap text-xs">{fmtData(c.data_inicio)} – {fmtData(c.data_fim_prevista)}</td>
                        <td className="p-3"><Acoes c={c} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-gray-100">
              {pageItens.map((c) => {
                const medido = num(medidoPorContrato[c.id]);
                const saldo = num(c.valor_total) - medido;
                return (
                  <div key={c.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 truncate">{c.titulo || c.numero}</span>
                          <Badge className={`text-[10px] border-0 ${STATUS_CLS[c.status] || 'bg-gray-100 text-gray-600'}`}>{c.status || '—'}</Badge>
                        </div>
                        <p className="text-xs text-gray-500">{nomeContratado(c)} · {TIPO_LABEL[c.tipo] || c.tipo}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><p className="text-gray-400">Contratado</p><p className="tabular-nums font-medium text-gray-900">{fmtBRL(c.valor_total)}</p></div>
                      <div><p className="text-gray-400">Medido</p><p className="tabular-nums text-emerald-600">{fmtBRL(medido)}</p></div>
                      <div><p className="text-gray-400">Saldo</p><p className={`tabular-nums ${saldo < 0 ? 'text-red-600' : 'text-gray-700'}`}>{fmtBRL(saldo)}</p></div>
                    </div>
                    <div className="pt-1"><Acoes c={c} /></div>
                  </div>
                );
              })}
            </div>

            {/* Paginação */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-t border-gray-200">
              <span className="text-xs text-gray-500">Mostrando {(pagAtual - 1) * LIMIT + 1}–{Math.min(pagAtual * LIMIT, contratos.length)} de {contratos.length}</span>
              <div className="flex items-center justify-between sm:justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagAtual <= 1} className="h-8 gap-1 border-gray-300 text-gray-700"><ChevronLeft className="w-4 h-4" /> Anterior</Button>
                <span className="text-xs text-gray-600">Página {pagAtual} de {totalPaginas}</span>
                <Button variant="outline" size="sm" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagAtual >= totalPaginas} className="h-8 gap-1 border-gray-300 text-gray-700">Próxima <ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal: Novo/Editar Contrato */}
      <FormContratoModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={onSave} contrato={editando} />

      {/* Modal: Medir contrato (criar medição + aprovar → gera conta a pagar) */}
      <Dialog open={!!medindo} onOpenChange={(o) => { if (!o) fecharMedicao(); }}>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] sm:w-full max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader className="min-w-0"><DialogTitle className="truncate pr-6">Medições — {medindo?.titulo || medindo?.numero}</DialogTitle></DialogHeader>
          {medindo && (
            <div className="space-y-6 min-w-0 w-full overflow-x-hidden">
              <FormMedicaoContrato
                contratoIdInicial={medindo.id}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['medido-contratos-obra', obraId] })}
              />
              <div className="pt-2 border-t border-gray-100">
                <DashboardMedicaoContrato contratoId={medindo.id} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

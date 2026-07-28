import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Edit2, Lock, Unlock, Eye, Ruler, ChevronLeft, ChevronRight, FileSignature } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FormMedicaoContrato from '@/components/medicao/FormMedicaoContrato';
import DashboardMedicaoContrato from '@/components/medicao/DashboardMedicaoContrato';
import FormContratoModal from '@/components/contratos/FormContratoModal';
import { ListSkeleton } from '@/components/shared/Skeletons';

const POR_PAGINA = 10;
const num = (v) => Number(v) || 0;
const fmtBRL = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d) => (d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '—');
const TIPO_LABEL = { empreitada: 'Empreitada', fornecimento: 'Fornecimento', prestacao_servico: 'Prestação de Serviço', subcontratacao: 'Subcontratação' };
const STATUS_CLS = { ativo: 'bg-green-100 text-green-800', encerrado: 'bg-gray-100 text-gray-600', suspenso: 'bg-amber-100 text-amber-700' };

export default function MedicaoContratos() {
  const queryClient = useQueryClient();
  const [selectedContrato, setSelectedContrato] = useState(null);
  const [filtroObra, setFiltroObra] = useState('');
  const [showFormMedicao, setShowFormMedicao] = useState(false);
  const [showFormContrato, setShowFormContrato] = useState(false);
  const [contratoEdit, setContratoEdit] = useState(null);
  const [pagina, setPagina] = useState(1);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('-created_date', 1000),
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores-medicao-contratos'],
    queryFn: () => base44.entities.Fornecedor.list('-created_date', 2000).catch(() => []),
  });
  const fornMap = useMemo(() => Object.fromEntries(fornecedores.map((f) => [f.id, f.nome || f.razao_social])), [fornecedores]);
  const obraMap = useMemo(() => Object.fromEntries(obras.map((o) => [o.id, o.nome])), [obras]);

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ['contratos-medicao', filtroObra],
    queryFn: () => base44.entities.Contrato.filter(filtroObra ? { obra_id: filtroObra } : {}, '-created_date', 1000),
  });

  // Medições por contrato (todas) — para resumo.
  const { data: medicoesPorContrato = {} } = useQuery({
    queryKey: ['medido-contratos-medicao', contratos.map((c) => c.id).join(',')],
    queryFn: async () => {
      const mapa = {};
      await Promise.all(contratos.slice(0, 200).map(async (c) => {
        const meds = await base44.entities.MedicaoContrato.filter({ contrato_id: c.id }, '-data_medicao', 200).catch(() => []);
        mapa[c.id] = meds;
      }));
      return mapa;
    },
    enabled: contratos.length > 0,
  });

  const toggleEdicaoMutation = useMutation({
    mutationFn: ({ contratoId, permitirEdicao }) => base44.functions.invoke('toggleEdicaoContrato', { contratoId, permitirEdicao }),
    onSuccess: () => {
      toast.success('Permissão de edição alterada');
      queryClient.invalidateQueries({ queryKey: ['contratos-medicao'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const resumoContrato = (contrato) => {
    const meds = medicoesPorContrato[contrato.id] || [];
    const aprovadas = meds.filter((m) => String(m.status).toLowerCase() === 'aprovada');
    const totalMedido = aprovadas.reduce((acc, m) => acc + num(m.valor_medido ?? m.valor_total), 0);
    const valorTotal = num(contrato.valor_total);
    return {
      totalMedido,
      saldoDisponivel: valorTotal - totalMedido,
      percentual: valorTotal > 0 ? ((totalMedido / valorTotal) * 100).toFixed(1) : '0.0',
      medicoes: meds.length,
    };
  };

  const obraOptions = obras.map((o) => ({ value: o.id, label: o.nome }));

  const totalPaginas = Math.max(1, Math.ceil(contratos.length / POR_PAGINA));
  const pagAtual = Math.min(pagina, totalPaginas);
  const pageItens = contratos.slice((pagAtual - 1) * POR_PAGINA, pagAtual * POR_PAGINA);

  const onSaveContrato = () => {
    queryClient.invalidateQueries({ queryKey: ['contratos-medicao'] });
    setContratoEdit(null);
  };

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medição de Contratos</h1>
          <p className="text-gray-500 text-sm mt-1">Contratos com fornecedores/terceiros — medições aprovadas viram custo da obra.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-gray-300 text-gray-700" onClick={() => setShowFormMedicao(true)}>
            <Ruler className="w-4 h-4" /> Nova Medição
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => { setContratoEdit(null); setShowFormContrato(true); }}>
            <Plus className="w-4 h-4" /> Novo Contrato
          </Button>
        </div>
      </div>

      {/* Filtro */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1 max-w-xs">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Obra</label>
              <ComboboxBusca
                options={obraOptions}
                value={filtroObra}
                onSelect={(v) => { setFiltroObra(v); setPagina(1); }}
                placeholder="Todas as obras"
                searchPlaceholder="Buscar obra..."
              />
            </div>
            {filtroObra && (
              <Button variant="ghost" size="sm" className="h-9 text-gray-500 hover:text-gray-700" onClick={() => { setFiltroObra(''); setPagina(1); }}>
                Limpar
              </Button>
            )}
            <div className="sm:ml-auto text-sm text-gray-500 self-center">{contratos.length} contrato(s)</div>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : contratos.length === 0 ? (
        <Card className="bg-white border-gray-200">
          <CardContent className="py-16 text-center text-gray-500">
            <FileSignature className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-600">Nenhum contrato encontrado</p>
            <p className="text-xs text-gray-400 mt-1">Cadastre contratos com fornecedores/terceiros para medir.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pageItens.map((contrato) => {
            const r = resumoContrato(contrato);
            const bloqueada = contrato.edicao_habilitada === false;
            return (
              <Card key={contrato.id} className="bg-white border-gray-200 hover:border-gray-300 transition-colors">
                <CardContent className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 truncate">{contrato.titulo || contrato.numero}</h3>
                        <Badge variant="outline" className="text-xs text-gray-500 border-gray-300">{contrato.numero}</Badge>
                        <Badge className={`text-xs border-0 ${STATUS_CLS[contrato.status] || 'bg-gray-100 text-gray-600'}`}>{contrato.status || '—'}</Badge>
                        {bloqueada && <Badge variant="outline" className="gap-1 text-xs border-gray-300 text-gray-500"><Lock className="w-3 h-3" /> Bloqueada</Badge>}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{fornMap[contrato.fornecedor_id] || 'Fornecedor —'} · {TIPO_LABEL[contrato.tipo] || contrato.tipo || '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{obraMap[contrato.obra_id] || 'Obra —'} · {fmtData(contrato.data_assinatura || contrato.data_inicio)}</p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">Progresso</p>
                      <p className="text-2xl font-bold text-blue-600">{r.percentual}%</p>
                      <div className="w-full bg-gray-200 rounded h-2 mt-2">
                        <div className="bg-blue-600 h-2 rounded" style={{ width: `${Math.min(100, r.percentual)}%` }} />
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Saldo</p>
                      <p className={`text-xl font-bold tabular-nums ${r.saldoDisponivel < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmtBRL(r.saldoDisponivel)}</p>
                      <p className="text-xs text-gray-400 mt-1">{r.medicoes} medição(ões) · medido {fmtBRL(r.totalMedido)}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                    <Button variant="outline" size="sm" onClick={() => setSelectedContrato(contrato)} className="gap-1 text-xs border-gray-300 text-gray-700">
                      <Eye className="w-3 h-3" /> Detalhes
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setContratoEdit(contrato); setShowFormContrato(true); }} className="gap-1 text-xs border-gray-300 text-gray-700">
                      <Edit2 className="w-3 h-3" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs border-gray-300 text-gray-700"
                      disabled={toggleEdicaoMutation.isPending}
                      onClick={() => toggleEdicaoMutation.mutate({ contratoId: contrato.id, permitirEdicao: contrato.edicao_habilitada !== false })}
                    >
                      {bloqueada ? <><Unlock className="w-3 h-3" /> Liberar Edição</> : <><Lock className="w-3 h-3" /> Bloquear Edição</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Paginação */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
            <span className="text-xs text-gray-500">Mostrando {(pagAtual - 1) * POR_PAGINA + 1}–{Math.min(pagAtual * POR_PAGINA, contratos.length)} de {contratos.length}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagAtual <= 1} className="h-8 gap-1 border-gray-300 text-gray-700"><ChevronLeft className="w-4 h-4" /> Anterior</Button>
              <span className="text-xs text-gray-600">Página {pagAtual} de {totalPaginas}</span>
              <Button variant="outline" size="sm" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagAtual >= totalPaginas} className="h-8 gap-1 border-gray-300 text-gray-700">Próxima <ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nova Medição */}
      <Dialog open={showFormMedicao} onOpenChange={setShowFormMedicao}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Medição de Contrato</DialogTitle></DialogHeader>
          <FormMedicaoContrato
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['medido-contratos-medicao'] });
              queryClient.invalidateQueries({ queryKey: ['medicoes-contrato'] });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Modal: Novo/Editar Contrato */}
      <FormContratoModal open={showFormContrato} onClose={() => setShowFormContrato(false)} onSave={onSaveContrato} contrato={contratoEdit} />

      {/* Modal: Detalhes */}
      {selectedContrato && (
        <Dialog open={!!selectedContrato} onOpenChange={() => setSelectedContrato(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{selectedContrato.titulo || selectedContrato.numero}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-gray-500">Fornecedor</p><p className="font-semibold text-gray-900">{fornMap[selectedContrato.fornecedor_id] || '—'}</p></div>
                <div><p className="text-gray-500">Tipo</p><p className="font-semibold text-gray-900">{TIPO_LABEL[selectedContrato.tipo] || selectedContrato.tipo || '—'}</p></div>
                <div><p className="text-gray-500">Valor Total</p><p className="font-semibold text-gray-900 tabular-nums">{fmtBRL(selectedContrato.valor_total)}</p></div>
                <div><p className="text-gray-500">Assinatura</p><p className="font-semibold text-gray-900">{fmtData(selectedContrato.data_assinatura || selectedContrato.data_inicio)}</p></div>
              </div>
              <DashboardMedicaoContrato contratoId={selectedContrato.id} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

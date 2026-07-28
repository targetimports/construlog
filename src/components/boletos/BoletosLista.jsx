import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Eye, Pencil, CreditCard, Ban, Calendar, FileText } from 'lucide-react';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';

import BoletosKPIs from './BoletosKPIs';
import BoletosFiltros from './BoletosFiltros';
import BoletoFormModal from './BoletoFormModal';
import BoletoPagarModal from './BolotoPagarModal';
import BoletoDetalheModal from './BoletoDetalheModal';

const STATUS_MAP = {
  RASCUNHO: { label: 'Rascunho', className: 'bg-gray-100 text-gray-600' },
  ABERTO: { label: 'Aberto', className: 'bg-amber-100 text-amber-700' },
  PAGO: { label: 'Pago', className: 'bg-green-100 text-green-700' },
  CANCELADO: { label: 'Cancelado', className: 'bg-red-100 text-red-700' }
};

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

function diasParaVencer(dataVenc) {
  if (!dataVenc) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(dataVenc + 'T00:00:00');
  const diff = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function BoletosLista() {
  const queryClient = useQueryClient();
  const [filtros, setFiltros] = useState({});
  const [formOpen, setFormOpen] = useState(false);
  const [boletoEdit, setBoletoEdit] = useState(null);
  const [pagarOpen, setPagarOpen] = useState(false);
  const [boletoPagar, setBoletoPagar] = useState(null);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [boletoDetalhe, setBoletoDetalhe] = useState(null);
  const POR_PAGINA = 20;

  const { data: boletos, isLoading } = useQuery({
    queryKey: ['boletos-pagar'],
    queryFn: () => base44.entities.BoletoPagar.list('-created_date', 200),
    initialData: []
  });

  const { data: obras } = useQuery({
    queryKey: ['obras-boletos'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: fornecedores } = useQuery({
    queryKey: ['fornecedores-boletos'],
    queryFn: () => base44.entities.Fornecedor.list()
  });

  const cancelarMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('boletoPagar', { action: 'cancelar', id, motivo: 'Cancelado pelo usuário' }),
    onSuccess: () => {
      toast.success('Boleto cancelado');
      queryClient.invalidateQueries({ queryKey: ['boletos-pagar'] });
    },
    onError: (err) => toast.error(err.response?.data?.error || err.message)
  });

  const boletosFiltrados = useMemo(() => {
    let resultado = [...boletos];
    if (filtros.busca) {
      const b = filtros.busca.toLowerCase();
      resultado = resultado.filter(r => r.descricao?.toLowerCase().includes(b) || r.fornecedor_nome?.toLowerCase().includes(b));
    }
    if (filtros.status) resultado = resultado.filter(r => r.status === filtros.status);
    if (filtros.obra_id) resultado = resultado.filter(r => r.obra_id === filtros.obra_id);
    if (filtros.venc_de) resultado = resultado.filter(r => r.data_vencimento >= filtros.venc_de);
    if (filtros.venc_ate) resultado = resultado.filter(r => r.data_vencimento <= filtros.venc_ate);
    resultado.sort((a, b) => {
      if (a.status === 'PAGO' && b.status !== 'PAGO') return 1;
      if (a.status !== 'PAGO' && b.status === 'PAGO') return -1;
      return new Date(a.data_vencimento) - new Date(b.data_vencimento);
    });
    return resultado;
  }, [boletos, filtros]);

  const {
    paginatedItems: pageItens,
    currentPage, totalPages, goToPage, startIndex, endIndex, totalItems,
  } = usePagination(boletosFiltrados, POR_PAGINA);
  React.useEffect(() => { goToPage(1); }, [filtros]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check URL for boleto_id
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bId = params.get('boleto_id');
    if (bId && boletos.length > 0) {
      const found = boletos.find(b => b.id === bId);
      if (found) {
        setBoletoDetalhe(found);
        setDetalheOpen(true);
      }
    }
  }, [boletos]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Boletos a Pagar</h2>
          <p className="text-sm text-gray-500">Controle de boletos com vencimento, alertas e integração com tesouraria</p>
        </div>
        <Button onClick={() => { setBoletoEdit(null); setFormOpen(true); }} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 gap-2">
          <Plus className="w-4 h-4" /> Novo Boleto
        </Button>
      </div>

      <BoletosKPIs boletos={boletos} />

      <BoletosFiltros filtros={filtros} setFiltros={setFiltros} obras={obras} fornecedores={fornecedores} />

      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Carregando boletos...</div>
          ) : boletosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum boleto encontrado</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-gray-500 text-xs">
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Vencimento</th>
                    <th className="text-left p-3">Descrição</th>
                    <th className="text-left p-3">Fornecedor</th>
                    <th className="text-left p-3">Obra</th>
                    <th className="text-right p-3">Valor</th>
                    <th className="text-center p-3">Prazo</th>
                    <th className="text-left p-3">Responsável</th>
                    <th className="text-center p-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pageItens.map(bol => {
                    const dias = diasParaVencer(bol.data_vencimento);
                    const isVencido = bol.status === 'ABERTO' && dias !== null && dias < 0;
                    const statusConf = STATUS_MAP[bol.status] || STATUS_MAP.ABERTO;

                    return (
                      <tr key={bol.id} className={`hover:bg-gray-50 ${isVencido ? 'bg-red-50/50' : ''}`}>
                        <td className="p-3">
                          {isVencido ? (
                            <Badge className="bg-red-100 text-red-700 border-0">Vencido</Badge>
                          ) : (
                            <Badge className={`${statusConf.className} border-0`}>{statusConf.label}</Badge>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            {fmtDate(bol.data_vencimento)}
                          </div>
                        </td>
                        <td className="p-3 font-medium max-w-[200px] truncate">{bol.descricao}</td>
                        <td className="p-3 text-gray-600">{bol.fornecedor_nome || '-'}</td>
                        <td className="p-3 text-gray-600 max-w-[120px] truncate">{bol.obra_nome || '-'}</td>
                        <td className="p-3 text-right font-mono font-bold">{fmt(bol.valor)}</td>
                        <td className="p-3 text-center">
                          {bol.status === 'PAGO' ? (
                            <span className="text-green-600 text-xs">Pago</span>
                          ) : bol.status === 'CANCELADO' ? (
                            <span className="text-gray-400 text-xs">—</span>
                          ) : dias !== null ? (
                            <span className={`text-xs font-semibold ${dias < 0 ? 'text-red-600' : dias <= 3 ? 'text-amber-600' : 'text-gray-600'}`}>
                              {dias < 0 ? `${Math.abs(dias)}d atraso` : dias === 0 ? 'Hoje' : `${dias}d`}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="p-3 text-gray-600 text-xs">{bol.responsavel_nome || '-'}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant="ghost" title="Ver detalhes" onClick={() => { setBoletoDetalhe(bol); setDetalheOpen(true); }}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            {bol.status !== 'PAGO' && bol.status !== 'CANCELADO' && (
                              <>
                                <Button size="sm" variant="ghost" title="Editar" onClick={() => { setBoletoEdit(bol); setFormOpen(true); }}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" title="Pagar" className="text-green-600" onClick={() => { setBoletoPagar(bol); setPagarOpen(true); }}>
                                  <CreditCard className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" title="Cancelar" className="text-red-500" onClick={() => { if (confirm('Cancelar este boleto?')) cancelarMutation.mutate(bol.id); }}>
                                  <Ban className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
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
                {pageItens.map(bol => {
                  const dias = diasParaVencer(bol.data_vencimento);
                  const isVencido = bol.status === 'ABERTO' && dias !== null && dias < 0;
                  const statusConf = STATUS_MAP[bol.status] || STATUS_MAP.ABERTO;
                  return (
                    <div key={bol.id} className={`p-3 rounded-lg border space-y-2 ${isVencido ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-gray-900 break-words min-w-0" title={bol.descricao}>{bol.descricao || '—'}</p>
                        {isVencido
                          ? <Badge className="bg-red-100 text-red-700 border-0 shrink-0">Vencido</Badge>
                          : <Badge className={`${statusConf.className} border-0 shrink-0`}>{statusConf.label}</Badge>}
                      </div>
                      {(bol.fornecedor_nome || bol.obra_nome) && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                          {bol.fornecedor_nome && <span className="break-words">{bol.fornecedor_nome}</span>}
                          {bol.obra_nome && <span className="break-words">· {bol.obra_nome}</span>}
                        </div>
                      )}
                      <div className="flex items-end justify-between gap-2">
                        <div className="text-xs min-w-0">
                          <div className="flex items-center gap-1 text-gray-500"><Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {fmtDate(bol.data_vencimento)}</div>
                          {bol.status !== 'PAGO' && bol.status !== 'CANCELADO' && dias !== null && (
                            <span className={`font-semibold ${dias < 0 ? 'text-red-600' : dias <= 3 ? 'text-amber-600' : 'text-gray-500'}`}>
                              {dias < 0 ? `${Math.abs(dias)}d atraso` : dias === 0 ? 'Vence hoje' : `Vence em ${dias}d`}
                            </span>
                          )}
                        </div>
                        <p className="text-base font-bold text-gray-900 tabular-nums shrink-0">{fmt(bol.valor)}</p>
                      </div>
                      <div className="flex items-center gap-1 pt-2 border-t border-gray-100">
                        <Button size="sm" variant="ghost" className="gap-1 h-8" onClick={() => { setBoletoDetalhe(bol); setDetalheOpen(true); }}>
                          <Eye className="w-3.5 h-3.5" /> Ver
                        </Button>
                        {bol.status !== 'PAGO' && bol.status !== 'CANCELADO' && (
                          <>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Editar" onClick={() => { setBoletoEdit(bol); setFormOpen(true); }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-600" title="Pagar" onClick={() => { setBoletoPagar(bol); setPagarOpen(true); }}>
                              <CreditCard className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 ml-auto" title="Cancelar" onClick={() => { if (confirm('Cancelar este boleto?')) cancelarMutation.mutate(bol.id); }}>
                              <Ban className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            startIndex={startIndex}
            endIndex={endIndex}
            totalItems={totalItems}
          />
        </CardContent>
      </Card>

      <BoletoFormModal open={formOpen} onClose={() => { setFormOpen(false); setBoletoEdit(null); }} boleto={boletoEdit} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['boletos-pagar'] })} />
      <BoletoPagarModal open={pagarOpen} onClose={() => { setPagarOpen(false); setBoletoPagar(null); }} boleto={boletoPagar} />
      <BoletoDetalheModal open={detalheOpen} onClose={() => { setDetalheOpen(false); setBoletoDetalhe(null); }} boleto={boletoDetalhe} />
    </div>
  );
}
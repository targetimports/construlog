import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { useEmpresa } from '@/components/shared/useEmpresaContext';
import AbastecimentoModal from './AbastecimentoModal';
import { Plus, Fuel, Search, Gauge, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

// CONTROLE DE ABASTECIMENTO — o abastecimento lançado na obra chega aqui como
// PENDENTE e só vira conta a pagar do posto quando o responsável pela frota aprova.
// Mostra também o consumo (km/l em veículo, l/h em máquina): é o número que denuncia
// desvio de combustível e problema mecânico antes de virar prejuízo.

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v, d = 2) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const dataBR = (d) => (d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '—');
const hojeISO = () => new Date().toISOString().slice(0, 10);

// Lançamento antigo (antes da aprovação existir) não tem status: conta como aprovado.
const statusDe = (a) => String(a.status || 'APROVADO').toUpperCase();
const STATUS_CFG = {
  PENDENTE: { label: 'Aguardando aprovação', icon: Clock, cls: 'bg-amber-100 text-amber-700' },
  APROVADO: { label: 'Aprovado', icon: CheckCircle, cls: 'bg-green-100 text-green-700' },
  REJEITADO: { label: 'Rejeitado', icon: XCircle, cls: 'bg-red-100 text-red-700' },
};

export default function AbastecimentosTab() {
  const qc = useQueryClient();
  const { acessoGlobal } = useEmpresa();
  const [modal, setModal] = useState(false);
  const [busca, setBusca] = useState('');
  const [rejeitar, setRejeitar] = useState({ open: false, ab: null });
  const [motivo, setMotivo] = useState('');

  const { data: abastecimentos = [], isLoading } = useQuery({
    queryKey: ['abastecimentos'],
    queryFn: () => base44.entities.Abastecimento.list('-data', 1000).catch(() => []),
  });

  const aprovacao = useMutation({
    mutationFn: (payload) => base44.functions.invoke('aprovarAbastecimentoAtivo', payload),
    onSuccess: (res) => {
      const d = res.data || {};
      if (d.success === false) { toast.error(d.error || 'Erro ao processar.'); return; }
      qc.invalidateQueries({ queryKey: ['abastecimentos'] });
      toast.success(d.status === 'APROVADO'
        ? `Aprovado — ${fmtBRL(d.valor_total)} lançado em contas a pagar.`
        : 'Abastecimento rejeitado.');
      setRejeitar({ open: false, ab: null });
      setMotivo('');
    },
    onError: (e) => toast.error('Erro: ' + (e?.message || e)),
  });

  const confirmarRejeicao = () => {
    if (!motivo.trim()) { toast.error('Informe o motivo da rejeição.'); return; }
    aprovacao.mutate({ abastecimento_id: rejeitar.ab.id, aprovar: false, motivo_rejeicao: motivo.trim() });
  };

  const filtrados = useMemo(() => {
    if (!busca) return abastecimentos;
    const t = busca.toLowerCase();
    return abastecimentos.filter((a) =>
      a.ativo_nome?.toLowerCase().includes(t) ||
      a.ativo_placa?.toLowerCase().includes(t) ||
      a.posto?.toLowerCase().includes(t) ||
      a.obra_nome?.toLowerCase().includes(t));
  }, [abastecimentos, busca]);

  const { paginatedItems, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(filtrados, 20);

  // KPIs: só o que foi aprovado conta como gasto — pendente ainda pode ser rejeitado.
  const mes = hojeISO().slice(0, 7);
  const doMes = abastecimentos.filter((a) => String(a.data || '').startsWith(mes) && statusDe(a) === 'APROVADO');
  const gastoMes = doMes.reduce((s, a) => s + Number(a.valor_total || 0), 0);
  const litrosMes = doMes.reduce((s, a) => s + Number(a.litros || 0), 0);
  const pendentes = abastecimentos.filter((a) => statusDe(a) === 'PENDENTE');

  const AcoesAprovacao = ({ a, size = 'sm' }) => {
    if (statusDe(a) !== 'PENDENTE') return null;
    if (!acessoGlobal) return <span className="text-xs text-gray-400 italic">aguardando Matriz</span>;
    return (
      <div className="flex gap-1 justify-end">
        <Button variant="outline" size={size} className="h-8 text-green-600 border-green-300 hover:bg-green-50"
          disabled={aprovacao.isPending}
          onClick={() => aprovacao.mutate({ abastecimento_id: a.id, aprovar: true })}>
          Aprovar
        </Button>
        <Button variant="outline" size={size} className="h-8 text-red-600 border-red-300 hover:bg-red-50"
          onClick={() => { setMotivo(''); setRejeitar({ open: true, ab: a }); }}>
          Rejeitar
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Abastecimentos</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Abastecimento aprovado vira conta a pagar do posto, na obra que usou o veículo.
          </p>
        </div>
        <Button onClick={() => setModal(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Registrar Abastecimento
        </Button>
      </div>

      {pendentes.length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            <strong>{pendentes.length}</strong> abastecimento(s) lançado(s) nas obras aguardando aprovação —
            somam {fmtBRL(pendentes.reduce((s, a) => s + Number(a.valor_total || 0), 0))}.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-white border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500">Gasto no mês</p>
          <p className="text-lg sm:text-2xl font-bold text-blue-600 mt-1 tabular-nums">{fmtBRL(gastoMes)}</p>
        </Card>
        <Card className="bg-white border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500">Litros no mês</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 tabular-nums">{fmtNum(litrosMes, 1)} L</p>
        </Card>
        <Card className="bg-white border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500">Aguardando aprovação</p>
          <p className="text-lg sm:text-2xl font-bold text-amber-600 mt-1 tabular-nums">{pendentes.length}</p>
        </Card>
        <Card className="bg-white border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500">Preço médio do litro</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 tabular-nums">
            {litrosMes > 0 ? fmtBRL(gastoMes / litrosMes) : '—'}
          </p>
        </Card>
      </div>

      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6">
          <div className="relative sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input className="pl-9 h-11" placeholder="Buscar por ativo, placa, posto ou obra..."
              value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={8} />
          ) : filtrados.length === 0 ? (
            <div className="text-center py-12">
              <Fuel className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">Nenhum abastecimento registrado.</p>
            </div>
          ) : (
            <>
              {/* Cards no mobile — a tabela não cabe em tela de celular. */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {paginatedItems.map((a) => {
                  const st = STATUS_CFG[statusDe(a)] || STATUS_CFG.APROVADO;
                  const StIcon = st.icon;
                  return (
                    <div key={a.id} className="p-3 rounded-lg border border-gray-200 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{a.ativo_nome}{a.ativo_placa ? ` · ${a.ativo_placa}` : ''}</p>
                          <p className="text-xs text-gray-500">{dataBR(a.data)}{a.posto ? ` · ${a.posto}` : ''}</p>
                        </div>
                        <span className="font-semibold text-gray-900 tabular-nums">{fmtBRL(a.valor_total)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>{fmtNum(a.litros, 1)} L · {fmtBRL(a.valor_litro)}/L</span>
                        <Badge className={`gap-1 ${st.cls}`}><StIcon className="w-3 h-3" />{st.label}</Badge>
                      </div>
                      {a.obra_nome && <p className="text-xs text-gray-400">{a.obra_nome}</p>}
                      <AcoesAprovacao a={a} />
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Data</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Ativo</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Obra</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Posto</th>
                      <th className="text-right p-3 text-xs font-semibold text-gray-500">Litros</th>
                      <th className="text-right p-3 text-xs font-semibold text-gray-500">R$/L</th>
                      <th className="text-right p-3 text-xs font-semibold text-gray-500">Consumo</th>
                      <th className="text-right p-3 text-xs font-semibold text-gray-500">Total</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Status</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedItems.map((a) => {
                      const st = STATUS_CFG[statusDe(a)] || STATUS_CFG.APROVADO;
                      const StIcon = st.icon;
                      return (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="p-3 text-gray-600 whitespace-nowrap">{dataBR(a.data)}</td>
                          <td className="p-3 text-gray-900">
                            {a.ativo_nome}
                            {a.ativo_placa && <span className="text-gray-400"> · {a.ativo_placa}</span>}
                          </td>
                          <td className="p-3 text-gray-600">{a.obra_nome || <span className="text-gray-300">Pátio</span>}</td>
                          <td className="p-3 text-gray-600">{a.posto || '—'}</td>
                          <td className="p-3 text-right tabular-nums text-gray-700">{fmtNum(a.litros, 1)}</td>
                          <td className="p-3 text-right tabular-nums text-gray-600">{fmtBRL(a.valor_litro)}</td>
                          <td className="p-3 text-right tabular-nums">
                            {a.consumo != null
                              ? <span className="text-gray-700 whitespace-nowrap"><Gauge className="w-3 h-3 inline mr-1 text-gray-400" />{fmtNum(a.consumo, 2)} <span className="text-gray-400">{a.medidor_tipo === 'km' ? 'km/l' : 'l/h'}</span></span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="p-3 text-right tabular-nums font-medium text-gray-900">{fmtBRL(a.valor_total)}</td>
                          <td className="p-3">
                            <Badge className={`gap-1 ${st.cls}`} title={a.motivo_rejeicao || ''}>
                              <StIcon className="w-3 h-3" />{st.label}
                            </Badge>
                          </td>
                          <td className="p-3"><AcoesAprovacao a={a} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage}
                startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
            </>
          )}
        </CardContent>
      </Card>

      <AbastecimentoModal open={modal} onClose={() => setModal(false)} />

      {/* Rejeitar: motivo obrigatório, para o pessoal da obra saber o que corrigir. */}
      <Dialog open={rejeitar.open} onOpenChange={(o) => !o && setRejeitar({ open: false, ab: null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar abastecimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              {rejeitar.ab?.ativo_nome} · {fmtBRL(rejeitar.ab?.valor_total)} · {dataBR(rejeitar.ab?.data)}
            </p>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Motivo da rejeição</Label>
              <Textarea rows={3} placeholder="Nota não confere, valor divergente, abastecimento não autorizado..."
                value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejeitar({ open: false, ab: null })}>Cancelar</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={confirmarRejeicao} disabled={aprovacao.isPending}>
              {aprovacao.isPending ? 'Rejeitando...' : 'Rejeitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

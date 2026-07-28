import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Truck, CheckCircle2, XCircle, ArrowLeft, ArrowRight, Search, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { ListSkeleton } from '@/components/shared/Skeletons';
import { toast } from 'sonner';

const num = (v) => Number(v) || 0;
const fmtN = (v) => num(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const PER_PAGE = 15;

// Estoque em 3 níveis. Distribuição segue as transições que o motor valida:
// Central → Empresa, Central → Obra, Empresa → Obra.
const nivelDe = (l) => (l?.nivel || l?.tipo || 'OBRA');
const NIVEL_NOME = { CENTRAL: 'Central', EMPRESA: 'Empresa', OBRA: 'Obra' };
const NIVEL_CLS = { CENTRAL: 'bg-blue-100 text-blue-700', EMPRESA: 'bg-purple-100 text-purple-700', OBRA: 'bg-green-100 text-green-700' };
const NIVEL_ORDEM = { CENTRAL: 0, EMPRESA: 1, OBRA: 2 };
const TRANSICOES = { CENTRAL: ['EMPRESA', 'OBRA'], EMPRESA: ['OBRA'], OBRA: [] };
const localLabel = (l) => `${l.nome} — ${NIVEL_NOME[nivelDe(l)] || 'Obra'}`;

// emModal: renderizado dentro de um Dialog (o título vem do DialogTitle).
export default function TransferenciaEstoqueObra({ emModal = false }) {
  const qc = useQueryClient();
  const [origemId, setOrigemId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [qtds, setQtds] = useState({});
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState(null);

  const { data: locais = [] } = useQuery({
    queryKey: ['local-estoque'],
    queryFn: () => base44.entities.LocalEstoque.list('-created_date', 500),
  });
  const locaisAtivos = useMemo(
    () => [...locais.filter((l) => l.ativo !== false)].sort((a, b) => (NIVEL_ORDEM[nivelDe(a)] ?? 9) - (NIVEL_ORDEM[nivelDe(b)] ?? 9)),
    [locais]
  );
  const localMap = useMemo(() => Object.fromEntries(locais.map((l) => [l.id, l])), [locais]);

  const origemNivel = origemId ? nivelDe(localMap[origemId]) : null;
  const destinosPermitidos = origemNivel ? (TRANSICOES[origemNivel] || []) : ['CENTRAL', 'EMPRESA', 'OBRA'];

  // Saldo da origem via fonte única (getSaldosEstoque, event-sourced + escopo por empresa).
  const { data: saldos = [], isLoading: loadingSaldos } = useQuery({
    queryKey: ['saldos-transferencia', origemId],
    queryFn: () => origemId
      ? base44.functions.invoke('getSaldosEstoque', { local_estoque_id: origemId }).then((r) => r.data?.saldos || [])
      : Promise.resolve([]),
    enabled: !!origemId,
  });
  const saldosComEstoque = useMemo(() => saldos.filter((s) => num(s.saldo) > 0), [saldos]);
  const saldoMap = useMemo(() => Object.fromEntries(saldos.map((s) => [s.material_id, s])), [saldos]);

  // Ao trocar de origem, limpa a seleção (e o destino se ficou inválido).
  useEffect(() => {
    setSelecionados(new Set()); setQtds({}); setPagina(1);
    setDestinoId((d) => (d && localMap[d] && destinosPermitidos.includes(nivelDe(localMap[d])) && d !== origemId ? d : ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origemId]);
  useEffect(() => { setPagina(1); }, [busca]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? saldosComEstoque.filter((s) => (s.material_nome || '').toLowerCase().includes(q)) : saldosComEstoque;
  }, [saldosComEstoque, busca]);
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PER_PAGE));
  const pag = Math.min(pagina, totalPaginas);
  const pageItens = filtrados.slice((pag - 1) * PER_PAGE, pag * PER_PAGE);

  const toggle = (materialId) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      next.has(materialId) ? next.delete(materialId) : next.add(materialId);
      return next;
    });
  };

  const { mutate: transferir, isPending } = useMutation({
    mutationFn: async () => {
      const itens = [];
      for (const mid of selecionados) {
        const s = saldoMap[mid];
        const q = parseFloat(qtds[mid] || 0);
        if (s && q > 0) itens.push({
          material_id: mid,
          insumo_id: s.insumo_id || mid,
          material_nome: s.material_nome,
          material_unidade: s.material_unidade,
          qtd: q,
          custo_unit: num(s.custo_medio),
        });
      }
      const res = await base44.functions.invoke('processarMovimentacaoEstoque', {
        tipo: 'TRANSFERENCIA',
        origem_local_id: origemId,
        destino_local_id: destinoId,
        documento_ref: `TRANSF-${origemId.slice(0, 4)}`,
        itens,
      });
      if (!res.data?.success) throw new Error(res.data?.error || 'Falha ao transferir');
      return { res: res.data, itens };
    },
    onSuccess: ({ res, itens }) => {
      qc.invalidateQueries({ queryKey: ['saldos-transferencia'] });
      qc.invalidateQueries({ queryKey: ['saldos-estoque-dash'] });
      qc.invalidateQueries({ queryKey: ['saldos-estoque-calc'] });
      setResultado({
        sucesso: true,
        movId: res.movimentacao_id,
        origem: localMap[origemId] ? localLabel(localMap[origemId]) : '—',
        destino: localMap[destinoId] ? localLabel(localMap[destinoId]) : '—',
        itens: itens.map((i) => ({ nome: i.material_nome, qtd: i.qtd, un: i.material_unidade })),
      });
      setSelecionados(new Set()); setQtds({}); setOrigemId(''); setDestinoId('');
    },
    onError: (err) => setResultado({ sucesso: false, erro: err.message }),
  });

  const handleTransferir = () => {
    if (!origemId || !destinoId) return toast.error('Selecione origem e destino');
    if (origemId === destinoId) return toast.error('Origem e destino devem ser diferentes');
    const sel = [...selecionados];
    const validos = sel.filter((mid) => parseFloat(qtds[mid] || 0) > 0);
    if (validos.length === 0) return toast.error('Selecione itens e informe as quantidades');
    const semSaldo = validos.filter((mid) => parseFloat(qtds[mid]) > num(saldoMap[mid]?.saldo));
    if (semSaldo.length) return toast.error('Quantidade acima do saldo disponível em algum item');
    transferir();
  };

  /* ─────────── Tela de resultado ─────────── */
  if (resultado) {
    return (
      <div className="space-y-6 pb-6 max-w-3xl mx-auto">
        <Card className={`border-2 ${resultado.sucesso ? 'border-green-200' : 'border-red-200'}`}>
          <CardContent className="pt-8 pb-8 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${resultado.sucesso ? 'bg-green-100' : 'bg-red-100'}`}>
              {resultado.sucesso ? <CheckCircle2 className="w-8 h-8 text-green-600" /> : <XCircle className="w-8 h-8 text-red-600" />}
            </div>
            <h2 className={`text-xl font-bold mb-2 ${resultado.sucesso ? 'text-green-700' : 'text-red-700'}`}>
              {resultado.sucesso ? 'Transferência registrada com sucesso!' : 'Erro ao transferir'}
            </h2>
            {resultado.sucesso ? (
              <div className="bg-gray-50 rounded-lg p-4 text-left max-w-md mx-auto my-6">
                <p className="text-xs text-gray-500">Movimentação</p>
                <p className="font-mono font-semibold text-gray-900 mb-3">{resultado.movId}</p>
                <p className="text-xs text-gray-500">De → Para</p>
                <p className="font-semibold text-gray-900 mb-3">{resultado.origem} → {resultado.destino}</p>
                <p className="text-xs text-gray-500 mb-1">Itens</p>
                <ul className="space-y-1">
                  {resultado.itens.map((it, i) => (
                    <li key={i} className="text-sm text-gray-700">• {it.nome}: <span className="font-semibold">{fmtN(it.qtd)} {it.un}</span></li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-gray-600 mb-6">{resultado.erro || 'Tente novamente'}</p>
            )}
            <Button onClick={() => setResultado(null)} className="bg-blue-600 hover:bg-blue-700">
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      {!emModal && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Distribuição de Estoque</h1>
          <p className="text-gray-500 text-sm mt-1">Distribua o estoque entre os níveis: Central (Matriz) → Empresa → Obra</p>
        </div>
      )}

      {/* Como funciona (compacto) */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 text-sm">
        <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-blue-800">
          A Matriz recebe as compras no <strong>Estoque Central</strong> e distribui pelos níveis (Central → Empresa → Obra) —
          o destino se ajusta ao nível da origem. A transferência <strong>não altera o caixa</strong>: o material já foi pago na compra, só move o saldo.
        </p>
      </div>

      <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-600" /> Nova Transferência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Origem + Destino */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Almoxarifado Origem *</label>
                <ComboboxBusca
                  options={locaisAtivos.map((l) => ({ value: l.id, label: localLabel(l) }))}
                  value={origemId} onSelect={setOrigemId}
                  placeholder="Selecionar origem..." searchPlaceholder="Buscar almoxarifado..." emptyMessage="Nenhum almoxarifado."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Almoxarifado Destino *</label>
                <ComboboxBusca
                  options={locaisAtivos
                    .filter((l) => l.id !== origemId && (!origemNivel || destinosPermitidos.includes(nivelDe(l))))
                    .map((l) => ({ value: l.id, label: localLabel(l) }))}
                  value={destinoId} onSelect={setDestinoId}
                  placeholder={origemNivel && destinosPermitidos.length === 0 ? 'Origem não distribui' : 'Selecionar destino...'}
                  searchPlaceholder="Buscar almoxarifado..."
                  emptyMessage={origemNivel === 'OBRA' ? 'Obra não é origem de distribuição.' : 'Nenhum destino válido.'}
                />
              </div>
            </div>

            {/* Fluxo válido */}
            {origemId && (
              <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                <Badge className={`${NIVEL_CLS[origemNivel] || ''} border-0`}>{NIVEL_NOME[origemNivel] || 'Obra'}</Badge>
                <ArrowRight className="w-3 h-3" />
                {destinosPermitidos.length ? destinosPermitidos.map((nv) => (
                  <Badge key={nv} className={`${NIVEL_CLS[nv]} border-0`}>{NIVEL_NOME[nv]}</Badge>
                )) : <span className="text-gray-400">— (nível de obra consome, não distribui)</span>}
              </div>
            )}

            {/* Itens da origem */}
            <div>
              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <label className="text-sm font-medium text-gray-700">Itens disponíveis na origem {origemId ? `(${filtrados.length})` : ''}</label>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input className="pl-9 h-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar insumo..." disabled={!origemId} />
                </div>
              </div>

              {!origemId ? (
                <p className="text-sm text-gray-400 text-center py-8 border border-gray-200 rounded-lg">Selecione o almoxarifado de origem.</p>
              ) : loadingSaldos ? (
                <ListSkeleton rows={6} />
              ) : filtrados.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8 border border-gray-200 rounded-lg">Nenhum item com saldo nesse almoxarifado.</p>
              ) : (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {pageItens.map((s) => {
                    const sel = selecionados.has(s.material_id);
                    const excede = sel && parseFloat(qtds[s.material_id] || 0) > num(s.saldo);
                    return (
                      <div key={`${s.local_estoque_id}|${s.material_id}`} className={`flex items-start gap-3 p-3 ${sel ? 'bg-blue-50/40' : ''}`}>
                        <Checkbox checked={sel} onCheckedChange={() => toggle(s.material_id)} className="mt-1" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900">{s.material_nome || s.material_id}</p>
                          <p className="text-xs text-gray-500">Disponível: {fmtN(s.saldo)} {s.material_unidade || ''}</p>
                        </div>
                        {sel && (
                          <div className="w-28">
                            <Input
                              type="number" min="0" step="0.001" max={s.saldo}
                              value={qtds[s.material_id] || ''}
                              onChange={(e) => setQtds((q) => ({ ...q, [s.material_id]: e.target.value }))}
                              placeholder="Qtd"
                              className={`h-9 text-sm text-right ${excede ? 'border-red-400' : ''}`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filtrados.length > PER_PAGE && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-3">
                      <span className="text-xs text-gray-500">Mostrando {(pag - 1) * PER_PAGE + 1}–{Math.min(pag * PER_PAGE, filtrados.length)} de {filtrados.length}</span>
                      <div className="flex items-center justify-between sm:justify-end gap-2">
                        <Button variant="outline" size="sm" disabled={pag <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))} className="h-8 gap-1 border-gray-300 text-gray-700"><ChevronLeft className="w-4 h-4" /> Anterior</Button>
                        <span className="text-xs text-gray-600 whitespace-nowrap">Página {pag} de {totalPaginas}</span>
                        <Button variant="outline" size="sm" disabled={pag >= totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} className="h-8 gap-1 border-gray-300 text-gray-700">Próxima <ChevronRight className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {selecionados.size > 0 && <p className="text-xs text-gray-500 mt-2">{selecionados.size} item(ns) selecionado(s).</p>}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => { setOrigemId(''); setDestinoId(''); setSelecionados(new Set()); setQtds({}); }}>Limpar</Button>
              <Button className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 gap-2" onClick={handleTransferir} disabled={isPending}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {isPending ? 'Transferindo...' : 'Confirmar Transferência'}
              </Button>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}

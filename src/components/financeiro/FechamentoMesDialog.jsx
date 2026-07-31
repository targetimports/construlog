import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, AlertTriangle, CheckCircle2, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';

// FECHAR O MÊS — a conferência antes do congelamento.
//
// Fechar sem conferir é congelar um retrato errado, o que é pior que não fechar:
// o número errado passa a ter autoridade de histórico. Por isso a lista de
// pendências vem antes do botão, e o que é bloqueio não tem como ser ignorado.
//
// Os avisos, sim, podem ser assumidos — mas ficam gravados no fechamento, para
// que meses depois se saiba em que condições aquele número foi congelado.

const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function FechamentoMesDialog({ obraId, competencia, onFechar }) {
  const queryClient = useQueryClient();
  const [observacao, setObservacao] = useState('');
  const [motivoReabertura, setMotivoReabertura] = useState('');
  const [modoReabrir, setModoReabrir] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['conferencia-fechamento', obraId, competencia],
    queryFn: async () => {
      const r = await base44.functions.invoke('getConferenciaFechamento', { obra_id: obraId, competencia });
      return r.data;
    },
    enabled: !!obraId && !!competencia,
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['conferencia-fechamento', obraId] });
    queryClient.invalidateQueries({ queryKey: ['desvio-obra', obraId] });
  };

  const fecharMes = useMutation({
    mutationFn: async () => {
      const r = await base44.functions.invoke('fecharMesObra', { obra_id: obraId, competencia, observacao });
      return r.data;
    },
    onSuccess: (d) => {
      invalidar();
      toast.success(
        d?.pendencias?.length
          ? `Competência ${competencia} fechada, com ${d.pendencias.length} pendência(s) assumida(s).`
          : `Competência ${competencia} fechada.`,
      );
      onFechar();
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message || 'Não foi possível fechar.'),
  });

  const reabrir = useMutation({
    mutationFn: async () => {
      const r = await base44.functions.invoke('reabrirMesObra', { obra_id: obraId, competencia, motivo: motivoReabertura });
      return r.data;
    },
    onSuccess: () => { invalidar(); toast.success(`Competência ${competencia} reaberta.`); onFechar(); },
    onError: (e) => toast.error(e?.response?.data?.error || e.message || 'Não foi possível reabrir.'),
  });

  const bloqueios = (data?.conferencia || []).filter((i) => i.nivel === 'bloqueio');
  const avisos = (data?.conferencia || []).filter((i) => i.nivel === 'aviso');
  const r = data?.resumo;

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            {data?.ja_fechado ? <Lock className="w-4 h-4 text-gray-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            {data?.ja_fechado ? `Competência ${competencia} fechada` : `Fechar a competência ${competencia}`}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-gray-400 py-6 text-center">Conferindo...</p>
        ) : data?.ja_fechado ? (
          <div className="space-y-3 text-sm">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1">
              <p className="text-gray-600">
                Fechada por <strong>{data.fechamento?.fechado_por || '—'}</strong> em{' '}
                {String(data.fechamento?.fechado_em || '').slice(0, 10)}.
              </p>
              {data.fechamento?.retrato && (
                <p className="text-xs text-gray-500">
                  Retrato congelado: custo projetado {fmt(data.fechamento.retrato.custo_final_projetado)} ·
                  margem {Number(data.fechamento.retrato.margem_projetada_pct ?? 0).toFixed(1)}%
                </p>
              )}
              {data.fechamento?.pendencias?.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs text-amber-700 font-medium">Pendências assumidas no fechamento:</p>
                  <ul className="text-xs text-amber-700 list-disc pl-4">
                    {data.fechamento.pendencias.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}
            </div>

            {!modoReabrir ? (
              <p className="text-xs text-gray-500">
                Lançamentos posteriores continuam sendo aceitos, mas o retrato acima não muda.
                Reabra a competência se o número precisa ser corrigido.
              </p>
            ) : (
              <div className="space-y-1">
                <label className="text-xs text-gray-600">Por que está reabrindo?</label>
                <Textarea
                  value={motivoReabertura}
                  onChange={(e) => setMotivoReabertura(e.target.value)}
                  placeholder="Ex.: nota fiscal do fornecedor chegou com atraso."
                  rows={2}
                />
                <p className="text-[11px] text-gray-400">Fica registrado com seu nome e a data, junto do retrato anterior.</p>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onFechar}>Voltar</Button>
              {!modoReabrir ? (
                <Button variant="outline" onClick={() => setModoReabrir(true)}>
                  <Unlock className="w-3.5 h-3.5 mr-1.5" /> Reabrir
                </Button>
              ) : (
                <Button
                  onClick={() => reabrir.mutate()}
                  disabled={motivoReabertura.trim().length < 10 || reabrir.isPending}
                >
                  {reabrir.isPending ? 'Reabrindo...' : 'Confirmar reabertura'}
                </Button>
              )}
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            {r && (
              <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div>
                  <p className="text-[11px] text-gray-500">Avanço</p>
                  <p className="font-semibold text-sm">{Number(r.avanco_pct || 0).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Desvio</p>
                  <p className={`font-semibold text-sm ${Number(r.desvio) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(r.desvio)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Margem projetada</p>
                  <p className="font-semibold text-sm">{Number(r.margem_projetada_pct ?? 0).toFixed(1)}%</p>
                </div>
              </div>
            )}

            {bloqueios.length === 0 && avisos.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <CheckCircle2 className="w-4 h-4" /> Nada pendente. O mês pode ser fechado.
              </div>
            )}

            {bloqueios.map((i) => (
              <div key={i.chave} className="flex items-start gap-2 text-xs bg-red-50 border border-red-200 text-red-800 rounded-lg p-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                <span><strong>{i.titulo}.</strong> {i.detalhe}</span>
              </div>
            ))}
            {avisos.map((i) => (
              <div key={i.chave} className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                <span><strong>{i.titulo}.</strong> {i.detalhe}</span>
              </div>
            ))}

            {avisos.length > 0 && bloqueios.length === 0 && (
              <p className="text-[11px] text-gray-500">
                Os avisos acima não impedem o fechamento, mas ficam registrados como pendências assumidas.
              </p>
            )}

            <div className="space-y-1">
              <label className="text-xs text-gray-600">Observação do fechamento (opcional)</label>
              <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2}
                placeholder="Contexto que ajude a entender estes números meses depois." />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onFechar}>Cancelar</Button>
              <Button onClick={() => fecharMes.mutate()} disabled={!data?.pode_fechar || fecharMes.isPending}>
                <Lock className="w-3.5 h-3.5 mr-1.5" />
                {fecharMes.isPending ? 'Fechando...' : 'Fechar o mês'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

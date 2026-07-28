import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Truck, PackageCheck, Camera, X, Loader2, Info, ShoppingCart, CheckCircle2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import DetalheRequisicaoModal from './DetalheRequisicaoModal';

const fmtQtd = (v) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const dataBR = (d) => { const [, m, dia] = String(d || '').slice(0, 10).split('-'); return dia && m ? `${dia}/${m}` : '—'; };

// RECEBER MATERIAL — 2º passo do fluxo de requisição, para o responsável da obra.
// O "Atender" (na Central) enviou o material e ele está EM TRÂNSITO; aqui a obra
// confere a quantidade que chegou (pode reduzir por quebra), anexa fotos e recebe.
// A diferença (enviado − recebido) volta para a origem — quem trata isso é o backend.
// `somente`: undefined = tudo; 'compra' = só o que veio de compra; 'estoque' = só
// requisição interna. Serve para a aba de Compras mostrar só as compras.
export default function ReceberMaterialTab({ obraId, podeEditar = false, somente }) {
  const queryClient = useQueryClient();
  const [recebendo, setRecebendo] = useState(null);
  const [verDetalhe, setVerDetalhe] = useState(null);

  // Requisições desta obra que estão EM_TRANSITO (material enviado, aguardando receber).
  const { data: emTransito = [], isLoading } = useQuery({
    queryKey: ['requisicoes-em-transito', obraId, somente || 'todas'],
    queryFn: async () => {
      const reqs = (await base44.entities.RequisicaoObra.filter({ obra_id: obraId, status: 'EM_TRANSITO' }).catch(() => []))
        .filter((r) => !somente || (somente === 'compra' ? r.origem_tipo === 'compra' : r.origem_tipo !== 'compra'));
      const comItens = await Promise.all((reqs || []).map(async (r) => {
        const itens = await base44.entities.RequisicaoObraItem.filter({ requisicao_id: r.id }).catch(() => []);
        const emTransitoItens = (itens || [])
          .map((i) => ({ ...i, em_transito: (Number(i.quantidade_enviada) || 0) - (Number(i.quantidade_recebida) || 0) }))
          .filter((i) => i.em_transito > 0.0001);
        return { ...r, itens: emTransitoItens };
      }));
      return comItens.filter((r) => r.itens.length > 0);
    },
    enabled: !!obraId,
  });

  // HISTÓRICO: o que já foi recebido (BAIXADA). Depois de receber, o material some da
  // lista de pendentes — mas a PROVA (fotos, quebra, quem/quando) precisa ficar
  // acessível. Aqui listamos os recebidos, clicáveis para abrir o comprovante.
  const { data: recebidos = [] } = useQuery({
    queryKey: ['requisicoes-recebidas', obraId, somente || 'todas'],
    queryFn: async () => {
      const reqs = (await base44.entities.RequisicaoObra.filter({ obra_id: obraId, status: 'BAIXADA' }, '-data_recebimento', 50).catch(() => []))
        .filter((r) => !somente || (somente === 'compra' ? r.origem_tipo === 'compra' : r.origem_tipo !== 'compra'))
        .filter((r) => r.data_recebimento);
      // Mais recente primeiro. `data_recebimento` é só a DATA (sem hora), então
      // vários recebidos no mesmo dia empatam — desempata pelo horário real do
      // recebimento (updated_date), senão a ordem fica indefinida.
      reqs.sort((a, b) => {
        const d = String(b.data_recebimento).localeCompare(String(a.data_recebimento));
        if (d !== 0) return d;
        return String(b.updated_date || '').localeCompare(String(a.updated_date || ''));
      });
      return reqs.slice(0, 20);
    },
    enabled: !!obraId,
  });

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Carregando...</div>
      ) : emTransito.length === 0 && recebidos.length === 0 ? (
        <div className="text-center py-12">
          <PackageCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">Nenhum material a receber</p>
          <p className="text-xs text-gray-400 mt-1">Quando a Central enviar material desta obra, ele aparece aqui para conferência.</p>
        </div>
      ) : emTransito.length > 0 && (
        <div className="space-y-3">
          {emTransito.map((req) => (
            <div key={req.id} className="border border-blue-200 bg-blue-50/40 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 text-[10px] gap-1">
                      <Truck className="w-3 h-3" /> Em trânsito
                    </Badge>
                    {/* Origem: compra (chegou do fornecedor) vs estoque (requisição interna). */}
                    {req.origem_tipo === 'compra' ? (
                      <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-700 text-[10px] gap-1">
                        <ShoppingCart className="w-3 h-3" /> Compra{req.fornecedor_nome ? ` · ${req.fornecedor_nome}` : ''}{req.numero_nf ? ` · NF ${req.numero_nf}` : ''}
                      </Badge>
                    ) : null}
                    <span className="text-xs text-gray-500">
                      Enviado em {dataBR(req.data_envio)} · de {req.itens[0]?.origem_local_nome || 'origem'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1.5">
                    {req.itens.slice(0, 3).map((i) => `${i.material_nome} (${fmtQtd(i.em_transito)} ${i.material_unidade || ''})`).join(' · ')}
                    {req.itens.length > 3 ? ` +${req.itens.length - 3} item(ns)` : ''}
                  </p>
                </div>
                {podeEditar && (
                  <Button size="sm" onClick={() => setRecebendo(req)} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 shrink-0">
                    <PackageCheck className="w-4 h-4" /> Receber
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* HISTÓRICO — já recebidos. Clique abre o comprovante (fotos, quebras, quem/quando). */}
      {recebidos.length > 0 && (
        <div className={emTransito.length > 0 ? 'pt-2' : ''}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Recebidos
          </p>
          <div className="space-y-2">
            {recebidos.map((req) => (
              <button
                key={req.id}
                type="button"
                onClick={() => setVerDetalhe(req)}
                className="w-full text-left flex items-center justify-between gap-3 border border-gray-200 rounded-lg p-3 hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px] gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Recebido
                    </Badge>
                    {req.origem_tipo === 'compra' && (
                      <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-700 text-[10px] gap-1">
                        <ShoppingCart className="w-3 h-3" /> {req.pedido_numero || 'Compra'}{req.numero_nf ? ` · NF ${req.numero_nf}` : ''}
                      </Badge>
                    )}
                    <span className="text-xs text-gray-500">Recebido em {dataBR(req.data_recebimento)}</span>
                    {(req.fotos_recebimento || []).length > 0 && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Camera className="w-3 h-3" /> {(req.fotos_recebimento || []).length}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{req.fornecedor_nome || req.solicitante_nome || 'Ver detalhes do recebimento'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {recebendo && (
        <ReceberModal
          requisicao={recebendo}
          onClose={() => setRecebendo(null)}
          onDone={() => {
            queryClient.invalidateQueries({ predicate: (q) => {
              const k = String(q.queryKey?.[0] || '');
              return k.includes('transito') || k.includes('recebid') || k.includes('estoque') || k.includes('requisic') || k.includes('materiais');
            } });
            setRecebendo(null);
          }}
        />
      )}

      <DetalheRequisicaoModal requisicao={verDetalhe} open={!!verDetalhe} onClose={() => setVerDetalhe(null)} />
    </div>
  );
}

function ReceberModal({ requisicao, onClose, onDone }) {
  const parse = (v) => Number(String(v ?? '').replace(',', '.')) || 0;
  // Por item: recebido (bom) começa com o enviado; quebrado começa em 0.
  const [rec, setRec] = useState(() => Object.fromEntries(requisicao.itens.map((i) => [i.id, String(i.em_transito)])));
  const [queb, setQueb] = useState(() => Object.fromEntries(requisicao.itens.map((i) => [i.id, ''])));
  const [fotos, setFotos] = useState([]);
  const [observacao, setObservacao] = useState('');
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  // Quanto sobra por item = enviado − recebido − quebrado. Positivo = faltou (volta
  // à origem); negativo = passou do enviado (inválido, trava o botão).
  const sobraDe = (i) => Math.round((i.em_transito - parse(rec[i.id]) - parse(queb[i.id])) * 1000) / 1000;
  const algumInvalido = requisicao.itens.some((i) => sobraDe(i) < -0.0001);

  const receber = useMutation({
    mutationFn: () => base44.functions.invoke('receberTransferenciaObra', {
      requisicao_id: requisicao.id,
      itens: requisicao.itens.map((i) => ({
        requisicao_item_id: i.id,
        quantidade_recebida: parse(rec[i.id]),
        quantidade_quebrada: parse(queb[i.id]),
      })),
      fotos,
      observacao,
    }),
    onSuccess: (res) => {
      const d = res?.data || res;
      const partes = [];
      if (d?.total_perdido > 0) partes.push(`${fmtQtd(d.total_perdido)} perdido (quebra)`);
      if (d?.devolucoes) partes.push('diferença devolvida à origem');
      toast.success(`Material recebido${partes.length ? ` — ${partes.join(', ')}` : ''}. Estoque da obra atualizado.`);
      onDone();
    },
    onError: (err) => {
      const msg = err?.detail?.message || err?.response?.data?.message;
      toast.error(msg || 'Erro ao receber: ' + err.message);
    },
  });

  const subirFoto = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setEnviandoFoto(true);
    try {
      for (const file of files) {
        const r = await base44.integrations.Core.UploadFile({ file });
        const url = r?.data?.file_url || r?.file_url || r?.url;
        if (url) setFotos((f) => [...f, url]);
      }
    } catch (err) {
      toast.error('Falha ao enviar foto: ' + (err?.message || ''));
    } finally {
      setEnviandoFoto(false);
      e.target.value = '';
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-emerald-600" />
            Receber material
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Confira o que chegou. <strong>Recebido</strong> = bom, entra no estoque da obra.
            <strong> Quebrado</strong> = perdido, sai do sistema. O que faltar (não veio) volta para a origem.
          </p>

          <div className="space-y-2">
            {requisicao.itens.map((i) => {
              const sobra = sobraDe(i);
              const invalido = sobra < -0.0001;
              return (
                <div key={i.id} className={`border rounded-md p-2.5 ${invalido ? 'border-red-300 bg-red-50/50' : 'border-gray-200'}`}>
                  <p className="text-sm text-gray-800">{i.material_nome}</p>
                  <p className="text-[11px] text-gray-500">Enviado: {fmtQtd(i.em_transito)} {i.material_unidade || ''}</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <Label className="text-[10px] text-emerald-700">Recebido (bom)</Label>
                      <Input type="text" inputMode="decimal" value={rec[i.id]}
                        onChange={(e) => setRec((q) => ({ ...q, [i.id]: e.target.value }))}
                        className="h-8 text-sm text-right tabular-nums" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-red-600">Quebrado (perda)</Label>
                      <Input type="text" inputMode="decimal" value={queb[i.id]} placeholder="0"
                        onChange={(e) => setQueb((q) => ({ ...q, [i.id]: e.target.value }))}
                        className="h-8 text-sm text-right tabular-nums" />
                    </div>
                  </div>
                  {invalido ? (
                    <p className="text-[10px] text-red-600 mt-1">Recebido + quebrado passa do enviado ({fmtQtd(i.em_transito)}).</p>
                  ) : sobra > 0.0001 ? (
                    <p className="text-[10px] text-amber-700 mt-1">Faltou {fmtQtd(sobra)} {i.material_unidade || ''} — volta para a origem.</p>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div>
            <Label className="text-xs">Fotos (opcional)</Label>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              {fotos.map((url, idx) => (
                <div key={idx} className="relative">
                  <img src={url} alt="" className="w-14 h-14 object-cover rounded border border-gray-200" />
                  <button
                    type="button"
                    onClick={() => setFotos((f) => f.filter((_, i) => i !== idx))}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
              <label className="w-14 h-14 border-2 border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer hover:border-blue-400 text-gray-400">
                {enviandoFoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-5 h-5" />}
                <input type="file" accept="image/*" multiple className="hidden" onChange={subirFoto} disabled={enviandoFoto} />
              </label>
            </div>
          </div>

          <div>
            <Label className="text-xs">Observação (opcional)</Label>
            <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex: 2 sacos rasgados na descarga" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => receber.mutate()} disabled={receber.isPending || enviandoFoto || algumInvalido} className="bg-emerald-600 hover:bg-emerald-700">
            {receber.isPending ? 'Recebendo...' : 'Confirmar recebimento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

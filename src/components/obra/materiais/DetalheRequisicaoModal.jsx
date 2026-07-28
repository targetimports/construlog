import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { PackageCheck, Truck, Camera, User, Calendar, AlertTriangle, Download } from 'lucide-react';
// Visor de fotos compartilhado (era daqui; virou componente comum para a O.S. da frota usar também).
import Lightbox, { baixarImagem } from '@/components/shared/Lightbox';

const fmtQtd = (v) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const dataBR = (d) => (d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '—');
const arquivoURL = (u) => (u && u.startsWith('/api/') ? u : u); // já vem como /api/files/...

// DETALHE DO RECEBIMENTO — a "prova" que ficava só no banco.
// Mostra, por item, o que foi pedido / enviado / recebido / quebrado (perda) /
// devolvido, quem recebeu e quando, a observação e a GALERIA DE FOTOS. É a auditoria
// do "chegou quebrado, aqui está a foto". Só leitura.
export default function DetalheRequisicaoModal({ requisicao, open, onClose }) {
  const [zoomIdx, setZoomIdx] = useState(null);       // foto do RECEBIMENTO (obra)
  const [zoomEntrega, setZoomEntrega] = useState(null); // foto da ENTREGA (motorista)

  const { data: itens = [] } = useQuery({
    queryKey: ['detalhe-requisicao-itens', requisicao?.id],
    queryFn: () => base44.entities.RequisicaoObraItem.filter({ requisicao_id: requisicao.id }).catch(() => []),
    enabled: open && !!requisicao?.id,
  });

  // A VIAGEM que trouxe o material: veículo, motorista, quilometragem e o comprovante
  // que o motorista registrou na chegada. Quem confere o recebimento precisa saber
  // quem entregou — sem isso, uma divergência de quantidade não tem a quem perguntar.
  const { data: viagens = [] } = useQuery({
    queryKey: ['viagem-da-requisicao', requisicao?.id],
    queryFn: () => base44.entities.Viagem.filter({ requisicao_id: requisicao.id }).catch(() => []),
    enabled: open && !!requisicao?.id,
  });
  const viagem = viagens.find((v) => v.status !== 'CANCELADA') || null;

  if (!requisicao) return null;
  const fotos = Array.isArray(requisicao.fotos_recebimento) ? requisicao.fotos_recebimento : [];
  const foiRecebida = requisicao.data_recebimento || itens.some((i) => Number(i.quantidade_recebida) > 0 || Number(i.quantidade_perdida) > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setZoomIdx(null); setZoomEntrega(null); onClose(); } }}>
      <DialogContent
        className="max-w-4xl w-[92vw] max-h-[90vh] overflow-y-auto"
        // Com o visor de foto aberto (portal no body, portanto "fora" do modal),
        // qualquer clique/Esc nele seria lido pelo Radix como interação externa e
        // fecharia o detalhe. Enquanto o visor estiver aberto, bloqueamos esses
        // gatilhos — quem fecha o visor é ele mesmo.
        onInteractOutside={(e) => { if (zoomIdx != null || zoomEntrega != null) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (zoomIdx != null || zoomEntrega != null) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-emerald-600" />
            Requisição #{String(requisicao.id).slice(0, 8)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cabeçalho: quem/quando de cada etapa */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <Info icon={User} label="Solicitante" val={requisicao.solicitante_nome || requisicao.solicitante_user_id} />
            <Info icon={Calendar} label="Pedido em" val={dataBR(requisicao.data_requisicao)} />
            {requisicao.data_envio && <Info icon={Truck} label="Enviado em" val={dataBR(requisicao.data_envio)} />}
            {requisicao.data_recebimento && <Info icon={PackageCheck} label="Recebido em" val={dataBR(requisicao.data_recebimento)} />}
            {requisicao.recebido_por_user_id && <Info icon={User} label="Recebido por" val={requisicao.recebido_por_user_id} />}
          </div>

          {/* Itens: pedido → enviado → recebido / quebrado / devolvido */}
          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left p-2 font-semibold">Material</th>
                  <th className="text-right p-2 font-semibold">Pedido</th>
                  <th className="text-right p-2 font-semibold">Enviado</th>
                  <th className="text-right p-2 font-semibold text-emerald-700">Recebido</th>
                  <th className="text-right p-2 font-semibold text-red-600">Quebrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {itens.map((it) => {
                  const perdido = Number(it.quantidade_perdida) || 0;
                  // Devolvido = enviado histórico − recebido − perdido. Como `quantidade_enviada`
                  // é reduzida na devolução, reconstruímos pelo pedido não é confiável;
                  // mostramos só recebido/quebrado, que são os fatos gravados.
                  return (
                    <tr key={it.id}>
                      <td className="p-2 text-gray-800">{it.material_nome || 'Material'} <span className="text-gray-400">{it.material_unidade || ''}</span></td>
                      <td className="p-2 text-right tabular-nums text-gray-600">{fmtQtd(it.quantidade_solicitada)}</td>
                      <td className="p-2 text-right tabular-nums text-gray-600">{fmtQtd(it.quantidade_recebida != null || perdido ? (Number(it.quantidade_recebida) || 0) + perdido : it.quantidade_atendida)}</td>
                      <td className="p-2 text-right tabular-nums font-medium text-emerald-700">{fmtQtd(it.quantidade_recebida)}</td>
                      <td className="p-2 text-right tabular-nums font-medium text-red-600">{perdido > 0 ? fmtQtd(perdido) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {itens.some((i) => Number(i.quantidade_perdida) > 0) && (
            <div className="flex gap-2 p-2.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Houve material perdido (quebrado) neste recebimento — baixado do sistema, não retornou ao estoque.</span>
            </div>
          )}

          {requisicao.observacao_recebimento && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Observação do recebimento</p>
              <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md p-2.5">{requisicao.observacao_recebimento}</p>
            </div>
          )}

          {/* QUEM TROUXE — veículo, motorista e o que ele registrou na chegada. */}
          {viagem && (
            <div className="rounded-lg border border-gray-200 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" /> Entrega — viagem {viagem.numero}
                </p>
                <Badge className="bg-gray-100 text-gray-700">{viagem.status === 'FINALIZADA' ? 'Finalizada' : viagem.status}</Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Info icon={Truck} label="Veículo" val={[viagem.veiculo_nome, viagem.veiculo_placa].filter(Boolean).join(' · ')} />
                <Info icon={User} label="Motorista" val={viagem.motorista_nome} />
                <Info icon={Calendar} label="Chegou em" val={viagem.chegou_em ? new Date(viagem.chegou_em).toLocaleString('pt-BR') : '—'} />
                <Info icon={User} label="Recebeu do motorista" val={viagem.recebedor_nome} />
                {viagem.origem_nome && <Info icon={PackageCheck} label="Origem" val={viagem.origem_nome} />}
                {viagem.km_percorrido != null && <Info icon={Truck} label="Percurso" val={`${viagem.km_percorrido} km`} />}
              </div>

              {viagem.observacao && (
                <p className="text-xs text-gray-600 italic bg-gray-50 border border-gray-200 rounded p-2">{viagem.observacao}</p>
              )}

              {/* Fotos e assinatura colhidas pelo MOTORISTA na chegada — separadas das
                  fotos do recebimento, que são a conferência feita pela obra. */}
              {(viagem.fotos_entrega || []).length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Fotos da entrega (motorista)</p>
                  <div className="flex flex-wrap gap-2">
                    {viagem.fotos_entrega.map((url, i) => (
                      <button key={url + i} type="button" onClick={() => setZoomEntrega(i)} className="block">
                        <img src={arquivoURL(url)} alt={`Entrega ${i + 1}`}
                          className="w-20 h-20 object-cover rounded border border-gray-200 hover:ring-2 hover:ring-blue-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {viagem.assinatura_url && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Assinatura de quem recebeu</p>
                  <img src={arquivoURL(viagem.assinatura_url)} alt="Assinatura" className="h-14 object-contain" />
                </div>
              )}
            </div>
          )}

          {/* Galeria de fotos — a prova visual */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" /> Fotos do recebimento {fotos.length > 0 && `(${fotos.length})`}
              </p>
              {fotos.length > 1 && (
                <button type="button"
                  onClick={() => fotos.forEach((u, i) => baixarImagem(arquivoURL(u), `recebimento-foto-${i + 1}.jpg`))}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> Baixar todas
                </button>
              )}
            </div>
            {fotos.length === 0 ? (
              <p className="text-xs text-gray-400">{foiRecebida ? 'Nenhuma foto anexada neste recebimento.' : 'Material ainda não recebido.'}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {fotos.map((url, i) => (
                  <div key={i} className="relative group">
                    <button type="button" onClick={() => setZoomIdx(i)} className="block">
                      <img src={arquivoURL(url)} alt={`Foto ${i + 1}`} className="w-28 h-28 object-cover rounded border border-gray-200 group-hover:ring-2 group-hover:ring-blue-400" />
                    </button>
                    <button type="button"
                      onClick={() => baixarImagem(arquivoURL(url), `recebimento-foto-${i + 1}.jpg`)}
                      title="Baixar esta foto"
                      className="absolute bottom-1 right-1 bg-black/60 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Visor em portal no body: preciso disso para o `fixed inset-0` cobrir a
            tela INTEIRA — dentro do DialogContent (que tem transform:translate) o
            `fixed` fica preso à caixa do modal, deixando a foto espremida. O Radix é
            impedido de fechar pelo onInteractOutside/onEscapeKeyDown acima. */}
        <Lightbox
          fotos={fotos.map(arquivoURL)}
          index={zoomIdx}
          onClose={() => setZoomIdx(null)}
          onIndex={setZoomIdx}
          nomeBase="recebimento-foto"
        />

        {/* Visor das fotos da ENTREGA (registradas pelo motorista) — galeria separada
            da do recebimento: são momentos e responsáveis diferentes. */}
        <Lightbox
          fotos={(viagem?.fotos_entrega || []).map(arquivoURL)}
          index={zoomEntrega}
          onClose={() => setZoomEntrega(null)}
          onIndex={setZoomEntrega}
          nomeBase={`entrega-${viagem?.numero || 'foto'}`}
        />
      </DialogContent>
    </Dialog>
  );
}

function Info({ icon: Icon, label, val }) {
  return (
    <div className="flex items-start gap-1.5">
      <Icon className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-gray-400">{label}</p>
        <p className="text-gray-800 truncate">{val || '—'}</p>
      </div>
    </div>
  );
}

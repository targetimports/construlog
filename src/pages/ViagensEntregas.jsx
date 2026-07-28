import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import AssinaturaCanvas from '@/components/shared/AssinaturaCanvas';
import Lightbox from '@/components/shared/Lightbox';
import {
  Truck, MapPin, Package, Camera, Loader2, X, CheckCircle2, Navigation, CornerUpLeft,
  Flag, Search, Eye, Clock, Gauge, User, Crosshair, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

// VIAGENS DE ENTREGA — a tela do motorista.
//
// Ele acompanha a entrega pelos estados e, ao CHEGAR, registra o comprovante (fotos +
// assinatura de quem recebeu). Isso NÃO substitui o recebimento feito pela obra: o
// motorista prova que ENTREGOU, a obra confere o que CHEGOU.
//
// Cada passo grava hora, hodômetro e localização — a linha do tempo da viagem, que
// fica consultável mesmo depois de finalizada.
//
// A tela é autossuficiente: destino, endereço, carga e veículo vêm do próprio registro
// da viagem. O motorista não tem acesso a Obras — se dependesse de buscar a obra,
// veria "sem acesso" justamente no destino da própria entrega.

const dth = (v) => (v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const dthCompleto = (v) => (v ? new Date(v).toLocaleString('pt-BR') : '—');
const fmtNum = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const STATUS = {
  PLANEJADA:  { label: 'A sair',     cls: 'bg-gray-100 text-gray-700' },
  A_CAMINHO:  { label: 'A caminho',  cls: 'bg-blue-100 text-blue-700' },
  NO_DESTINO: { label: 'No destino', cls: 'bg-emerald-100 text-emerald-700' },
  RETORNANDO: { label: 'Voltando',   cls: 'bg-amber-100 text-amber-700' },
  FINALIZADA: { label: 'Finalizada', cls: 'bg-green-100 text-green-700' },
  CANCELADA:  { label: 'Cancelada',  cls: 'bg-red-100 text-red-700' },
};

// O próximo passo de cada estado, com o rótulo que o motorista entende.
const PROXIMO = {
  PLANEJADA:  { status: 'A_CAMINHO',  label: 'Sair para entrega',  curto: 'Sair',      icon: Navigation },
  A_CAMINHO:  { status: 'NO_DESTINO', label: 'Cheguei ao destino', curto: 'Cheguei',   icon: MapPin },
  NO_DESTINO: { status: 'RETORNANDO', label: 'Voltando à origem',  curto: 'Voltando',  icon: CornerUpLeft },
  RETORNANDO: { status: 'FINALIZADA', label: 'Finalizar viagem',   curto: 'Finalizar', icon: Flag },
};

// Localização de onde o passo foi registrado. Opcional de propósito: o navegador pode
// negar a permissão (ou o aparelho estar sem sinal) e isso não pode travar a entrega.
//
// Espera CURTA (3s) e à prova de navegador silencioso: no celular, quando o usuário
// ignora o pedido de permissão, alguns navegadores não chamam nem o callback de erro —
// o registro ficaria pendurado esperando algo que nunca vem. Nunca rejeita.
function pegarLocalizacao() {
  return new Promise((resolve) => {
    let respondido = false;
    const terminar = (v) => { if (!respondido) { respondido = true; resolve(v); } };
    try {
      if (!navigator.geolocation) return terminar(null);
      setTimeout(() => terminar(null), 3000);
      navigator.geolocation.getCurrentPosition(
        (pos) => terminar({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, precisao_gps: pos.coords.accuracy }),
        () => terminar(null),
        { enableHighAccuracy: true, timeout: 3000, maximumAge: 120000 },
      );
    } catch {
      terminar(null);   // contexto não seguro (HTTP) lança em alguns navegadores
    }
  });
}

// A assinatura vem do canvas como data URL (centenas de KB). Vira ARQUIVO antes de
// enviar: no celular isso é a diferença entre um POST de 400 KB e um de 200 bytes —
// e evita inchar o registro da viagem com base64.
function dataUrlParaArquivo(dataUrl, nome) {
  const [meta, b64] = String(dataUrl).split(',');
  const mime = /:(.*?);/.exec(meta)?.[1] || 'image/png';
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new File([buf], nome, { type: mime });
}

export default function ViagensEntregas() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [modal, setModal] = useState({ open: false, viagem: null, passo: null });
  const [detalhe, setDetalhe] = useState(null);
  const [km, setKm] = useState('');
  const [observacao, setObservacao] = useState('');
  const [fotos, setFotos] = useState([]);
  const [assinatura, setAssinatura] = useState('');
  const [recebedor, setRecebedor] = useState('');
  const [subindo, setSubindo] = useState(false);
  const [zoom, setZoom] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['minhas-viagens'],
    queryFn: () => base44.functions.invoke('getMinhasViagens', { incluir_finalizadas: true }).then((r) => r.data),
  });

  // Abertas primeiro: é nelas que o motorista precisa agir.
  const todas = useMemo(() => [...(data?.abertas || []), ...(data?.encerradas || [])], [data]);

  const filtradas = useMemo(() => {
    const t = busca.toLowerCase();
    return todas.filter((v) => {
      if (filtroStatus !== 'todos' && v.status !== filtroStatus) return false;
      if (!t) return true;
      return v.numero?.toLowerCase().includes(t) ||
        v.destino_nome?.toLowerCase().includes(t) ||
        v.veiculo_nome?.toLowerCase().includes(t) ||
        v.veiculo_placa?.toLowerCase().includes(t) ||
        v.motorista_nome?.toLowerCase().includes(t);
    });
  }, [todas, busca, filtroStatus]);

  const { paginatedItems, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(filtradas, 20);

  const avancar = useMutation({
    mutationFn: async ({ assinatura_data_url, ...payload }) => {
      const loc = await pegarLocalizacao();

      // Assinatura sobe como arquivo; se o upload falhar, o passo segue mesmo assim —
      // perder a rubrica é ruim, perder o registro da entrega é pior.
      let assinatura_url;
      if (assinatura_data_url) {
        try {
          const file = dataUrlParaArquivo(assinatura_data_url, `assinatura-${payload.viagem_id}.png`);
          const r = await base44.integrations.Core.UploadFile({ file });
          assinatura_url = r?.data?.file_url || r?.file_url || r?.url || undefined;
        } catch {
          assinatura_url = undefined;
        }
      }
      return base44.functions.invoke('avancarViagem', { ...payload, ...(loc || {}), assinatura_url });
    },
    onSuccess: (res) => {
      const d = res.data || {};
      if (d.success === false) { toast.error(d.error || 'Não foi possível atualizar a viagem.'); return; }
      qc.invalidateQueries({ queryKey: ['minhas-viagens'] });
      toast.success(
        d.status === 'FINALIZADA'
          ? `Viagem finalizada — ${fmtNum(d.km_percorrido)} km percorridos.`
          : 'Viagem atualizada.',
      );
      fechar();
    },
    // Mensagem do servidor quando houver — "Erro: Network Error" não ajuda quem está
    // na obra tentando entender por que a entrega não registrou.
    onError: (e) => {
      const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || 'falha ao registrar';
      toast.error('Não foi possível registrar o passo: ' + msg, { duration: 8000 });
    },
  });

  const abrir = (viagem) => {
    const passo = PROXIMO[viagem.status];
    if (!passo) return;
    setKm(''); setObservacao(''); setFotos([]); setAssinatura(''); setRecebedor('');
    setMostrarErros(false);
    setModal({ open: true, viagem, passo });
  };
  const fechar = () => setModal({ open: false, viagem: null, passo: null });

  const subirFotos = async (e) => {
    const arquivos = Array.from(e.target.files || []);
    if (!arquivos.length) return;
    setSubindo(true);
    try {
      for (const file of arquivos) {
        const r = await base44.integrations.Core.UploadFile({ file });
        const url = r?.data?.file_url || r?.file_url || r?.url;
        if (url) setFotos((f) => [...f, url]);
      }
    } catch (err) {
      toast.error('Erro ao enviar foto: ' + (err?.message || err));
    } finally {
      setSubindo(false);
      e.target.value = '';
    }
  };

  const ehChegada = modal.passo?.status === 'NO_DESTINO';
  // Viagem de volta entrega no pátio, não na obra — o rótulo precisa acompanhar.
  const ehVolta = String(modal.viagem?.sentido || '') === 'RETORNO';
  const ondeEntrega = ehVolta ? 'no pátio' : 'na obra';

  // Validação na própria tela: no celular, um toast no canto passa despercebido
  // enquanto o olho está no botão.
  const [mostrarErros, setMostrarErros] = useState(false);
  const pisoKm = Number(modal.viagem?.km_chegada) || Number(modal.viagem?.km_saida) || 0;
  const kmMenor = km !== '' && pisoKm > 0 && Number(km) < pisoKm;
  const erros = {
    km: km === ''
      ? 'Informe o hodômetro do painel.'
      : (kmMenor ? `Leitura menor que a última registrada (${fmtNum(pisoKm)} km).` : null),
    // Comprovante só é exigido na CHEGADA — é o momento em que a carga troca de mãos.
    comprovante: ehChegada && !fotos.length && !assinatura
      ? 'Registre a entrega: ao menos uma foto ou a assinatura de quem recebeu.'
      : null,
    recebedor: ehChegada && assinatura && !recebedor.trim()
      ? 'Informe o nome de quem assinou.'
      : null,
  };
  const faltando = Object.values(erros).filter(Boolean);
  const erro = (campo) => (mostrarErros ? erros[campo] : null);

  const confirmar = () => {
    if (faltando.length) {
      setMostrarErros(true);
      toast.error(`Faltam ${faltando.length} item(ns) para registrar este passo.`);
      return;
    }
    avancar.mutate({
      viagem_id: modal.viagem.id,
      status: modal.passo.status,
      km: km !== '' ? Number(km) : undefined,
      observacao: observacao || undefined,
      fotos: ehChegada ? fotos : undefined,
      assinatura_data_url: ehChegada ? (assinatura || undefined) : undefined,
      recebedor_nome: ehChegada ? (recebedor || undefined) : undefined,
    });
  };

  const emAndamento = (data?.abertas || []).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Viagens de Entrega"
        subtitle={data?.ve_tudo ? 'Acompanhamento de todas as entregas da frota' : 'Entregas de material sob sua responsabilidade'}
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="bg-white border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500">Em andamento</p>
          <p className="text-lg sm:text-2xl font-bold text-blue-600 mt-1 tabular-nums">{emAndamento}</p>
        </Card>
        <Card className="bg-white border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500">Concluídas</p>
          <p className="text-lg sm:text-2xl font-bold text-green-600 mt-1 tabular-nums">{(data?.encerradas || []).length}</p>
        </Card>
        <Card className="bg-white border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500">Total</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 tabular-nums">{todas.length}</p>
        </Card>
      </div>

      <FiltrosColapsaveis
        ativos={(busca ? 1 : 0) + (filtroStatus !== 'todos' ? 1 : 0)}
        onLimpar={() => { setBusca(''); setFiltroStatus('todos'); }}
        rodape={<span className="text-xs text-gray-500">{filtradas.length} viagem(ns)</span>}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input className="pl-9 h-11" placeholder="Número, destino, veículo ou motorista..."
                value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
            <ComboboxBusca
              options={[{ value: 'todos', label: 'Todos os status' },
                ...Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.label }))]}
              value={filtroStatus}
              onSelect={setFiltroStatus}
              placeholder="Todos os status"
            />
          </div>
        </div>
      </FiltrosColapsaveis>

      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={7} />
          ) : filtradas.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">Nenhuma viagem encontrada.</p>
            </div>
          ) : (
            <>
              {/* MOBILE — mesma informação da tabela, em cartão. O motorista trabalha
                  no celular, então os alvos de toque são grandes (h-11) e a ação
                  principal ocupa a linha inteira. */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {paginatedItems.map((v) => {
                  const st = STATUS[v.status] || STATUS.PLANEJADA;
                  const passo = PROXIMO[v.status];
                  const Icon = passo?.icon;
                  return (
                    <div key={v.id} className="p-3 rounded-lg border border-gray-200 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 break-words">{v.destino_nome}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{v.numero}</p>
                        </div>
                        <Badge className={`shrink-0 ${st.cls}`}>{st.label}</Badge>
                      </div>

                      {v.destino_endereco && (
                        <p className="text-xs text-gray-500 flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span className="break-words">{v.destino_endereco}</span>
                        </p>
                      )}

                      {/* As mesmas colunas do desktop, em pares rótulo/valor. */}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                        <div>
                          <p className="text-gray-400">Veículo</p>
                          <p className="text-gray-800 break-words">
                            {v.veiculo_nome}{v.veiculo_placa ? ` · ${v.veiculo_placa}` : ''}
                          </p>
                        </div>
                        {data?.ve_tudo && (
                          <div>
                            <p className="text-gray-400">Motorista</p>
                            <p className="text-gray-800 break-words">{v.motorista_nome || '—'}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-gray-400">Km</p>
                          <p className="text-gray-800 tabular-nums">{v.km_percorrido != null ? fmtNum(v.km_percorrido) : '—'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Entregue em</p>
                          <p className="text-gray-800">{v.chegou_em ? dth(v.chegou_em) : '—'}</p>
                        </div>
                        {v.itens_resumo?.length > 0 && (
                          <div className="col-span-2">
                            <p className="text-gray-400">Carga</p>
                            <p className="text-gray-800">{v.itens_resumo.length} item(ns)</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                        {passo && (
                          <Button className="h-11 w-full gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => abrir(v)}>
                            <Icon className="w-4 h-4" /> {passo.label}
                          </Button>
                        )}
                        <Button variant="outline" className="h-11 w-full gap-2 text-gray-700 border-gray-300" onClick={() => setDetalhe(v)}>
                          <Eye className="w-4 h-4" /> Ver detalhes
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Número</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Destino</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Veículo</th>
                      {data?.ve_tudo && <th className="text-left p-3 text-xs font-semibold text-gray-500">Motorista</th>}
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Status</th>
                      <th className="text-right p-3 text-xs font-semibold text-gray-500">Km</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Entregue em</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedItems.map((v) => {
                      const st = STATUS[v.status] || STATUS.PLANEJADA;
                      const passo = PROXIMO[v.status];
                      const Icon = passo?.icon;
                      return (
                        <tr key={v.id} className="hover:bg-gray-50">
                          <td className="p-3 font-medium text-gray-900 whitespace-nowrap">{v.numero}</td>
                          <td className="p-3 text-gray-700">
                            {v.destino_nome}
                            {v.itens_resumo?.length > 0 && (
                              <span className="text-gray-400"> · {v.itens_resumo.length} item(ns)</span>
                            )}
                          </td>
                          <td className="p-3 text-gray-600">
                            {v.veiculo_nome}
                            {v.veiculo_placa && <span className="text-gray-400"> · {v.veiculo_placa}</span>}
                          </td>
                          {data?.ve_tudo && <td className="p-3 text-gray-600">{v.motorista_nome || '—'}</td>}
                          <td className="p-3"><Badge className={st.cls}>{st.label}</Badge></td>
                          <td className="p-3 text-right tabular-nums text-gray-600">
                            {v.km_percorrido != null ? fmtNum(v.km_percorrido) : '—'}
                          </td>
                          <td className="p-3 text-gray-600 whitespace-nowrap">{v.chegou_em ? dth(v.chegou_em) : '—'}</td>
                          <td className="p-3">
                            <div className="flex gap-1 justify-end">
                              <Button variant="outline" size="sm" className="gap-1 text-gray-600 border-gray-300" onClick={() => setDetalhe(v)}>
                                <Eye className="w-3.5 h-3.5" /> Detalhes
                              </Button>
                              {passo && (
                                <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700" onClick={() => abrir(v)}>
                                  <Icon className="w-3.5 h-3.5" /> {passo.curto}
                                </Button>
                              )}
                            </div>
                          </td>
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

      {/* Modal do passo */}
      <Dialog open={modal.open} onOpenChange={(o) => !o && fechar()}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{modal.passo?.label}</DialogTitle>
            <p className="text-sm text-gray-500">{modal.viagem?.numero} · {modal.viagem?.destino_nome}</p>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Hodômetro (km)</Label>
              <Input type="number" placeholder="Leitura do painel" value={km} onChange={(e) => setKm(e.target.value)}
                className={erro('km') ? 'border-red-400 focus-visible:ring-red-400' : ''} />
              {erro('km') ? (
                <p className="text-xs text-red-600 mt-1 flex items-start gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{erro('km')}
                </p>
              ) : modal.viagem?.km_saida != null && (
                <p className="text-xs text-gray-400 mt-1">Saiu com {fmtNum(modal.viagem.km_saida)} km.</p>
              )}
            </div>

            {/* COMPROVANTE — obrigatório na chegada (pedido do cliente). */}
            {ehChegada && (
              <>
                <div>
                  <Label className="text-xs text-gray-600 mb-2 block">Fotos da entrega</Label>
                  <div className="flex flex-wrap gap-2">
                    {fotos.map((url, i) => (
                      <div key={url + i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                        <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                        <button type="button" className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white"
                          onClick={() => setFotos((f) => f.filter((_, j) => j !== i))}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {/* capture="environment": no celular abre a câmera traseira direto. */}
                    <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer text-gray-400 hover:border-blue-400 hover:text-blue-500">
                      {subindo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                      <span className="text-[10px] mt-1">{subindo ? 'Enviando' : 'Foto'}</span>
                      <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={subirFotos} disabled={subindo} />
                    </label>
                  </div>
                  {erro('comprovante') && (
                    <p className="text-xs text-red-600 mt-1.5 flex items-start gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{erro('comprovante')}
                    </p>
                  )}
                </div>

                <div className={`rounded-lg border p-3 space-y-3 ${erro('comprovante') ? 'border-red-300 bg-red-50/40' : 'border-gray-200 bg-gray-50'}`}>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Quem recebeu {ondeEntrega}</p>
                    <p className="text-xs text-gray-500">Vale como comprovante da entrega.</p>
                  </div>
                  <Input placeholder="Nome de quem recebeu" value={recebedor} onChange={(e) => setRecebedor(e.target.value)}
                    className={erro('recebedor') ? 'border-red-400 focus-visible:ring-red-400' : ''} />
                  {erro('recebedor') && (
                    <p className="text-xs text-red-600 -mt-1 flex items-start gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{erro('recebedor')}
                    </p>
                  )}
                  <AssinaturaCanvas onChange={setAssinatura} />
                </div>
              </>
            )}

            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Observações</Label>
              <Textarea rows={2} placeholder="Ocorrências no trajeto, atraso, avaria..."
                value={observacao} onChange={(e) => setObservacao(e.target.value)} />
            </div>

            <p className="text-xs text-gray-400 flex items-start gap-1">
              <Crosshair className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              A localização de onde você registrar este passo fica gravada na viagem. Se o
              aparelho não permitir, o passo é salvo do mesmo jeito.
            </p>
          </div>

          {/* Resumo do que falta, colado no botão — é onde o olho está na hora de salvar. */}
          {mostrarErros && faltando.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-medium text-red-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Falta preencher:
              </p>
              <ul className="mt-1 text-xs text-red-700 list-disc pl-5 space-y-0.5">
                {faltando.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto h-11" onClick={fechar}>Cancelar</Button>
            <Button className="w-full sm:w-auto h-11 bg-blue-600 hover:bg-blue-700 gap-2" onClick={confirmar} disabled={avancar.isPending || subindo}>
              <CheckCircle2 className="w-4 h-4" />
              {avancar.isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhes + linha do tempo */}
      <DetalheViagemModal
        viagem={detalhe}
        onClose={() => { setZoom(null); setDetalhe(null); }}
        zoom={zoom}
        setZoom={setZoom}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detalhe da viagem: dados + LINHA DO TEMPO de cada passo (hora, hodômetro,
// localização, quem registrou). Consultável durante e depois da viagem.
function DetalheViagemModal({ viagem, onClose, zoom, setZoom }) {
  if (!viagem) return null;
  const eventos = Array.isArray(viagem.eventos) ? viagem.eventos : [];
  const fotos = viagem.fotos_entrega || [];

  const Campo = ({ rotulo, valor }) => (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{rotulo}</p>
      <p className="text-sm text-gray-900 break-words">{valor || "—"}</p>
    </div>
  );

  return (
    <Dialog open={!!viagem} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="w-[95vw] max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6"
        // Visor de foto é portal no body: sem isto o Radix leria o clique como
        // "fora do modal" e fecharia o detalhe junto.
        onInteractOutside={(e) => { if (zoom != null) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (zoom != null) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" /> Viagem {viagem.numero}
          </DialogTitle>
          <p className="text-sm text-gray-500">{viagem.destino_nome}{viagem.destino_endereco ? ` · ${viagem.destino_endereco}` : ''}</p>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Campo rotulo="Status" valor={(STATUS[viagem.status] || {}).label} />
            <Campo rotulo="Veículo" valor={[viagem.veiculo_nome, viagem.veiculo_placa].filter(Boolean).join(' · ')} />
            <Campo rotulo="Motorista" valor={viagem.motorista_nome} />
            <Campo rotulo="Origem" valor={viagem.origem_nome} />
            <Campo rotulo="Hodômetro saída" valor={viagem.km_saida != null ? `${fmtNum(viagem.km_saida)} km` : '—'} />
            <Campo rotulo="Hodômetro chegada" valor={viagem.km_chegada != null ? `${fmtNum(viagem.km_chegada)} km` : '—'} />
            <Campo rotulo="Hodômetro retorno" valor={viagem.km_retorno != null ? `${fmtNum(viagem.km_retorno)} km` : '—'} />
            <Campo rotulo="Percurso total" valor={viagem.km_percorrido != null ? `${fmtNum(viagem.km_percorrido)} km` : '—'} />
            <Campo rotulo="Entregue em" valor={dthCompleto(viagem.chegou_em)} />
            <Campo rotulo="Recebeu" valor={viagem.recebedor_nome} />
          </div>

          {(viagem.itens_resumo || []).length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5 mb-1.5">
                <Package className="w-3.5 h-3.5" /> Carga
              </p>
              <div className="rounded-md bg-gray-50 border border-gray-200 p-2.5">
                <ul className="text-sm text-gray-700 space-y-0.5">
                  {viagem.itens_resumo.map((i, n) => (
                    <li key={n}>{fmtNum(i.quantidade)} {i.unidade} — {i.material_nome}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* LINHA DO TEMPO */}
          <div>
            <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5" /> Andamento da viagem
            </p>
            {eventos.length === 0 ? (
              <p className="text-sm text-gray-400">Sem passos registrados.</p>
            ) : (
              <ol className="relative border-l-2 border-gray-200 ml-2 space-y-4">
                {eventos.map((ev, i) => {
                  const st = STATUS[ev.status] || { label: ev.status, cls: 'bg-gray-100 text-gray-700' };
                  const ultimo = i === eventos.length - 1;
                  return (
                    <li key={i} className="ml-4">
                      <span className={`absolute -left-[7px] w-3 h-3 rounded-full border-2 border-white ${ultimo ? 'bg-blue-600' : 'bg-gray-300'}`} />
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={st.cls}>{st.label}</Badge>
                        <span className="text-xs text-gray-500">{dthCompleto(ev.em)}</span>
                      </div>
                      <div className="mt-1 text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-0.5">
                        {ev.km != null && (
                          <span className="flex items-center gap-1"><Gauge className="w-3.5 h-3.5 text-gray-400" />{fmtNum(ev.km)} km</span>
                        )}
                        {ev.por && (
                          <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-gray-400" />{ev.por}</span>
                        )}
                        {ev.latitude != null && ev.longitude != null && (
                          // Link para o mapa: confere se o "cheguei" saiu mesmo da obra.
                          <a
                            href={`https://www.google.com/maps?q=${ev.latitude},${ev.longitude}`}
                            target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:underline"
                            title={ev.precisao_gps ? `Precisão ~${ev.precisao_gps} m` : 'Ver no mapa'}
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            {ev.latitude.toFixed(5)}, {ev.longitude.toFixed(5)}
                            {ev.precisao_gps ? <span className="text-gray-400"> (±{ev.precisao_gps} m)</span> : null}
                          </a>
                        )}
                        {ev.latitude == null && (
                          // Viagem anterior à captura de localização, ou aparelho sem
                          // permissão/sinal — a distinção evita ler isso como falha.
                          <span className="text-gray-300" title={ev.reconstruido ? 'Passo reconstruído: esta viagem é anterior ao registro de localização.' : 'O aparelho não informou a localização neste passo.'}>
                            {ev.reconstruido ? 'sem localização (registro antigo)' : 'sem localização'}
                          </span>
                        )}
                      </div>
                      {ev.observacao && <p className="mt-1 text-xs text-gray-600 italic">“{ev.observacao}”</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {fotos.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5 mb-1.5">
                <Camera className="w-3.5 h-3.5" /> Fotos da entrega
              </p>
              <div className="flex flex-wrap gap-2">
                {fotos.map((url, i) => (
                  <button key={url + i} type="button" onClick={() => setZoom(i)}>
                    <img src={url} alt={`Entrega ${i + 1}`}
                      className="w-20 h-20 object-cover rounded border border-gray-200 hover:ring-2 hover:ring-blue-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {viagem.assinatura_url && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Assinatura de quem recebeu</p>
              <img src={viagem.assinatura_url} alt="Assinatura" className="h-16 object-contain" />
              <p className="text-sm text-gray-900">{viagem.recebedor_nome || '—'}</p>
            </div>
          )}
        </div>

        <Lightbox fotos={fotos} index={zoom} onClose={() => setZoom(null)} onIndex={setZoom}
          nomeBase={`entrega-${viagem.numero}`} />

        <DialogFooter>
          <Button variant="outline" className="w-full sm:w-auto h-11" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

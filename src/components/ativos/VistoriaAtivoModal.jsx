import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Camera, Loader2, X, Check, AlertTriangle, Eraser, Truck as TruckIcon } from 'lucide-react';
import { toast } from 'sonner';

// VISTORIA DO ATIVO — a prova de como o veículo/máquina saiu e como voltou.
// É o mesmo princípio do recebimento de material: quem entrega e quem recebe
// registram medidor, estado item a item e fotos. Sem isso não dá para discutir
// avaria depois. A assinatura fecha o comprovante do empréstimo (a O.S.).

// Checklist por tipo de ativo (espelha CHECKLIST_PADRAO do backend).
const CHECKLIST = {
  veiculo: ['Lataria / pintura', 'Pneus e estepe', 'Faróis e lanternas', 'Vidros e retrovisores', 'Interior / bancos', 'Documentos', 'Ferramentas / macaco', 'Nível de combustível'],
  maquina: ['Estrutura / lataria', 'Esteiras ou pneus', 'Implementos / caçamba', 'Vazamentos (óleo/hidráulico)', 'Faróis e sinalização', 'Nível de combustível', 'Horímetro legível'],
};
// Veículo tem placa/documento; o resto do pátio (máquina, equipamento) usa o outro checklist.
const checklistDe = (tipo) => (String(tipo || '').toLowerCase() === 'veiculo' ? CHECKLIST.veiculo : CHECKLIST.maquina);

const unidade = (medidor_tipo) => (medidor_tipo === 'km' ? 'km' : 'h');

// dataURL do canvas -> File, para subir como imagem de verdade (não incha o JSONB).
function dataUrlParaArquivo(dataUrl, nome) {
  const [meta, b64] = dataUrl.split(',');
  const mime = /:(.*?);/.exec(meta)?.[1] || 'image/png';
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new File([buf], nome, { type: mime });
}

// --- Prancheta de assinatura (dedo no celular, mouse no desktop) ---
function Assinatura({ onChange }) {
  const ref = useRef(null);
  const desenhando = useRef(false);
  const [assinou, setAssinou] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#111827';
  }, []);

  const ponto = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };
  const iniciar = (e) => {
    const ctx = ref.current.getContext('2d');
    const { x, y } = ponto(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    desenhando.current = true;
    setAssinou(true);
  };
  const mover = (e) => {
    if (!desenhando.current) return;
    e.preventDefault();
    const ctx = ref.current.getContext('2d');
    const { x, y } = ponto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const parar = () => {
    if (!desenhando.current) return;
    desenhando.current = false;
    onChange(ref.current.toDataURL('image/png'));
  };
  const limpar = () => {
    const canvas = ref.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setAssinou(false);
    onChange('');
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <canvas
          ref={ref}
          onMouseDown={iniciar} onMouseMove={mover} onMouseUp={parar} onMouseLeave={parar}
          onTouchStart={iniciar} onTouchMove={mover} onTouchEnd={parar}
          className="w-full h-36 border-2 border-dashed border-gray-300 rounded-lg bg-white cursor-crosshair"
          style={{ touchAction: 'none' }}
        />
        {!assinou && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-sm">Assine com o dedo ou com o mouse</p>
          </div>
        )}
      </div>
      {assinou && (
        <Button type="button" variant="outline" size="sm" className="gap-2 text-gray-600" onClick={limpar}>
          <Eraser className="w-3.5 h-3.5" /> Limpar assinatura
        </Button>
      )}
    </div>
  );
}

/**
 * @param tipo 'SAIDA' (entrega à obra) | 'ENTRADA' (devolução à Matriz)
 * @param onConcluido chamado depois que a vistoria foi gravada — quem chama segue
 *        para a liberação (que emite a O.S.) ou para a devolução.
 */
export default function VistoriaAtivoModal({ open, emprestimo, tipo = 'SAIDA', onClose, onConcluido }) {
  const ehSaida = tipo === 'SAIDA';
  const itensPadrao = useMemo(() => checklistDe(emprestimo?.ativo_tipo), [emprestimo?.ativo_tipo]);

  const [medidor, setMedidor] = useState('');
  const [estados, setEstados] = useState({});      // { item: { estado, observacao } }
  const [fotos, setFotos] = useState([]);
  const [observacao, setObservacao] = useState('');
  const [assinatura, setAssinatura] = useState('');
  const [assinanteNome, setAssinanteNome] = useState('');
  const [assinanteDoc, setAssinanteDoc] = useState('');
  const [subindo, setSubindo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // O medidor tem de vir do CADASTRO do ativo (fonte da verdade), não do empréstimo:
  // o do empréstimo é a leitura da saída e envelhece assim que a máquina trabalha.
  const { data: ativos = [] } = useQuery({
    queryKey: ['ativos'],
    queryFn: () => base44.entities.Ativo.list('-created_date', 500).catch(() => []),
    enabled: open,
  });
  const ativo = ativos.find((a) => a.id === emprestimo?.ativo_id);
  const ehKm = emprestimo?.medidor_tipo === 'km';
  // Piso da leitura: na saída, o medidor do ativo; na devolução, o da saída.
  const piso = ehSaida
    ? Number(ehKm ? ativo?.km_atual : ativo?.horimetro_atual) || 0
    : Number(emprestimo?.medidor_saida) || 0;
  const medidorMenor = medidor !== '' && piso > 0 && Number(medidor) < piso;

  // O que ainda impede o registro. Vira lista na tela e marca cada campo em falta.
  const [mostrarErros, setMostrarErros] = useState(false);
  const erros = {
    medidor: medidor === ''
      ? `Informe o ${ehKm ? 'hodômetro' : 'horímetro'} conferido no painel.`
      : (medidorMenor ? `Leitura menor que a ${ehSaida ? 'atual do ativo' : 'da saída'} (${piso}).` : null),
    fotos: !fotos.length ? 'Anexe ao menos uma foto do ativo.' : null,
    assinante: !assinanteNome.trim()
      ? (ehSaida ? 'Informe quem está recebendo o ativo.' : 'Informe quem está devolvendo o ativo.')
      : null,
    assinatura: !assinatura ? 'Colha a assinatura — é o comprovante do empréstimo.' : null,
  };
  const faltando = Object.values(erros).filter(Boolean);

  // --- Transporte (opcional) — veículo vai dirigindo, máquina precisa de carona ---
  const precisaCarona = !/veiculo/.test(String(emprestimo?.ativo_tipo || ''));
  const [transpVeiculo, setTranspVeiculo] = useState('');
  const [transpMotorista, setTranspMotorista] = useState('');

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list('-created_date', 1000).catch(() => []),
    enabled: open && precisaCarona,
  });
  const veiculoOptions = useMemo(
    () => ativos
      .filter((a) => /veiculo/.test(String(a.tipo || '')) && a.status === 'disponivel' && a.id !== emprestimo?.ativo_id)
      .map((a) => ({ value: a.id, label: `${a.nome || a.codigo}${a.placa ? ` — ${a.placa}` : ''}` })),
    [ativos, emprestimo?.ativo_id],
  );
  const motoristaOptions = useMemo(() => {
    const at = colaboradores.filter((c) => (c.status || 'ativo') === 'ativo');
    const mots = at.filter((c) => /motorista|condutor/i.test(`${c.cargo || ''} ${c.funcao || ''}`));
    return (mots.length ? mots : at).map((c) => ({ value: c.id, label: c.nome }));
  }, [colaboradores]);
  // Só marca de vermelho depois da primeira tentativa: formulário que já abre
  // acusando erro passa a sensação de que algo quebrou.
  const erro = (campo) => (mostrarErros ? erros[campo] : null);

  useEffect(() => {
    if (!open) return;
    // Leitura sempre em branco: quem vistoria confere no painel.
    setMedidor('');   // leitura é conferida no painel — nunca herdada de outro registro
    setEstados({});
    setFotos([]);
    setObservacao('');
    setAssinatura('');
    setAssinanteNome('');
    setAssinanteDoc("");
    setMostrarErros(false);
    setTranspVeiculo(''); setTranspMotorista('');
  }, [open, ehSaida, emprestimo?.id, emprestimo?.medidor_saida]);

  const marcar = (item, estado) =>
    setEstados((s) => ({ ...s, [item]: { ...(s[item] || {}), estado } }));
  const obsItem = (item, texto) =>
    setEstados((s) => ({ ...s, [item]: { ...(s[item] || {}), observacao: texto } }));

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

  const salvar = async () => {
    // Mostra TUDO o que falta de uma vez, na própria tela. Antes era só um toast por
    // vez: num modal alto e rolado, o aviso aparecia fora do campo de visão e o
    // usuário ficava clicando em "Registrar" sem entender por que nada acontecia.
    if (faltando.length) {
      setMostrarErros(true);
      toast.error(`Faltam ${faltando.length} item(ns) para registrar a vistoria.`);
      return;
    }

    setSalvando(true);
    try {
      // Assinatura vira arquivo (não fica como base64 gigante dentro do registro).
      let assinaturaUrl = null;
      try {
        const file = dataUrlParaArquivo(assinatura, `assinatura-${emprestimo.numero || emprestimo.id}-${tipo}.png`);
        const r = await base44.integrations.Core.UploadFile({ file });
        assinaturaUrl = r?.data?.file_url || r?.file_url || r?.url || null;
      } catch {
        assinaturaUrl = null; // não trava a vistoria por causa do upload da rubrica
      }

      const itens = itensPadrao.map((item) => ({
        item,
        estado: estados[item]?.estado || 'ok',
        observacao: estados[item]?.observacao || '',
      }));

      const res = await base44.functions.invoke('registrarVistoriaAtivo', {
        emprestimo_id: emprestimo.id,
        tipo,
        medidor: Number(medidor),
        itens,
        fotos,
        observacao: observacao || undefined,
        assinatura_url: assinaturaUrl,
        assinante_nome: assinanteNome.trim(),
        assinante_documento: assinanteDoc.trim() || undefined,
      });
      if (res.data?.success === false) {
        toast.error(res.data.error || 'Erro ao registrar vistoria.');
        return;
      }
      // Devolve também o transporte escolhido: quem chama cria a viagem depois de
      // liberar/devolver, quando o empréstimo já está no estado que o backend exige.
      onConcluido?.({
        ...res.data,
        medidor: Number(medidor),
        transporte: (transpVeiculo && transpMotorista)
          ? { veiculo_id: transpVeiculo, motorista_id: transpMotorista }
          : null,
      });
    } catch (err) {
      toast.error('Erro ao registrar vistoria: ' + (err?.message || err));
    } finally {
      setSalvando(false);
    }
  };

  if (!emprestimo) return null;
  const avarias = itensPadrao.filter((i) => estados[i]?.estado === 'avaria').length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {ehSaida ? 'Vistoria de saída' : 'Vistoria de devolução'} — {emprestimo.ativo_nome}
          </DialogTitle>
          <p className="text-sm text-gray-500">
            {emprestimo.numero} · {emprestimo.obra_nome}
            {ehSaida
              ? ' — confira o ativo antes de liberá-lo para a obra.'
              : ' — confira o ativo na volta ao pátio.'}
          </p>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Medidor */}
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">
              {emprestimo.medidor_tipo === 'km' ? 'Hodômetro' : 'Horímetro'} ({unidade(emprestimo.medidor_tipo)})
            </Label>
            <Input
              type="number"
              placeholder="Leitura conferida no painel"
              value={medidor}
              onChange={(e) => setMedidor(e.target.value)}
              className={medidorMenor || erro('medidor') ? 'border-red-400 focus-visible:ring-red-400' : ''}
            />
            {erro('medidor') && !medidorMenor ? (
              <p className="text-xs text-red-600 mt-1 flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{erro('medidor')}
              </p>
            ) : medidorMenor ? (
              <p className="text-xs text-red-600 mt-1 flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                Menor que a leitura {ehSaida ? 'atual do ativo' : 'da saída'} ({piso} {unidade(emprestimo.medidor_tipo)}). Confira o painel.
              </p>
            ) : piso > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                {ehSaida ? 'Atual do ativo' : 'Saiu com'}: {piso} {unidade(emprestimo.medidor_tipo)}.
              </p>
            )}
          </div>

          {/* Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-gray-600">Estado do ativo</Label>
              {avarias > 0 && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {avarias} avaria(s)
                </span>
              )}
            </div>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              {itensPadrao.map((item) => {
                const st = estados[item]?.estado || 'ok';
                return (
                  <div key={item} className="p-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-gray-700">{item}</span>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          type="button" size="sm" variant="outline"
                          className={`h-7 px-2 gap-1 ${st === 'ok' ? 'bg-green-50 border-green-300 text-green-700' : 'text-gray-500'}`}
                          onClick={() => marcar(item, 'ok')}
                        >
                          <Check className="w-3.5 h-3.5" /> OK
                        </Button>
                        <Button
                          type="button" size="sm" variant="outline"
                          className={`h-7 px-2 gap-1 ${st === 'avaria' ? 'bg-amber-50 border-amber-300 text-amber-700' : 'text-gray-500'}`}
                          onClick={() => marcar(item, 'avaria')}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" /> Avaria
                        </Button>
                      </div>
                    </div>
                    {st === 'avaria' && (
                      <Input
                        className="h-8 text-sm"
                        placeholder="Descreva a avaria..."
                        value={estados[item]?.observacao || ''}
                        onChange={(e) => obsItem(item, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fotos */}
          <div>
            <Label className="text-xs text-gray-600 mb-2 block">Fotos do ativo *</Label>
            <div className="flex flex-wrap gap-2">
              {fotos.map((url, i) => (
                <div key={url + i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                  <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white"
                    onClick={() => setFotos((f) => f.filter((_, j) => j !== i))}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer text-gray-400 hover:border-blue-400 hover:text-blue-500">
                {subindo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                <span className="text-[10px] mt-1">{subindo ? 'Enviando' : 'Foto'}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={subirFotos} disabled={subindo} />
              </label>
            </div>
            {erro("fotos") && (
              <p className="text-xs text-red-600 mt-1.5 flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{erro("fotos")}
              </p>
            )}
          </div>

          {/* Observação */}
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Observações</Label>
            <Textarea
              rows={2}
              placeholder="Combustível, acessórios entregues, pendências..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          {/* Assinatura */}
          <div className="rounded-lg border border-gray-200 p-3 space-y-3 bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-800">
                {ehSaida ? 'Responsável que recebe o ativo' : 'Responsável que devolve o ativo'}
              </p>
              <p className="text-xs text-gray-500">Vale como comprovante do empréstimo na O.S.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Nome</Label>
                <Input placeholder="Nome completo" value={assinanteNome} onChange={(e) => setAssinanteNome(e.target.value)}
                  className={erro("assinante") ? "border-red-400 focus-visible:ring-red-400" : ""} />
                {erro("assinante") && <p className="text-xs text-red-600 mt-1">{erro("assinante")}</p>}
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">CPF / documento (opcional)</Label>
                <Input mask="cpf" placeholder="000.000.000-00" value={assinanteDoc} onChange={(e) => setAssinanteDoc(e.target.value)} />
              </div>
            </div>
            <Assinatura onChange={setAssinatura} />
            {erro("assinatura") && (
              <p className="text-xs text-red-600 flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{erro("assinatura")}
              </p>
            )}
          </div>

          {/* TRANSPORTE — a viagem nasce no mesmo ato da vistoria: é o momento em que
              alguém está de fato na frente da máquina decidindo quem a leva.
              Opcional: máquina pequena pode ir na carroceria de quem já vai à obra.
              Só aparece para o que precisa de carona (veículo vai dirigindo). */}
          {precisaCarona && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                  <TruckIcon className="w-4 h-4 text-indigo-600" />
                  {ehSaida ? 'Transporte até a obra' : 'Transporte de volta ao pátio'}
                  <span className="text-xs font-normal text-gray-500">(opcional)</span>
                </p>
                <p className="text-xs text-gray-500">
                  Informe quem leva para gerar a viagem — o motorista acompanha em Viagens de Entrega.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Veículo transportador</Label>
                  <ComboboxBusca
                    options={veiculoOptions} value={transpVeiculo} onSelect={setTranspVeiculo}
                    placeholder="Sem transporte" searchPlaceholder="Buscar veículo..."
                    emptyMessage="Nenhum veículo disponível"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Motorista</Label>
                  <ComboboxBusca
                    options={motoristaOptions} value={transpMotorista} onSelect={setTranspMotorista}
                    placeholder="Sem motorista" searchPlaceholder="Buscar motorista..."
                    emptyMessage="Nenhum colaborador"
                  />
                </div>
              </div>
              {(!!transpVeiculo !== !!transpMotorista) && (
                <p className="text-xs text-amber-600 flex items-start gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Informe os dois (veículo e motorista) para a viagem ser criada.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Resumo do que falta, colado no botão — é onde o olho está na hora de salvar. */}
        {mostrarErros && faltando.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-medium text-red-800 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Falta preencher para registrar:
            </p>
            <ul className="mt-1 text-xs text-red-700 list-disc pl-5 space-y-0.5">
              {faltando.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={salvar} disabled={salvando || subindo}>
            {salvando ? 'Salvando...' : ehSaida ? 'Registrar vistoria e liberar' : 'Registrar vistoria e devolver'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

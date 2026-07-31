import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { TableSkeleton } from '@/components/shared/Skeletons';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { Textarea } from '@/components/ui/textarea';
import { Activity, Plus, RefreshCw, Pencil, ExternalLink, Server, Lock, Unlock, Users, HardHat } from 'lucide-react';
import { toast } from 'sonner';
import {
  CabecalhoPagina, CardNumero, GradeNumeros, Etiqueta, Painel, Vazio,
  TabelaCabecalho, desde,
} from '@/components/painel/ui';

// INTEGRAÇÕES DOS CLIENTES — a instância de cada cliente está no ar?
//
// Cada cliente roda a própria instalação do Construlog (URL própria). Aqui se
// cadastra onde ela vive e se testa a saúde batendo no /health — o teste roda no
// backend (função testarInstanciaCliente), porque o navegador não alcança outro
// domínio e não deve conhecer as chaves.
//
// Cadastro e status; a configuração de chaves fica em Sistema › Integrações & API.
//
// Além do teste manual, cada instalação manda um heartbeat a cada 30s e pergunta
// se pode continuar operando. A resposta sai daqui: o campo "bloqueado" é a chave
// de desligar manual e tem prioridade sobre a checagem de pagamento. É uma ação
// séria — derruba o sistema do cliente — então exige confirmação e motivo.

const STATUS = {
  online: { rotulo: 'No ar', tom: 'positivo' },
  instavel: { rotulo: 'Instável', tom: 'alerta' },
  offline: { rotulo: 'Fora do ar', tom: 'negativo' },
  nao_testado: { rotulo: 'Nunca testado', tom: 'neutro' },
};

const AMBIENTES = [
  { value: 'producao', label: 'Produção' },
  { value: 'homologacao', label: 'Homologação' },
];

const VAZIO = { cliente_id: '', nome: '', url: '', ambiente: 'producao', versao: '', observacoes: '' };

export default function PainelIntegracoesClientes() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [errors, setErrors] = useState({});
  const [testandoId, setTestandoId] = useState(null);
  const [bloqueio, setBloqueio] = useState(null); // instância em confirmação
  const [motivoBloqueio, setMotivoBloqueio] = useState('');

  const { data: instancias = [], isLoading } = useQuery({
    queryKey: ['instancias-cliente'],
    queryFn: () => base44.entities.InstanciaCliente.list('-created_date', 500).catch(() => []),
  });
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-saas'],
    queryFn: () => base44.entities.ClienteSaaS.list('nome', 500).catch(() => []),
  });

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: null } : e));
  };

  const abrirNova = () => { setEditando(null); setForm(VAZIO); setErrors({}); setModal(true); };
  const abrirEditar = (i) => { setEditando(i); setForm({ ...VAZIO, ...i }); setErrors({}); setModal(true); };

  const salvar = useMutation({
    mutationFn: (d) => (editando
      ? base44.entities.InstanciaCliente.update(editando.id, d)
      : base44.entities.InstanciaCliente.create({ ...d, status: 'nao_testado' })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instancias-cliente'] });
      toast.success(editando ? 'Instância atualizada!' : 'Instância cadastrada!');
      setModal(false);
    },
    onError: (e) => toast.error('Erro: ' + (e?.message || 'tente novamente')),
  });

  const testar = useMutation({
    mutationFn: (id) => base44.functions.invoke('testarInstanciaCliente', { instancia_id: id }),
    onMutate: (id) => setTestandoId(id),
    onSuccess: (res) => {
      const d = res?.data || res;
      qc.invalidateQueries({ queryKey: ['instancias-cliente'] });
      qc.invalidateQueries({ queryKey: ['logs-integracao'] });
      if (d?.status === 'online') toast.success(`No ar — respondeu em ${d.tempo_ms} ms`);
      else if (d?.status === 'instavel') toast.warning(`Respondeu com erro: ${d.erro}`);
      else toast.error(`Fora do ar: ${d?.erro || 'sem resposta'}`);
    },
    onError: (e) => toast.error('Falha ao testar: ' + (e?.message || 'tente novamente')),
    onSettled: () => setTestandoId(null),
  });

  // Chave de desligar. O efeito não é imediato: vale no próximo heartbeat da
  // instalação (até 30s), e é isso que a mensagem de sucesso avisa.
  const alternarBloqueio = useMutation({
    mutationFn: ({ instancia, bloquear, motivo }) => base44.entities.InstanciaCliente.update(instancia.id, {
      bloqueado: bloquear,
      motivo_bloqueio: bloquear ? (motivo || '').trim() : null,
      bloqueado_em: bloquear ? new Date().toISOString() : null,
    }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['instancias-cliente'] });
      toast.success(v.bloquear
        ? 'Instância bloqueada — o sistema do cliente para no próximo heartbeat (até 30s).'
        : 'Instância liberada — o acesso volta no próximo heartbeat (até 30s).');
      setBloqueio(null);
    },
    onError: (e) => toast.error('Erro: ' + (e?.message || 'tente novamente')),
  });

  const abrirBloqueio = (i) => { setBloqueio(i); setMotivoBloqueio(i.motivo_bloqueio || ''); };

  const validar = () => {
    const e = {};
    if (!form.cliente_id) e.cliente_id = 'Selecione o cliente';
    if (!form.nome.trim()) e.nome = 'Dê um nome para identificar a instância';

    const url = form.url.trim();
    if (!url) e.url = 'Informe a URL da instância';
    else if (!/^https?:\/\/.+/i.test(url)) e.url = 'A URL precisa começar com http:// ou https://';
    else {
      // URL repetida = dois cadastros testando o mesmo servidor.
      const norm = (u) => String(u || '').replace(/\/+$/, '').toLowerCase();
      const dup = instancias.some((i) => i.id !== editando?.id && norm(i.url) === norm(url));
      if (dup) e.url = 'Já existe uma instância com esta URL';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = () => {
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    const cli = clientes.find((c) => c.id === form.cliente_id);
    salvar.mutate({
      ...form,
      url: form.url.trim().replace(/\/+$/, ''),
      cliente_nome: cli?.nome || '',
    });
  };

  // O `status` gravado pode estar velho: entre a queda e a próxima varredura do
  // monitor, o banco ainda diz "online". Aqui a tela decide pela IDADE do último
  // sinal, que é a verdade disponível na hora — assim ela nunca mostra verde
  // para quem parou de reportar há dez minutos.
  const MIN_SILENCIO = 5;
  const minutosSemSinal = (i) => {
    const t = new Date(i.ultimo_heartbeat || i.ultimo_teste || 0).getTime();
    return t ? (Date.now() - t) / 60000 : Infinity;
  };
  const estadoReal = (i) => {
    if (!i.ultimo_heartbeat && !i.ultimo_teste) return 'nao_testado';
    if (minutosSemSinal(i) > MIN_SILENCIO) return 'offline';
    return i.status === 'instavel' ? 'instavel' : 'online';
  };

  const totais = useMemo(() => ({
    total: instancias.length,
    online: instancias.filter((i) => estadoReal(i) === 'online').length,
    problema: instancias.filter((i) => ['offline', 'instavel'].includes(estadoReal(i))).length,
    semTeste: instancias.filter((i) => !i.ultimo_teste).length,
    bloqueadas: instancias.filter((i) => i.bloqueado === true).length,
  }), [instancias]);

  const pag = usePagination(instancias, 10);

  return (
    <div className="space-y-6 pb-6">
      <CabecalhoPagina subtitulo="A instalação de cada cliente está funcionando?">
        <Button onClick={abrirNova} className="gap-2 bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Nova instância
        </Button>
      </CabecalhoPagina>

      <GradeNumeros>
        <CardNumero rotulo="Instâncias" valor={totais.total} icone={Server} />
        <CardNumero rotulo="No ar" valor={totais.online} tom="positivo" icone={Activity} />
        <CardNumero rotulo="Com problema" valor={totais.problema} tom={totais.problema ? 'negativo' : 'neutro'} />
        <CardNumero
          rotulo="Bloqueadas"
          valor={totais.bloqueadas}
          tom={totais.bloqueadas ? 'negativo' : 'neutro'}
          detalhe="acesso suspenso manualmente"
        />
      </GradeNumeros>

      <Painel semPadding>
        {isLoading ? (
          <div className="p-4"><TableSkeleton rows={4} /></div>
        ) : instancias.length === 0 ? (
          <Vazio
            icone={Server}
            titulo="Nenhuma instância cadastrada"
            descricao="Cadastre onde roda a instalação de cada cliente para acompanhar se está no ar."
            acao="Cadastrar instância"
            onAcao={abrirNova}
          />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <TabelaCabecalho colunas={[
                  { titulo: 'Instância' },
                  { titulo: 'Cliente' },
                  { titulo: 'Ambiente' },
                  { titulo: 'Status' },
                  { titulo: 'Em uso agora' },
                  { titulo: 'Acesso' },
                  { titulo: 'Último sinal' },
                  { titulo: '', largura: 'w-52' },
                ]} />
                <tbody className="divide-y divide-gray-100">
                  {pag.paginatedItems.map((i) => {
                    const s = STATUS[estadoReal(i)] || STATUS.nao_testado;
                    return (
                      <tr key={i.id} className="hover:bg-gray-50">
                        <td className="p-3">
                          <p className="font-medium text-gray-900">{i.nome}</p>
                          <a
                            href={i.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                          >
                            {i.url} <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                        <td className="p-3 text-gray-600">{i.cliente_nome || '—'}</td>
                        <td className="p-3 text-gray-600">
                          {AMBIENTES.find((a) => a.value === i.ambiente)?.label || '—'}
                          {i.versao && <span className="block text-xs text-gray-400">v{i.versao}</span>}
                        </td>
                        <td className="p-3">
                          <Etiqueta tom={s.tom}>{s.rotulo}</Etiqueta>
                          {i.ultimo_erro && i.status !== 'online' && (
                            <p className="text-xs text-red-500 mt-1 max-w-[180px] truncate" title={i.ultimo_erro}>
                              {i.ultimo_erro}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-gray-600">
                          {i.metricas ? (
                            <div className="space-y-0.5 text-xs">
                              <p className="flex items-center gap-1.5 text-gray-700">
                                <Users className="w-3.5 h-3.5 text-gray-400" />
                                <span className="tabular-nums">{i.metricas.usuarios_online ?? 0}</span> online
                                <span className="text-gray-400">de {i.metricas.usuarios_total ?? 0}</span>
                              </p>
                              <p className="flex items-center gap-1.5 text-gray-700">
                                <HardHat className="w-3.5 h-3.5 text-gray-400" />
                                <span className="tabular-nums">{i.metricas.obras_ativas ?? 0}</span> obra(s) ativa(s)
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">sem heartbeat</span>
                          )}
                        </td>
                        <td className="p-3">
                          {i.bloqueado
                            ? <Etiqueta tom="negativo">Bloqueado</Etiqueta>
                            : <Etiqueta tom="positivo">Liberado</Etiqueta>}
                          {i.bloqueado && i.motivo_bloqueio && (
                            <p className="text-xs text-gray-400 mt-1 max-w-[160px] truncate" title={i.motivo_bloqueio}>
                              {i.motivo_bloqueio}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-gray-500">
                          {desde(i.ultimo_heartbeat || i.ultimo_teste)}
                          {i.ultimo_tempo_ms != null && i.status === 'online' && (
                            <span className="block text-xs text-gray-400">{i.ultimo_tempo_ms} ms</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm" variant="outline"
                              onClick={() => testar.mutate(i.id)}
                              disabled={testandoId === i.id}
                              className="gap-1 border-gray-300 text-gray-700"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${testandoId === i.id ? 'animate-spin' : ''}`} />
                              {testandoId === i.id ? 'Testando' : 'Testar'}
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => abrirBloqueio(i)}
                              title={i.bloqueado ? 'Liberar acesso' : 'Bloquear acesso'}
                            >
                              {i.bloqueado
                                ? <Unlock className="w-4 h-4 text-emerald-600" />
                                : <Lock className="w-4 h-4 text-gray-500" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => abrirEditar(i)} title="Editar">
                              <Pencil className="w-4 h-4 text-gray-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-gray-100">
              {pag.paginatedItems.map((i) => {
                const s = STATUS[estadoReal(i)] || STATUS.nao_testado;
                return (
                  <div key={i.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 break-words">{i.nome}</p>
                        <p className="text-xs text-gray-400 break-all">{i.url}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Etiqueta tom={s.tom}>{s.rotulo}</Etiqueta>
                        {i.bloqueado && <Etiqueta tom="negativo">Bloqueado</Etiqueta>}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      {i.cliente_nome || '—'} · sinal {desde(i.ultimo_heartbeat || i.ultimo_teste)}
                    </p>
                    {i.metricas && (
                      <p className="text-xs text-gray-500">
                        {i.metricas.usuarios_online ?? 0} usuário(s) online · {i.metricas.obras_ativas ?? 0} obra(s) ativa(s)
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm" variant="outline"
                        onClick={() => testar.mutate(i.id)}
                        disabled={testandoId === i.id}
                        className="flex-1 gap-1 border-gray-300 text-gray-700"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${testandoId === i.id ? 'animate-spin' : ''}`} />
                        Testar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => abrirEditar(i)} className="border-gray-300 text-gray-700">
                        Editar
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => abrirBloqueio(i)}
                        className={i.bloqueado ? 'border-emerald-300 text-emerald-700' : 'border-gray-300 text-gray-700'}
                      >
                        {i.bloqueado ? 'Liberar' : 'Bloquear'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination
              currentPage={pag.currentPage} totalPages={pag.totalPages} onPageChange={pag.goToPage}
              startIndex={pag.startIndex} endIndex={pag.endIndex} totalItems={pag.totalItems}
            />
          </>
        )}
      </Painel>

      <Dialog open={modal} onOpenChange={(o) => { if (!o) setModal(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar instância' : 'Nova instância'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-600">Cliente *</Label>
              <div className="mt-1">
                <ComboboxBusca
                  options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
                  value={form.cliente_id}
                  onSelect={(v) => set('cliente_id', v)}
                  placeholder="Selecione o cliente"
                  searchPlaceholder="Buscar cliente..."
                  emptyMessage="Nenhum cliente cadastrado."
                  className={errors.cliente_id ? 'border-red-400' : ''}
                />
              </div>
              {errors.cliente_id && <p className="text-xs text-red-500 mt-1">{errors.cliente_id}</p>}
            </div>

            <div>
              <Label className="text-xs text-gray-600">Nome da instância *</Label>
              <Input
                className={`h-11 mt-1 ${errors.nome ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                value={form.nome} onChange={(e) => set('nome', e.target.value)}
                placeholder="Ex: Alvorada — produção"
              />
              {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}
            </div>

            <div>
              <Label className="text-xs text-gray-600">URL *</Label>
              <Input
                className={`h-11 mt-1 ${errors.url ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                value={form.url} onChange={(e) => set('url', e.target.value)}
                placeholder="https://cliente.construlog.com.br"
              />
              {errors.url
                ? <p className="text-xs text-red-500 mt-1">{errors.url}</p>
                : <p className="text-[11px] text-gray-400 mt-1">O teste consulta {'{URL}'}/api/health.</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-600">Ambiente</Label>
                <Select value={form.ambiente} onValueChange={(v) => set('ambiente', v)}>
                  <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AMBIENTES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Versão</Label>
                <Input className="h-11 mt-1" value={form.versao} onChange={(e) => set('versao', e.target.value)} placeholder="Ex: 1.4.0" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)} className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvar.isPending} className="bg-blue-600 hover:bg-blue-700">
              {salvar.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bloquear/liberar — confirmação separada porque o efeito é derrubar (ou
          devolver) o sistema de um cliente em produção. */}
      <Dialog open={!!bloqueio} onOpenChange={(o) => { if (!o) setBloqueio(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {bloqueio?.bloqueado ? 'Liberar acesso' : 'Bloquear acesso'}
            </DialogTitle>
          </DialogHeader>

          {bloqueio && (bloqueio.bloqueado ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                A instância <strong className="text-gray-900">{bloqueio.nome}</strong> volta a funcionar
                normalmente no próximo heartbeat (até 30 segundos).
              </p>
              {bloqueio.motivo_bloqueio && (
                <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                  <p className="text-xs text-gray-400">Motivo do bloqueio atual</p>
                  <p className="text-sm text-gray-700">{bloqueio.motivo_bloqueio}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
                <p className="text-sm text-red-700">
                  O sistema de <strong>{bloqueio.cliente_nome || bloqueio.nome}</strong> vai parar de funcionar.
                  {bloqueio.metricas?.usuarios_online
                    ? ` Há ${bloqueio.metricas.usuarios_online} usuário(s) trabalhando agora.`
                    : ''}
                </p>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Motivo (aparece para o cliente)</Label>
                <Textarea
                  className="mt-1"
                  rows={3}
                  value={motivoBloqueio}
                  onChange={(e) => setMotivoBloqueio(e.target.value)}
                  placeholder="Ex: Mensalidade em aberto. Fale com o financeiro para liberar."
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Em branco, o cliente vê a mensagem padrão de acesso suspenso.
                </p>
              </div>
            </div>
          ))}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBloqueio(null)} className="border-gray-300 text-gray-700">
              Cancelar
            </Button>
            <Button
              onClick={() => alternarBloqueio.mutate({
                instancia: bloqueio,
                bloquear: !bloqueio.bloqueado,
                motivo: motivoBloqueio,
              })}
              disabled={alternarBloqueio.isPending}
              className={bloqueio?.bloqueado ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {alternarBloqueio.isPending
                ? 'Salvando...'
                : bloqueio?.bloqueado ? 'Liberar acesso' : 'Bloquear acesso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

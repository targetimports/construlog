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
import { Plug, Plus, Copy, Ban, Check, KeyRound, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { confirmar } from '@/lib/confirmar';
import {
  CabecalhoPagina, CardNumero, GradeNumeros, Etiqueta, Painel, Vazio,
  TabelaCabecalho, fmtData, desde,
} from '@/components/painel/ui';

// INTEGRAÇÕES & API — as chaves que as instâncias usam para falar com o painel.
//
// Aqui é a CONFIGURAÇÃO (quem pode chamar, com qual permissão). O estado de
// cada instalação fica em Clientes › Integrações e o histórico em Relatórios.
//
// A chave é mostrada inteira UMA vez, no momento em que é criada. Depois só
// ficam os últimos caracteres: guardar o segredo à mostra numa lista é o tipo
// de coisa que vaza em print de tela.

const ESCOPOS = [
  { value: 'leitura', label: 'Somente leitura', descricao: 'Consulta status e dados básicos' },
  { value: 'escrita', label: 'Leitura e escrita', descricao: 'Também envia dados ao painel' },
];

const gerarChave = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const corpo = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `clog_${corpo}`;
};

const mascarar = (chave) => (chave ? `••••••••${String(chave).slice(-6)}` : '—');

const VAZIO = { nome: '', cliente_id: '', escopo: 'leitura', observacoes: '' };

export default function PainelApi() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [errors, setErrors] = useState({});
  const [chaveNova, setChaveNova] = useState(null); // mostrada só depois de criar

  const { data: chaves = [], isLoading } = useQuery({
    queryKey: ['chaves-api'],
    queryFn: () => base44.entities.ChaveApi.list('-created_date', 200).catch(() => []),
  });
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-saas'],
    queryFn: () => base44.entities.ClienteSaaS.list('nome', 500).catch(() => []),
  });

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: null } : e));
  };

  const criar = useMutation({
    mutationFn: (d) => base44.entities.ChaveApi.create(d),
    onSuccess: (_res, variaveis) => {
      qc.invalidateQueries({ queryKey: ['chaves-api'] });
      setModal(false);
      setChaveNova(variaveis.chave); // única vez que ela aparece inteira
    },
    onError: (e) => toast.error('Erro: ' + (e?.message || 'tente novamente')),
  });

  const revogar = useMutation({
    mutationFn: (id) => base44.entities.ChaveApi.update(id, { status: 'revogada', revogada_em: new Date().toISOString() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chaves-api'] });
      toast.success('Chave revogada. Quem usava perde o acesso imediatamente.');
    },
    onError: (e) => toast.error('Erro ao revogar: ' + (e?.message || 'tente novamente')),
  });

  const validar = () => {
    const e = {};
    if (!form.nome.trim()) e.nome = 'Dê um nome para reconhecer a chave depois';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCriar = () => {
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    const cli = clientes.find((c) => c.id === form.cliente_id);
    criar.mutate({
      ...form,
      cliente_nome: cli?.nome || '',
      chave: gerarChave(),
      status: 'ativa',
      ultimo_uso: null,
    });
  };

  const pedirRevogacao = async (c) => {
    const ok = await confirmar({
      titulo: 'Revogar chave',
      descricao: `A chave "${c.nome}" deixa de funcionar na hora. Quem estiver usando perde o acesso e precisará de uma nova. Esta ação não pode ser desfeita.`,
      confirmar: 'Revogar',
    });
    if (ok) revogar.mutate(c.id);
  };

  const copiar = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Chave copiada.');
    } catch {
      toast.error('Não foi possível copiar — selecione e copie manualmente.');
    }
  };

  const totais = useMemo(() => ({
    total: chaves.length,
    ativas: chaves.filter((c) => c.status === 'ativa').length,
    revogadas: chaves.filter((c) => c.status === 'revogada').length,
    semUso: chaves.filter((c) => c.status === 'ativa' && !c.ultimo_uso).length,
  }), [chaves]);

  const pag = usePagination(chaves, 15);

  return (
    <div className="space-y-6 pb-6">
      <CabecalhoPagina subtitulo="Chaves de acesso usadas pelas instalações dos clientes">
        <Button onClick={() => { setForm(VAZIO); setErrors({}); setModal(true); }} className="gap-2 bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Nova chave
        </Button>
      </CabecalhoPagina>

      <GradeNumeros>
        <CardNumero rotulo="Chaves" valor={totais.total} icone={KeyRound} />
        <CardNumero rotulo="Ativas" valor={totais.ativas} tom="positivo" />
        <CardNumero rotulo="Nunca usadas" valor={totais.semUso} tom={totais.semUso ? 'alerta' : 'neutro'} />
        <CardNumero rotulo="Revogadas" valor={totais.revogadas} tom="neutro" />
      </GradeNumeros>

      <Painel semPadding>
        {isLoading ? (
          <div className="p-4"><TableSkeleton rows={4} /></div>
        ) : chaves.length === 0 ? (
          <Vazio
            icone={Plug}
            titulo="Nenhuma chave criada"
            descricao="Crie uma chave para que a instalação de um cliente possa se comunicar com este painel."
            acao="Criar primeira chave"
            onAcao={() => { setForm(VAZIO); setErrors({}); setModal(true); }}
          />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <TabelaCabecalho colunas={[
                  { titulo: 'Nome' }, { titulo: 'Cliente' }, { titulo: 'Chave' },
                  { titulo: 'Permissão' }, { titulo: 'Último uso' }, { titulo: 'Status' },
                  { titulo: '', largura: 'w-28' },
                ]} />
                <tbody className="divide-y divide-gray-100">
                  {pag.paginatedItems.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="p-3">
                        <p className="font-medium text-gray-900">{c.nome}</p>
                        <p className="text-xs text-gray-400">criada em {fmtData(c.created_date)}</p>
                      </td>
                      <td className="p-3 text-gray-600">{c.cliente_nome || 'Todos'}</td>
                      <td className="p-3 font-mono text-xs text-gray-500">{mascarar(c.chave)}</td>
                      <td className="p-3 text-gray-600">
                        {ESCOPOS.find((e) => e.value === c.escopo)?.label || '—'}
                      </td>
                      <td className="p-3 text-gray-500">{desde(c.ultimo_uso)}</td>
                      <td className="p-3">
                        <Etiqueta tom={c.status === 'ativa' ? 'positivo' : 'neutro'}>
                          {c.status === 'ativa' ? 'Ativa' : 'Revogada'}
                        </Etiqueta>
                      </td>
                      <td className="p-3 text-right">
                        {c.status === 'ativa' && (
                          <Button
                            size="sm" variant="outline"
                            onClick={() => pedirRevogacao(c)}
                            className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <Ban className="w-3.5 h-3.5" /> Revogar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-gray-100">
              {pag.paginatedItems.map((c) => (
                <div key={c.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 break-words">{c.nome}</p>
                      <p className="font-mono text-xs text-gray-400">{mascarar(c.chave)}</p>
                    </div>
                    <Etiqueta tom={c.status === 'ativa' ? 'positivo' : 'neutro'}>
                      {c.status === 'ativa' ? 'Ativa' : 'Revogada'}
                    </Etiqueta>
                  </div>
                  <p className="text-xs text-gray-500">{c.cliente_nome || 'Todos'} · usada {desde(c.ultimo_uso)}</p>
                  {c.status === 'ativa' && (
                    <Button size="sm" variant="outline" onClick={() => pedirRevogacao(c)} className="w-full gap-1 text-red-600 border-red-200">
                      <Ban className="w-3.5 h-3.5" /> Revogar
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Pagination
              currentPage={pag.currentPage} totalPages={pag.totalPages} onPageChange={pag.goToPage}
              startIndex={pag.startIndex} endIndex={pag.endIndex} totalItems={pag.totalItems}
            />
          </>
        )}
      </Painel>

      {/* Criar chave */}
      <Dialog open={modal} onOpenChange={(o) => { if (!o) setModal(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova chave de API</DialogTitle></DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-600">Nome *</Label>
              <Input
                className={`h-11 mt-1 ${errors.nome ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                value={form.nome} onChange={(e) => set('nome', e.target.value)}
                placeholder="Ex: Instância Alvorada — produção"
              />
              {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}
            </div>

            <div>
              <Label className="text-xs text-gray-600">Cliente</Label>
              <div className="mt-1">
                <ComboboxBusca
                  options={[{ value: '', label: '— Todos os clientes —' }, ...clientes.map((c) => ({ value: c.id, label: c.nome }))]}
                  value={form.cliente_id}
                  onSelect={(v) => set('cliente_id', v === '' ? '' : v)}
                  placeholder="Todos os clientes"
                  searchPlaceholder="Buscar cliente..."
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Amarrar a chave a um cliente limita o estrago se ela vazar.</p>
            </div>

            <div>
              <Label className="text-xs text-gray-600">Permissão</Label>
              <Select value={form.escopo} onValueChange={(v) => set('escopo', v)}>
                <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESCOPOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-gray-400 mt-1">{ESCOPOS.find((e) => e.value === form.escopo)?.descricao}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)} className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button onClick={handleCriar} disabled={criar.isPending} className="bg-blue-600 hover:bg-blue-700">
              {criar.isPending ? 'Gerando...' : 'Gerar chave'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* A chave, uma única vez */}
      <Dialog open={!!chaveNova} onOpenChange={(o) => { if (!o) setChaveNova(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Chave criada</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Copie agora: por segurança, a chave não será mostrada inteira de novo.
                Depois só ficam visíveis os últimos caracteres.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="font-mono text-sm break-all text-gray-900">{chaveNova}</p>
            </div>

            <Button onClick={() => copiar(chaveNova)} className="w-full gap-2 bg-gray-900 hover:bg-gray-800">
              <Copy className="w-4 h-4" /> Copiar chave
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setChaveNova(null)} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Check className="w-4 h-4" /> Já copiei
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

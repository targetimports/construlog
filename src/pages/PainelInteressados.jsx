import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { toast } from 'sonner';
import { Inbox, Mail, MailCheck, UserPlus, Send, MessageSquare, TrendingUp } from 'lucide-react';
import { PLANOS, valorDoPlano } from '@/lib/planos';
import {
  CabecalhoPagina, CardNumero, GradeNumeros, Etiqueta, Painel, Vazio,
  TabelaCabecalho, FiltroPilulas, fmtBRL, fmtDataHora, desde, hojeISO,
} from '@/components/painel/ui';

// INTERESSADOS — quem pediu contato pela landing e ainda não assinou.
//
// É a primeira etapa do ciclo: interessado → negociação → cliente → cobrança.
// A conversa por e-mail acontece aqui mesmo, e ao fechar o negócio o cadastro do
// cliente nasce dos dados que ele já informou, sem redigitar nada.

const STATUS = {
  novo: { label: 'Novo', tom: 'info' },
  em_contato: { label: 'Em contato', tom: 'alerta' },
  negociando: { label: 'Negociando', tom: 'alerta' },
  ganho: { label: 'Virou cliente', tom: 'positivo' },
  perdido: { label: 'Perdido', tom: 'neutro' },
};

const FILTROS = [
  ['abertos', 'Em aberto'],
  ['novo', 'Novos'],
  ['negociando', 'Negociando'],
  ['ganho', 'Viraram cliente'],
  ['perdido', 'Perdidos'],
  ['todos', 'Todos'],
];

const MOTIVO = {
  email_nao_configurado: 'Configure o e-mail em Sistema › Integrações externas para poder responder.',
  sem_email: 'Este interessado não tem e-mail.',
  corpo_vazio: 'Escreva a mensagem antes de enviar.',
  ja_convertido: 'Este interessado já virou cliente.',
  cnpj_duplicado: 'Já existe um cliente com este CNPJ.',
  nome_obrigatorio: 'Informe o nome da empresa.',
};

export default function PainelInteressados() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState('abertos');
  const [aberto, setAberto] = useState(null);      // interessado em detalhe
  const [resposta, setResposta] = useState({ assunto: '', corpo: '' });
  const [converter, setConverter] = useState(null); // { interessado, form }
  const [errosConv, setErrosConv] = useState({});

  const { data: interessados = [], isLoading } = useQuery({
    queryKey: ['interessados'],
    queryFn: () => base44.entities.Interessado.list('-recebido_em', 500).catch(() => []),
  });

  const responder = useMutation({
    mutationFn: ({ id, dados }) => base44.api(`/interessados/${id}/responder`, { method: 'POST', body: dados }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['interessados'] });
      if (r?.stubbed) toast.warning('E-mail não configurado neste servidor — a resposta foi só registrada.');
      else toast.success(`Resposta enviada para ${r.email}.`);
      setResposta({ assunto: '', corpo: '' });
      setAberto(null);
    },
    onError: (e) => toast.error(MOTIVO[e?.detail?.motivo] || 'Não foi possível enviar: ' + (e?.message || 'tente novamente')),
  });

  const mudarStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Interessado.update(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interessados'] });
      toast.success('Situação atualizada.');
    },
    onError: (e) => toast.error('Erro: ' + (e?.message || 'tente novamente')),
  });

  const converterEmCliente = useMutation({
    mutationFn: ({ id, dados }) => base44.api(`/interessados/${id}/converter`, { method: 'POST', body: dados }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['interessados'] });
      qc.invalidateQueries({ queryKey: ['clientes-saas'] });
      toast.success(`${r.cliente_nome} agora é cliente. Cadastro criado em Clientes.`);
      setConverter(null);
    },
    onError: (e) => toast.error(MOTIVO[e?.detail?.motivo] || 'Não foi possível converter: ' + (e?.message || 'tente novamente')),
  });

  const totais = useMemo(() => {
    const novos = interessados.filter((i) => i.status === 'novo').length;
    const emAberto = interessados.filter((i) => !['ganho', 'perdido'].includes(i.status)).length;
    const ganhos = interessados.filter((i) => i.status === 'ganho').length;
    const fechados = interessados.filter((i) => ['ganho', 'perdido'].includes(i.status)).length;
    return {
      novos,
      emAberto,
      ganhos,
      // Conversão só faz sentido sobre negociações encerradas: contar quem ainda
      // está em conversa como "perdido" faria a taxa parecer pior do que é.
      conversao: fechados ? Math.round((ganhos / fechados) * 100) : null,
    };
  }, [interessados]);

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return interessados;
    if (filtro === 'abertos') return interessados.filter((i) => !['ganho', 'perdido'].includes(i.status));
    return interessados.filter((i) => i.status === filtro);
  }, [interessados, filtro]);

  const pag = usePagination(filtrados, 15);

  const abrirDetalhe = (i) => {
    setAberto(i);
    setResposta({ assunto: `Sobre o seu contato — Construlog`, corpo: '' });
  };

  const abrirConversao = (i) => {
    setConverter({
      interessado: i,
      form: {
        nome: i.empresa || i.nome || '',
        cnpj: '',
        responsavel: i.nome || '',
        email: i.email || '',
        telefone: i.telefone || '',
        plano: i.plano_interesse || 'Construtora',
        valor_mensal: valorDoPlano(i.plano_interesse || 'Construtora') || '',
        dia_vencimento: 10,
        status: 'teste',
        inicio: hojeISO(),
      },
    });
    setErrosConv({});
  };

  const setConv = (k, v) => setConverter((c) => ({ ...c, form: { ...c.form, [k]: v } }));

  const salvarConversao = () => {
    const f = converter.form;
    const e = {};
    if (!String(f.nome || '').trim()) e.nome = 'Informe o nome da empresa';
    if (!(Number(f.valor_mensal) > 0)) e.valor_mensal = 'Informe a mensalidade acordada';
    setErrosConv(e);
    if (Object.keys(e).length) { toast.error('Verifique os campos destacados.'); return; }
    converterEmCliente.mutate({ id: converter.interessado.id, dados: f });
  };

  return (
    <div className="space-y-6 pb-6">
      <CabecalhoPagina subtitulo="Quem pediu contato pelo site e ainda não assinou" />

      <GradeNumeros>
        <CardNumero rotulo="Novos" valor={totais.novos} tom={totais.novos ? 'info' : 'neutro'} icone={Inbox} detalhe="ainda sem resposta" />
        <CardNumero rotulo="Em aberto" valor={totais.emAberto} icone={MessageSquare} detalhe="em conversa" />
        <CardNumero rotulo="Viraram cliente" valor={totais.ganhos} tom="positivo" icone={UserPlus} />
        <CardNumero
          rotulo="Conversão"
          valor={totais.conversao == null ? '—' : `${totais.conversao}%`}
          icone={TrendingUp}
          detalhe="das negociações encerradas"
        />
      </GradeNumeros>

      <FiltroPilulas valor={filtro} onChange={(v) => { setFiltro(v); pag.goToPage(1); }} opcoes={FILTROS} />

      <Painel semPadding>
        {isLoading ? (
          <div className="p-4"><TableSkeleton rows={5} /></div>
        ) : filtrados.length === 0 ? (
          <Vazio
            icone={Inbox}
            titulo={filtro === 'abertos' ? 'Nenhum interessado em aberto' : 'Nada neste filtro'}
            descricao="Quem preencher o formulário da landing page aparece aqui automaticamente."
          />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <TabelaCabecalho colunas={[
                  { titulo: 'Interessado' },
                  { titulo: 'Mensagem' },
                  { titulo: 'Plano' },
                  { titulo: 'Situação' },
                  { titulo: 'Recebido' },
                  { titulo: '', largura: 'w-44' },
                ]} />
                <tbody className="divide-y divide-gray-100">
                  {pag.paginatedItems.map((i) => {
                    const s = STATUS[i.status] || STATUS.novo;
                    const respondido = Array.isArray(i.mensagens) && i.mensagens.length > 0;
                    return (
                      <tr key={i.id} className="hover:bg-gray-50">
                        <td className="p-3">
                          <p className="font-medium text-gray-900">{i.nome}</p>
                          <p className="text-xs text-gray-400">{i.email}</p>
                        </td>
                        <td className="p-3 text-gray-600 max-w-[280px]">
                          <p className="truncate" title={i.mensagem}>{i.mensagem}</p>
                          {respondido && (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 mt-0.5">
                              <MailCheck className="w-3.5 h-3.5" />
                              {i.mensagens.length} resposta(s)
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-gray-600">{i.plano_interesse || '—'}</td>
                        <td className="p-3"><Etiqueta tom={s.tom}>{s.label}</Etiqueta></td>
                        <td className="p-3 text-gray-500 whitespace-nowrap">{desde(i.recebido_em)}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm" variant="outline"
                              onClick={() => abrirDetalhe(i)}
                              className="gap-1 border-gray-300 text-gray-700"
                            >
                              <Mail className="w-3.5 h-3.5" /> Responder
                            </Button>
                            {i.status !== 'ganho' && (
                              <Button
                                size="sm"
                                onClick={() => abrirConversao(i)}
                                className="gap-1 bg-blue-600 hover:bg-blue-700"
                                title="Criar o cadastro de cliente com estes dados"
                              >
                                <UserPlus className="w-3.5 h-3.5" /> Cliente
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

            <div className="md:hidden divide-y divide-gray-100">
              {pag.paginatedItems.map((i) => {
                const s = STATUS[i.status] || STATUS.novo;
                return (
                  <div key={i.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 break-words">{i.nome}</p>
                        <p className="text-xs text-gray-400 break-all">{i.email}</p>
                      </div>
                      <Etiqueta tom={s.tom}>{s.label}</Etiqueta>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-3">{i.mensagem}</p>
                    <p className="text-xs text-gray-400">{desde(i.recebido_em)}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => abrirDetalhe(i)} className="flex-1 gap-1 border-gray-300 text-gray-700">
                        <Mail className="w-3.5 h-3.5" /> Responder
                      </Button>
                      {i.status !== 'ganho' && (
                        <Button size="sm" onClick={() => abrirConversao(i)} className="gap-1 bg-blue-600 hover:bg-blue-700">
                          <UserPlus className="w-3.5 h-3.5" /> Cliente
                        </Button>
                      )}
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

      {/* DETALHE + RESPOSTA — a conversa inteira num lugar só. */}
      <Dialog open={!!aberto} onOpenChange={(o) => { if (!o) setAberto(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{aberto?.nome}</DialogTitle>
          </DialogHeader>

          {aberto && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                <a href={`mailto:${aberto.email}`} className="text-blue-600 hover:text-blue-700">{aberto.email}</a>
                {aberto.telefone && <span className="text-gray-400">· {aberto.telefone}</span>}
                {aberto.plano_interesse && <Etiqueta tom="info">Plano {aberto.plano_interesse}</Etiqueta>}
                <span className="ml-auto">
                  <Select value={aberto.status} onValueChange={(v) => { mudarStatus.mutate({ id: aberto.id, status: v }); setAberto({ ...aberto, status: v }); }}>
                    <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS).map(([k, s]) => <SelectItem key={k} value={k}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </span>
              </div>

              {/* Mensagem original */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">
                  Mensagem do site · {fmtDataHora(aberto.recebido_em)}
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{aberto.mensagem}</p>
              </div>

              {/* Histórico */}
              {Array.isArray(aberto.mensagens) && aberto.mensagens.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Respostas enviadas</p>
                  {aberto.mensagens.map((m, idx) => (
                    <div key={idx} className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                      <p className="text-xs text-gray-500 mb-1">
                        {fmtDataHora(m.em)} · {m.autor}
                        {m.stubbed && <span className="text-amber-600"> · não enviado (e-mail desconfigurado)</span>}
                      </p>
                      {m.assunto && <p className="text-sm font-medium text-gray-900">{m.assunto}</p>}
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.corpo}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Caixa de resposta */}
              <div className="space-y-3 pt-1">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Responder</p>
                <div>
                  <Label className="text-xs text-gray-600">Assunto</Label>
                  <Input
                    className="h-11 mt-1"
                    value={resposta.assunto}
                    onChange={(e) => setResposta((r) => ({ ...r, assunto: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Mensagem</Label>
                  <Textarea
                    rows={7}
                    className="mt-1"
                    value={resposta.corpo}
                    onChange={(e) => setResposta((r) => ({ ...r, corpo: e.target.value }))}
                    placeholder={`Olá, ${String(aberto.nome || '').split(' ')[0]}!\n\nObrigado pelo contato...`}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    A resposta dele volta para a caixa do remetente configurado no painel.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(null)} className="border-gray-300 text-gray-700">Fechar</Button>
            <Button
              onClick={() => responder.mutate({ id: aberto.id, dados: resposta })}
              disabled={responder.isPending || !resposta.corpo.trim()}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Send className="w-4 h-4" />
              {responder.isPending ? 'Enviando...' : 'Enviar resposta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONVERSÃO EM CLIENTE — nasce dos dados que ele já informou. */}
      <Dialog open={!!converter} onOpenChange={(o) => { if (!o) setConverter(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transformar em cliente</DialogTitle>
          </DialogHeader>

          {converter && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                O cadastro nasce com o que <strong>{converter.interessado.nome}</strong> informou no site.
                Confirme os dados do contrato — a mensalidade é o que passa a ser cobrado.
              </p>

              <div>
                <Label className="text-xs text-gray-600">Nome da empresa *</Label>
                <Input
                  className={`h-11 mt-1 ${errosConv.nome ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                  value={converter.form.nome}
                  onChange={(e) => setConv('nome', e.target.value)}
                />
                {errosConv.nome && <p className="text-xs text-red-500 mt-1">{errosConv.nome}</p>}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-600">CNPJ</Label>
                  <Input className="h-11 mt-1" value={converter.form.cnpj} onChange={(e) => setConv('cnpj', e.target.value)} placeholder="00.000.000/0001-00" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Responsável</Label>
                  <Input className="h-11 mt-1" value={converter.form.responsavel} onChange={(e) => setConv('responsavel', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">E-mail</Label>
                  <Input className="h-11 mt-1" value={converter.form.email} onChange={(e) => setConv('email', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Telefone</Label>
                  <Input className="h-11 mt-1" value={converter.form.telefone} onChange={(e) => setConv('telefone', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Plano</Label>
                  <Select
                    value={converter.form.plano}
                    onValueChange={(v) => { setConv('plano', v); const p = valorDoPlano(v); if (p) setConv('valor_mensal', p); }}
                  >
                    <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLANOS.map((p) => <SelectItem key={p.nome} value={p.nome}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Mensalidade acordada *</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    className={`h-11 mt-1 ${errosConv.valor_mensal ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                    value={converter.form.valor_mensal}
                    onChange={(e) => setConv('valor_mensal', e.target.value)}
                  />
                  {errosConv.valor_mensal
                    ? <p className="text-xs text-red-500 mt-1">{errosConv.valor_mensal}</p>
                    : <p className="text-[11px] text-gray-400 mt-1">{fmtBRL(converter.form.valor_mensal)} por mês</p>}
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Dia do vencimento</Label>
                  <Input type="number" min="1" max="28" className="h-11 mt-1" value={converter.form.dia_vencimento} onChange={(e) => setConv('dia_vencimento', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Situação inicial</Label>
                  <Select value={converter.form.status} onValueChange={(v) => setConv('status', v)}>
                    <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teste">Em teste</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                A negociação continua registrada aqui, marcada como "Virou cliente" —
                o histórico não se perde.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConverter(null)} className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button onClick={salvarConversao} disabled={converterEmCliente.isPending} className="bg-blue-600 hover:bg-blue-700">
              {converterEmCliente.isPending ? 'Criando...' : 'Criar cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListSkeleton } from '@/components/shared/Skeletons';
import { Plug, CreditCard, MessageCircle, Mail, ExternalLink, RefreshCw, Lock, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { CabecalhoPagina, Etiqueta, Painel, fmtDataHora } from '@/components/painel/ui';

// INTEGRAÇÕES EXTERNAS — os serviços de fora que este painel usa.
//
// Cada provedor é um cartão: o que ele faz, se está configurado, os campos e um
// teste de conexão. A tela se monta a partir do que o backend devolve, então
// acrescentar um provedor novo não exige mexer aqui.
//
// Segredos chegam mascarados (••••1234). Campo de segredo em branco significa
// "não mexi", nunca "apague" — senão abrir e salvar limparia a chave.

const ICONES = { asaas: CreditCard, whatsapp: MessageCircle, email: Mail };

export default function PainelIntegracoesExternas() {
  const qc = useQueryClient();
  const [edicao, setEdicao] = useState({});   // { [chave]: { campo: valor } }
  const [testando, setTestando] = useState(null);

  const { data: provedores = [], isLoading } = useQuery({
    queryKey: ['integracoes-externas'],
    queryFn: () => base44.api('/integracoes-externas'),
  });

  const salvar = useMutation({
    mutationFn: ({ chave, dados }) => base44.api(`/integracoes-externas/${chave}`, { method: 'PUT', body: dados }),
    onSuccess: (r, { chave }) => {
      qc.invalidateQueries({ queryKey: ['integracoes-externas'] });
      setEdicao((e) => ({ ...e, [chave]: undefined }));
      toast.success(r?.configurado ? 'Integração configurada!' : 'Salvo — ainda faltam campos obrigatórios.');
    },
    onError: (e) => toast.error(e?.detail?.error === 'definido_no_servidor'
      ? 'Este provedor está definido no .env do servidor e não pode ser editado por aqui.'
      : 'Erro ao salvar: ' + (e?.message || 'tente novamente')),
  });

  const testar = useMutation({
    mutationFn: (chave) => base44.api(`/integracoes-externas/${chave}/testar`, { method: 'POST' }),
    onMutate: (chave) => setTestando(chave),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['integracoes-externas'] });
      if (r?.ok) toast.success(`${r.detalhe || 'Conexão OK'} (${r.tempo_ms} ms)`);
      else toast.error(r?.erro || 'A conexão falhou.');
    },
    onError: (e) => toast.error('Falha no teste: ' + (e?.message || 'tente novamente')),
    onSettled: () => setTestando(null),
  });

  const valorDe = (prov, campo) => {
    const local = edicao[prov.chave]?.[campo.nome];
    if (local !== undefined) return local;
    // Segredo já salvo aparece vazio com placeholder mascarado: mostrar os
    // "••••" dentro do campo faria o usuário salvar isso como se fosse a chave.
    return campo.segredo ? '' : (campo.valor || '');
  };

  const set = (chave, campo, valor) => setEdicao((e) => ({
    ...e, [chave]: { ...(e[chave] || {}), [campo]: valor },
  }));

  const handleSalvar = (prov) => {
    const dados = { ...(edicao[prov.chave] || {}) };
    // Campos não tocados vão com o valor atual (exceto segredos, que ficam de
    // fora para o backend preservar o que já está gravado).
    for (const c of prov.campos) {
      if (dados[c.nome] === undefined && !c.segredo) dados[c.nome] = c.valor || '';
    }
    salvar.mutate({ chave: prov.chave, dados });
  };

  const etiquetaEstado = (p) => {
    if (p.origem === 'env') return <Etiqueta tom="info">definido no servidor</Etiqueta>;
    if (!p.configurado) return <Etiqueta tom="neutro">não configurado</Etiqueta>;
    if (!p.ativo) return <Etiqueta tom="alerta">desligado</Etiqueta>;
    return <Etiqueta tom="positivo">configurado</Etiqueta>;
  };

  return (
    <div className="space-y-6 pb-6">
      <CabecalhoPagina subtitulo="Serviços de fora que o painel usa para cobrar e avisar seus clientes" />

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : (
        <div className="space-y-4">
          {provedores.map((p) => {
            const Icone = ICONES[p.chave] || Plug;
            const bloqueado = p.origem === 'env';
            const alterado = !!edicao[p.chave];

            return (
              <Painel key={p.chave}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="grid place-items-center w-10 h-10 rounded-lg bg-gray-100 shrink-0">
                    <Icone className="w-5 h-5 text-gray-500" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="font-semibold text-gray-900">{p.nome}</h2>
                          <span className="text-xs text-gray-400">{p.categoria}</span>
                          {etiquetaEstado(p)}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{p.descricao}</p>
                      </div>
                      {p.docs && (
                        <a
                          href={p.docs} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                        >
                          documentação <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {bloqueado && (
                      <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5">
                        <Lock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-800">
                          Configurado pelo <code className="font-mono">.env</code> do servidor. Quem tem acesso à
                          máquina manda mais que o painel — para editar aqui, remova as variáveis de lá.
                        </p>
                      </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-4">
                      {p.campos.map((campo) => (
                        <div key={campo.nome} className={campo.tipo === 'select' ? '' : 'sm:col-span-2 lg:col-span-1'}>
                          <Label className="text-xs text-gray-600">
                            {campo.rotulo}
                            {campo.obrigatorio && <span className="text-gray-400"> *</span>}
                          </Label>

                          {campo.tipo === 'select' ? (
                            <Select
                              value={valorDe(p, campo) || campo.valor}
                              onValueChange={(v) => set(p.chave, campo.nome, v)}
                              disabled={bloqueado}
                            >
                              <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(campo.opcoes || []).map((o) => (
                                  <SelectItem key={o.valor} value={o.valor}>{o.rotulo}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              className="h-11 mt-1"
                              type={campo.segredo ? 'password' : 'text'}
                              value={valorDe(p, campo)}
                              onChange={(e) => set(p.chave, campo.nome, e.target.value)}
                              disabled={bloqueado}
                              placeholder={campo.segredo && campo.preenchido ? campo.valor : (campo.dica || '')}
                            />
                          )}

                          {campo.dica && !campo.segredo && (
                            <p className="text-[11px] text-gray-400 mt-1">{campo.dica}</p>
                          )}
                          {campo.segredo && campo.preenchido && (
                            <p className="text-[11px] text-gray-400 mt-1">
                              Já configurado. Deixe em branco para manter.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="text-xs text-gray-400">
                        {p.ultimo_teste ? (
                          <span className="inline-flex items-center gap-1.5">
                            {p.ultimo_teste_ok
                              ? <Check className="w-3.5 h-3.5 text-emerald-600" />
                              : <X className="w-3.5 h-3.5 text-red-500" />}
                            Último teste em {fmtDataHora(p.ultimo_teste)}
                            {!p.ultimo_teste_ok && p.ultimo_teste_erro && (
                              <span className="text-red-500">— {p.ultimo_teste_erro}</span>
                            )}
                          </span>
                        ) : 'Nunca testado'}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => testar.mutate(p.chave)}
                          disabled={!p.configurado || testando === p.chave}
                          className="gap-2 border-gray-300 text-gray-700"
                        >
                          <RefreshCw className={`w-4 h-4 ${testando === p.chave ? 'animate-spin' : ''}`} />
                          {testando === p.chave ? 'Testando' : 'Testar conexão'}
                        </Button>
                        {!bloqueado && (
                          <Button
                            onClick={() => handleSalvar(p)}
                            disabled={salvar.isPending || !alterado}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {salvar.isPending ? 'Salvando...' : 'Salvar'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Painel>
            );
          })}
        </div>
      )}
    </div>
  );
}

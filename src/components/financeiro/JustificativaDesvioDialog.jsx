import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// JUSTIFICATIVA DO DESVIO — as três perguntas que transformam número em ação.
//
// A ordem importa e é a do manual:
//   1. Recuperável? decide se o caso é de correção ou de reprevisão.
//   2. Pontual ou recorrente? decide se vai acontecer de novo.
//   3. Se recorrente, o que se faz? o orçamento estava errado, ou a execução
//      está. Deixar como está não é resposta aceita.
//
// O formulário é curto de propósito. Justificativa que dá trabalho não é
// preenchida — é contornada.

const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function Escolha({ opcoes, valor, onEscolher }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opcoes.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          onClick={() => onEscolher(o.valor)}
          className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
            valor === o.valor
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
          }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

export default function JustificativaDesvioDialog({ obraId, competencia, servico, onFechar }) {
  const queryClient = useQueryClient();
  const j = servico.justificativa;

  const [recuperavel, setRecuperavel] = useState(j ? j.recuperavel : null);
  const [natureza, setNatureza] = useState(j?.natureza ?? null);
  const [motivo, setMotivo] = useState(j?.motivo ?? '');
  const [acao, setAcao] = useState(j?.acao ?? 'nenhuma');
  const [planoAcao, setPlanoAcao] = useState(j?.plano_acao ?? '');
  const [responsavel, setResponsavel] = useState(j?.responsavel ?? '');
  const [prazo, setPrazo] = useState(j?.prazo ?? '');

  const salvar = useMutation({
    mutationFn: async (remover = false) => {
      const r = await base44.functions.invoke('salvarJustificativaDesvio', {
        obra_id: obraId,
        contrato_item_id: servico.contrato_item_id,
        competencia,
        desvio_valor: servico.desvio,
        desvio_pct: servico.desvio_pct,
        recuperavel, natureza, motivo, acao,
        plano_acao: planoAcao, responsavel, prazo: prazo || null,
        remover,
      });
      return r.data;
    },
    onSuccess: (_d, remover) => {
      queryClient.invalidateQueries({ queryKey: ['desvio-obra', obraId] });
      queryClient.invalidateQueries({ queryKey: ['conferencia-fechamento', obraId] });
      toast.success(remover ? 'Justificativa removida.' : 'Desvio justificado.');
      onFechar();
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message || 'Não foi possível salvar.'),
  });

  // Desvio recorrente precisa de decisão; plano de ação precisa de dono.
  const exigeDecisao = natureza === 'recorrente';
  const valido = typeof recuperavel === 'boolean'
    && !!natureza
    && motivo.trim().length >= 10
    && (!exigeDecisao || acao !== 'nenhuma')
    && (acao !== 'plano_acao' || (planoAcao.trim().length >= 10 && responsavel.trim().length > 0));

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Justificar o desvio</DialogTitle>
        </DialogHeader>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-sm font-medium text-gray-900">
            {servico.codigo ? `${servico.codigo} · ` : ''}{servico.descricao}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
            <span>{servico.etapa}</span>
            <span>competência {competencia}</span>
            <span className={`font-semibold ${servico.desvio > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              desvio {fmt(servico.desvio)} ({servico.desvio_pct > 0 ? '+' : ''}{Number(servico.desvio_pct).toFixed(1)}%)
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Deveria custar {fmt(servico.custo_previsto_executado)} · custou {fmt(servico.custo_real)}
          </p>
          {j?.defasada && (
            <Badge variant="outline" className="mt-2 bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
              o desvio mudou desde a última justificativa ({fmt(j.desvio_valor)}) — reveja
            </Badge>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-gray-700">Dá para recuperar até o fim da obra?</p>
            <Escolha
              opcoes={[{ valor: true, rotulo: 'Sim, é recuperável' }, { valor: false, rotulo: 'Não, o custo já foi' }]}
              valor={recuperavel}
              onEscolher={setRecuperavel}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-gray-700">É pontual ou vai se repetir?</p>
            <Escolha
              opcoes={[
                { valor: 'pontual', rotulo: 'Pontual' },
                { valor: 'recorrente', rotulo: 'Recorrente' },
              ]}
              valor={natureza}
              onEscolher={(v) => { setNatureza(v); if (v === 'pontual') setAcao('nenhuma'); }}
            />
            <p className="text-[11px] text-gray-400">
              Recorrente = a mesma causa vai aparecer em outros serviços parecidos.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-gray-700">Por quê?</p>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ex.: consumo de aço acima da composição orçada por perda de corte."
            />
            {motivo.trim().length > 0 && motivo.trim().length < 10 && (
              <p className="text-[11px] text-red-600">Descreva com um pouco mais de detalhe.</p>
            )}
          </div>

          {exigeDecisao && (
            <div className="space-y-1.5 border-l-2 border-amber-300 pl-3">
              <p className="text-sm font-medium text-gray-700">Desvio recorrente exige decisão</p>
              <Escolha
                opcoes={[
                  { valor: 'plano_acao', rotulo: 'Abrir plano de ação' },
                  { valor: 'atualizar_orcamento', rotulo: 'Atualizar o orçamento' },
                ]}
                valor={acao}
                onEscolher={setAcao}
              />
              <p className="text-[11px] text-gray-400">
                Plano de ação quando a execução pode melhorar; atualizar o orçamento quando não há como evitar.
              </p>
            </div>
          )}

          {acao === 'plano_acao' && (
            <div className="space-y-2 border-l-2 border-gray-200 pl-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-600">O que será feito</label>
                <Textarea value={planoAcao} onChange={(e) => setPlanoAcao(e.target.value)} rows={2}
                  placeholder="Ex.: renegociar com fornecedor e revisar perdas de corte." />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-gray-600">Responsável</label>
                  <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Quem responde por isso" />
                </div>
                <div className="w-full sm:w-44 space-y-1">
                  <label className="text-xs text-gray-600">Prazo</label>
                  <Input type="date" value={prazo || ''} onChange={(e) => setPrazo(e.target.value)} />
                </div>
              </div>
              <p className="text-[11px] text-gray-400">Plano de ação sem dono não sai do papel.</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {j && (
            <Button variant="ghost" className="text-red-600 hover:bg-red-50 mr-auto"
              onClick={() => salvar.mutate(true)} disabled={salvar.isPending}>
              Remover
            </Button>
          )}
          <Button variant="outline" onClick={onFechar} disabled={salvar.isPending}>Cancelar</Button>
          <Button onClick={() => salvar.mutate(false)} disabled={!valido || salvar.isPending}>
            {salvar.isPending ? 'Salvando...' : 'Salvar justificativa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

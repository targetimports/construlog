import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'Não iniciado', label: 'Não iniciado' },
  { value: 'Em andamento', label: 'Em andamento' },
  { value: 'Concluído', label: 'Concluído' },
];

const DEFAULT_FORM = {
  nomeAtividade: '',
  item: '',
  dataInicioPlanejada: '',
  dataFimPlanejada: '',
  valorPlanejado: '',
  status: 'Não iniciado',
  percentualConcluido: 0,
};

function gerarItemId(existingItems) {
  const manuals = existingItems.filter(i => i.origem === 'MANUAL' || i.manual === true);
  const num = manuals.length + 1;
  return `M${num}`;
}

export default function AtividadeManualModal({ open, onClose, obraId, editItem = null, existingItems = [] }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (editItem) {
      setForm({
        nomeAtividade: editItem.nomeAtividade || '',
        item: editItem.item || '',
        dataInicioPlanejada: editItem.dataInicioPlanejada ? editItem.dataInicioPlanejada.substring(0, 10) : '',
        dataFimPlanejada: editItem.dataFimPlanejada ? editItem.dataFimPlanejada.substring(0, 10) : '',
        valorPlanejado: editItem.valorPlanejado ?? '',
        status: editItem.status || 'Não iniciado',
        percentualConcluido: editItem.percentualConcluido ?? 0,
      });
    } else {
      setForm({ ...DEFAULT_FORM });
    }
    setErrors({});
  }, [editItem, open]);

  // Invalida por predicado para pegar TODAS as variações de chave usadas pelas
  // telas de cronograma (cronograma-items, cronograma-items-obra_id,
  // cronograma-items-obraId, marcos-obra, obra-kpis, obra, obra-resumo…),
  // garantindo que a lista/Gantt recarregue após salvar.
  const invalidate = () => {
    queryClient.invalidateQueries({
      predicate: (q) => {
        const k = q.queryKey?.[0];
        return typeof k === 'string' && (k.startsWith('cronograma') || k === 'marcos-obra' || k === 'obra-kpis' || k === 'obra' || k === 'obra-resumo' || k === 'obra-detalhes');
      },
    });
  };

  // Borda vermelha quando o campo tem erro.
  const cls = (campo) => (errors[campo] ? 'border-red-400 focus-visible:ring-red-400' : '');

  const validate = () => {
    const errs = {};
    if (!form.nomeAtividade.trim()) errs.nomeAtividade = 'Informe o título / descrição da atividade.';
    // Data de início é o âncora da atividade no Gantt: sem ela, não há como
    // posicioná-la no cronograma.
    if (!form.dataInicioPlanejada) errs.dataInicioPlanejada = 'Informe a data da atividade.';
    if (form.dataInicioPlanejada && form.dataFimPlanejada && form.dataFimPlanejada < form.dataInicioPlanejada) {
      errs.dataFimPlanejada = 'A data fim não pode ser anterior ao início.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: async () => {
      let percent = Number(form.percentualConcluido) || 0;
      if (form.status === 'Concluído') percent = 100;
      if (form.status === 'Não iniciado') percent = 0;

      const payload = {
        nomeAtividade: form.nomeAtividade.trim(),
        item: form.item.trim() || gerarItemId(existingItems),
        dataInicioPlanejada: form.dataInicioPlanejada || null,
        dataFimPlanejada: form.dataFimPlanejada || null,
        // Sem campo na tela (ver comentário abaixo), mas o valor continua no payload:
        // é o que preserva o valor da etapa quando se edita uma atividade IMPORTADA
        // do OrçaFácil. Atividade criada na mão nasce com 0.
        valorPlanejado: form.valorPlanejado !== '' ? Number(form.valorPlanejado) : 0,
        status: form.status,
        percentualConcluido: percent,
        // Ao editar, preserva a origem do item (não converte um item importado
        // em manual). Novos itens criados aqui são MANUAL.
        origem: editItem ? (editItem.origem || 'MANUAL') : 'MANUAL',
        manual: editItem ? (editItem.manual ?? editItem.origem === 'MANUAL') : true,
        obraId,
        obra_id: obraId,
        ...(form.status === 'Concluído' ? { concluido_em: new Date().toISOString() } : {}),
      };

      if (editItem) {
        await base44.entities.CronogramaItem.update(editItem.id, payload);
      } else {
        await base44.entities.CronogramaItem.create(payload);
      }
    },
    onSuccess: () => {
      toast.success(editItem ? 'Atividade atualizada' : 'Atividade criada com sucesso');
      onClose();
      invalidate();
    },
    onError: (err) => toast.error('Erro ao salvar: ' + (err?.response?.data?.error || err.message)),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) { toast.error('Verifique os campos destacados.'); return; }
    salvar();
  };

  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Editar Atividade' : 'Adicionar Atividade'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2" autoComplete="off">
          {/* Título */}
          <div className="space-y-1">
            <Label htmlFor="nomeAtividade">Título / Descrição <span className="text-red-500">*</span></Label>
            <Input
              id="nomeAtividade"
              value={form.nomeAtividade}
              onChange={e => set('nomeAtividade', e.target.value)}
              placeholder="Ex: Fundação bloco A"
              autoComplete="off"
              className={cls('nomeAtividade')}
            />
            {errors.nomeAtividade && <p className="text-xs text-red-600">{errors.nomeAtividade}</p>}
          </div>

          {/* Item */}
          <div className="space-y-1">
            <Label htmlFor="item">Item <span className="text-xs text-gray-400">(opcional — gerado auto se vazio)</span></Label>
            <Input
              id="item"
              value={form.item}
              onChange={e => set('item', e.target.value)}
              placeholder="Ex: M1, 1.2, A.3"
              autoComplete="off"
            />
          </div>

          {/* Datas — cronograma diário: por padrão a atividade é de um único dia
              (a Data da atividade preenche o fim automaticamente). O campo "Data Fim"
              fica opcional, para o caso de uma atividade durar vários dias. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="dataInicio">Data da atividade <span className="text-red-500">*</span></Label>
              <Input
                id="dataInicio"
                type="date"
                value={form.dataInicioPlanejada}
                className={cls('dataInicioPlanejada')}
                onChange={e => {
                  const v = e.target.value;
                  setErrors(prev => (prev.dataInicioPlanejada ? { ...prev, dataInicioPlanejada: undefined } : prev));
                  setForm(f => ({
                    ...f,
                    dataInicioPlanejada: v,
                    // mantém o fim igual ao início quando ainda não foi alterado (1 dia)
                    dataFimPlanejada: (!f.dataFimPlanejada || f.dataFimPlanejada === f.dataInicioPlanejada) ? v : f.dataFimPlanejada,
                  }));
                }}
              />
              {errors.dataInicioPlanejada && <p className="text-xs text-red-600">{errors.dataInicioPlanejada}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="dataFim">Data Fim <span className="text-xs text-gray-400">(opcional — vários dias)</span></Label>
              <Input
                id="dataFim"
                type="date"
                value={form.dataFimPlanejada}
                className={cls('dataFimPlanejada')}
                onChange={e => set('dataFimPlanejada', e.target.value)}
              />
              {errors.dataFimPlanejada && <p className="text-xs text-red-600">{errors.dataFimPlanejada}</p>}
            </div>
          </div>

          {/* "Peso / Valor Planejado (R$)" saiu daqui: o cronograma DOCUMENTA etapas
              (o que é feito e quando) — quem mede dinheiro é o BM/medição, que tem
              contrato, saldo e trava. O campo era órfão no cadastro manual (ninguém
              lia o valor digitado) e sugeria uma segunda porta financeira que não
              existe. O dado CONTINUA na entidade: a atividade importada do OrçaFácil
              traz o valor da etapa dela, e apagar isso seria perder informação do
              orçamento. Ao editar uma atividade importada, o valor é preservado. */}

          {/* Status e Progresso */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => {
                set('status', v);
                if (v === 'Concluído') set('percentualConcluido', 100);
                if (v === 'Não iniciado') set('percentualConcluido', 0);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="percentual">% Progresso</Label>
              <Input
                id="percentual"
                type="number"
                min={0}
                max={100}
                value={form.percentualConcluido}
                onChange={e => set('percentualConcluido', Math.min(100, Math.max(0, Number(e.target.value))))}
                disabled={form.status === 'Concluído' || form.status === 'Não iniciado'}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editItem ? 'Salvar Alterações' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
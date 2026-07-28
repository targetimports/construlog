import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import ComboboxBusca from '@/components/shared/ComboboxBusca';

const TIPOS = [
  { value: 'nr18', label: 'NR18 — Construção Civil', validade: 24 },
  { value: 'nr35', label: 'NR35 — Trabalho em Altura', validade: 24 },
  { value: 'nr10', label: 'NR10 — Segurança em Eletricidade', validade: 24 },
  { value: 'nr12', label: 'NR12 — Máquinas e Equipamentos', validade: 24 },
  { value: 'nr06', label: 'NR06 — EPI', validade: 12 },
  { value: 'integracao', label: 'Integração / Admissional', validade: 12 },
  { value: 'primeiros_socorros', label: 'Primeiros Socorros', validade: 12 },
  { value: 'outro', label: 'Outro', validade: 12 },
];

const VAZIO = {
  tipo: 'nr18', data_realizacao: new Date().toISOString().split('T')[0], validade_meses: 24,
  status: 'realizado', instrutor: '', carga_horaria: '', observacoes: '',
};

export default function FormTreinamentoModal({ open, onClose, colaboradores = [] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(VAZIO);
  const [participantes, setParticipantes] = useState([]);

  const [errors, setErrors] = useState({});
  useEffect(() => { if (open) { setForm(VAZIO); setParticipantes([]); setErrors({}); } }, [open]);

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }));
  };
  const setTipo = (v) => {
    const t = TIPOS.find((x) => x.value === v);
    setForm((p) => ({ ...p, tipo: v, validade_meses: t?.validade ?? p.validade_meses }));
  };
  const nomeColab = (id) => colaboradores.find((c) => c.id === id)?.nome || id;

  const mutation = useMutation({
    mutationFn: () => base44.entities.Treinamento.create({
      ...form,
      validade_meses: Number(form.validade_meses) || 24,
      carga_horaria: form.carga_horaria !== '' ? Number(form.carga_horaria) : null,
      colaboradores_ids: participantes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treinamentos'] });
      toast.success('Treinamento registrado!');
      onClose();
    },
    onError: (e) => toast.error('Erro ao registrar treinamento: ' + (e?.message || 'tente novamente')),
  });

  const validar = () => {
    const e = {};
    if (participantes.length === 0) e.participantes = 'Selecione ao menos um participante';

    if (!form.data_realizacao) e.data_realizacao = 'Informe a data de realização';
    // Agendado pode ser no futuro; "realizado" no futuro contaria como regularidade
    // que ainda não aconteceu (ex.: NR18).
    else if (form.status === 'realizado' && form.data_realizacao > new Date().toISOString().split('T')[0]) {
      e.data_realizacao = 'Treinamento realizado não pode ter data futura';
    }

    if (!(Number(form.validade_meses) > 0)) e.validade_meses = 'Informe a validade em meses';
    if (form.carga_horaria !== '' && Number(form.carga_horaria) < 0) e.carga_horaria = 'Carga horária inválida';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const salvar = () => {
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    mutation.mutate();
  };

  const disponiveis = colaboradores
    .filter((c) => (c.status || 'ativo') !== 'inativo' && !participantes.includes(c.id))
    .map((c) => ({ value: c.id, label: c.cargo ? `${c.nome} (${c.cargo})` : c.nome }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar Treinamento</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Tipo / Norma</Label>
            <Select value={form.tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Participantes *</Label>
            <ComboboxBusca
              options={disponiveis}
              value=""
              onSelect={(v) => { if (v && !participantes.includes(v)) { setParticipantes((p) => [...p, v]); setErrors((e) => ({ ...e, participantes: null })); } }}
              placeholder="Adicionar participante..."
              searchPlaceholder="Buscar colaborador..."
              emptyMessage="Nenhum colaborador disponível."
              className={errors.participantes ? 'border-red-400' : ''}
            />
            {errors.participantes && <p className="text-xs text-red-500 mt-1">{errors.participantes}</p>}
            {participantes.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {participantes.map((id) => (
                  <Badge key={id} className="bg-blue-100 text-blue-700 border-0 gap-1 pr-1">
                    {nomeColab(id)}
                    <button type="button" onClick={() => setParticipantes((p) => p.filter((x) => x !== id))} className="hover:bg-blue-200 rounded-full p-0.5"><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Data de realização *</Label>
              <Input type="date" className={`h-11 ${errors.data_realizacao ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={form.data_realizacao} onChange={(e) => set('data_realizacao', e.target.value)} />
              {errors.data_realizacao && <p className="text-xs text-red-500 mt-1">{errors.data_realizacao}</p>}
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Validade (meses) *</Label>
              <Input type="number" min="1" className={`h-11 ${errors.validade_meses ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={form.validade_meses} onChange={(e) => set('validade_meses', e.target.value)} />
              {errors.validade_meses && <p className="text-xs text-red-500 mt-1">{errors.validade_meses}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
              <Select value={form.status} onValueChange={(v) => { set('status', v); setErrors((p) => ({ ...p, data_realizacao: null })); }}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="realizado">Realizado</SelectItem>
                  <SelectItem value="agendado">Agendado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Carga horária (h)</Label>
              <Input type="number" min="0" className={`h-11 ${errors.carga_horaria ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={form.carga_horaria} onChange={(e) => set('carga_horaria', e.target.value)} placeholder="Ex: 8" />
              {errors.carga_horaria && <p className="text-xs text-red-500 mt-1">{errors.carga_horaria}</p>}
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Instrutor</Label>
            <Input className="h-11" value={form.instrutor} onChange={(e) => set('instrutor', e.target.value)} placeholder="Nome do instrutor / empresa" />
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} placeholder="Opcional" />
          </div>

          <p className="text-[11px] text-gray-400">Apenas treinamentos com status "Realizado" e dentro da validade contam para a regularidade (ex.: NR18).</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-300 text-gray-700">Cancelar</Button>
          <Button onClick={salvar} disabled={mutation.isPending} className="bg-blue-600 hover:bg-blue-700">
            {mutation.isPending ? 'Salvando...' : 'Salvar Treinamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

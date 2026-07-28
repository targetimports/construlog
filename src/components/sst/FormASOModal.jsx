import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import ComboboxBusca from '@/components/shared/ComboboxBusca';

const VAZIO = {
  colaborador_id: '', tipo_exame: 'periodico',
  data_exame: new Date().toISOString().split('T')[0], data_validade: '',
  resultado: 'apto', medico_responsavel: '', crm: '', observacoes: '',
};

export default function FormASOModal({ open, onClose, colaboradores = [] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(VAZIO);

  const [errors, setErrors] = useState({});
  useEffect(() => { if (open) { setForm(VAZIO); setErrors({}); } }, [open]);

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }));
  };

  const mutation = useMutation({
    mutationFn: () => base44.entities.ASO.create({ ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asos'] });
      toast.success('ASO registrado!');
      onClose();
    },
    onError: (e) => toast.error('Erro ao registrar ASO: ' + (e?.message || 'tente novamente')),
  });

  const validar = () => {
    const e = {};
    const hoje = new Date().toISOString().split('T')[0];

    if (!form.colaborador_id) e.colaborador_id = 'Selecione o colaborador';

    if (!form.data_exame) e.data_exame = 'Informe a data do exame';
    else if (form.data_exame > hoje) e.data_exame = 'A data do exame não pode ser futura';

    // Validade é o que alimenta o alerta de ASO vencido: invertida, o exame nasce vencido.
    if (!form.data_validade) e.data_validade = 'Informe a validade';
    else if (form.data_exame && form.data_validade <= form.data_exame) {
      e.data_validade = 'A validade deve ser posterior ao exame';
    }

    if (!form.resultado) e.resultado = 'Selecione o resultado';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const salvar = () => {
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo ASO</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Colaborador *</Label>
            <ComboboxBusca
              options={colaboradores.filter((c) => (c.status || 'ativo') !== 'inativo').map((c) => ({ value: c.id, label: c.cargo ? `${c.nome} (${c.cargo})` : c.nome }))}
              value={form.colaborador_id}
              onSelect={(v) => set('colaborador_id', v)}
              placeholder="Selecione o colaborador"
              searchPlaceholder="Buscar colaborador..."
              emptyMessage="Nenhum colaborador."
              className={errors.colaborador_id ? 'border-red-400' : ''}
            />
            {errors.colaborador_id && <p className="text-xs text-red-500 mt-1">{errors.colaborador_id}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Tipo de exame</Label>
              <Select value={form.tipo_exame} onValueChange={(v) => set('tipo_exame', v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admissional">Admissional</SelectItem>
                  <SelectItem value="periodico">Periódico</SelectItem>
                  <SelectItem value="retorno_trabalho">Retorno ao trabalho</SelectItem>
                  <SelectItem value="mudanca_funcao">Mudança de função</SelectItem>
                  <SelectItem value="demissional">Demissional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Resultado *</Label>
              <Select value={form.resultado} onValueChange={(v) => set('resultado', v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="apto">Apto</SelectItem>
                  <SelectItem value="apto_com_restricoes">Apto com restrições</SelectItem>
                  <SelectItem value="inapto">Inapto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Data do exame *</Label>
              <Input type="date" className={`h-11 ${errors.data_exame ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={form.data_exame} onChange={(e) => { set('data_exame', e.target.value); setErrors((p) => ({ ...p, data_validade: null })); }} />
              {errors.data_exame && <p className="text-xs text-red-500 mt-1">{errors.data_exame}</p>}
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Validade *</Label>
              <Input type="date" className={`h-11 ${errors.data_validade ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={form.data_validade} onChange={(e) => set('data_validade', e.target.value)} />
              {errors.data_validade && <p className="text-xs text-red-500 mt-1">{errors.data_validade}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Médico responsável</Label>
              <Input className="h-11" value={form.medico_responsavel} onChange={(e) => set('medico_responsavel', e.target.value)} placeholder="Nome do médico" />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">CRM</Label>
              <Input className="h-11" value={form.crm} onChange={(e) => set('crm', e.target.value)} placeholder="CRM/UF" />
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Observações</Label>
            <Textarea rows={3} value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} placeholder="Opcional (restrições, riscos avaliados...)" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-300 text-gray-700">Cancelar</Button>
          <Button onClick={salvar} disabled={mutation.isPending} className="bg-blue-600 hover:bg-blue-700">
            {mutation.isPending ? 'Salvando...' : 'Salvar ASO'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

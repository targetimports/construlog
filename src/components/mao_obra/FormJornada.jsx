import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function FormJornada({ open, onOpenChange, colaborador, alocacao, data }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    colaborador_id: colaborador?.id || '',
    alocacao_id: alocacao?.id || '',
    obra_id: alocacao?.obra_id || '',
    data: data || new Date().toISOString().split('T')[0],
    hora_entrada: '',
    hora_saida: '',
    presenca: 'presente',
    horas_extras: 0,
    tipo_extra: 'normal',
    anotacoes: ''
  });

  const calcularHoras = () => {
    if (formData.hora_entrada && formData.hora_saida) {
      const [hE, mE] = formData.hora_entrada.split(':').map(Number);
      const [hS, mS] = formData.hora_saida.split(':').map(Number);
      
      const minutosEntrada = hE * 60 + mE;
      const minutosSaida = hS * 60 + mS;
      const minutosTrabalhados = minutosSaida - minutosEntrada;
      const horasTrabalhadas = minutosTrabalhados / 60;

      return horasTrabalhadas > 0 ? horasTrabalhadas : 0;
    }
    return 0;
  };

  const salvarMutation = useMutation({
    mutationFn: async (data) => {
      const horas = calcularHoras();
      return base44.entities.ControleJornada.create({
        ...data,
        horas_trabalhadas: horas,
        horas_extras: data.horas_extras ? parseFloat(data.horas_extras) : 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['jornadas']);
      toast.success('Jornada registrada!');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    salvarMutation.mutate(formData);
  };

  const horasTrabalhadas = calcularHoras();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Jornada</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-gray-700 font-medium">Data</Label>
            <Input
              type="date"
              value={formData.data}
              onChange={(e) => setFormData({...formData, data: e.target.value})}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700 font-medium">Presença *</Label>
              <Select value={formData.presenca} onValueChange={(v) => setFormData({...formData, presenca: v})}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presente">Presente</SelectItem>
                  <SelectItem value="ausente">Ausente</SelectItem>
                  <SelectItem value="falta_justificada">Falta Justificada</SelectItem>
                  <SelectItem value="atestado">Atestado</SelectItem>
                  <SelectItem value="licenca">Licença</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.presenca === 'presente' && (
              <div>
                <Label className="text-gray-700 font-medium text-xs">Horas trabalhadas</Label>
                <div className="text-lg font-bold text-emerald-600 mt-3">
                  {horasTrabalhadas.toFixed(2)}h
                </div>
              </div>
            )}
          </div>

          {formData.presenca === 'presente' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700 font-medium">Hora Entrada</Label>
                  <Input
                    type="time"
                    value={formData.hora_entrada}
                    onChange={(e) => setFormData({...formData, hora_entrada: e.target.value})}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-gray-700 font-medium">Hora Saída</Label>
                  <Input
                    type="time"
                    value={formData.hora_saida}
                    onChange={(e) => setFormData({...formData, hora_saida: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700 font-medium">Horas Extras</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.horas_extras}
                    onChange={(e) => setFormData({...formData, horas_extras: e.target.value})}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-gray-700 font-medium">Tipo de Extra</Label>
                  <Select value={formData.tipo_extra} onValueChange={(v) => setFormData({...formData, tipo_extra: v})}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="50_porcento">50%</SelectItem>
                      <SelectItem value="100_porcento">100%</SelectItem>
                      <SelectItem value="noturna">Noturna</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          <div>
            <Label className="text-gray-700 font-medium">Anotações</Label>
            <Textarea
              value={formData.anotacoes}
              onChange={(e) => setFormData({...formData, anotacoes: e.target.value})}
              className="mt-1 min-h-16"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={salvarMutation.isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              {salvarMutation.isPending ? 'Salvando...' : 'Registrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
import React, { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Calendar } from 'lucide-react';

export default function JornadaTrabalho({ formData, setFormData, canEdit }) {
  const jornada = formData.jornada || {};

  // Calcular horas mensais estimadas
  const horasMensaisEstimadas = useMemo(() => {
    const cargaSemanal = jornada.carga_semanal_horas || 0;
    return (cargaSemanal * 4.33).toFixed(1); // ~4.33 semanas/mês
  }, [jornada.carga_semanal_horas]);

  // Calcular custo hora
  const custoHora = useMemo(() => {
    const custoTotal = formData.remuneracao?.custo_total_mensal_empresa || 0;
    const horas = parseFloat(horasMensaisEstimadas);
    if (horas <= 0) return 0;
    return (custoTotal / horas).toFixed(2);
  }, [formData.remuneracao?.custo_total_mensal_empresa, horasMensaisEstimadas]);

  return (
    <div className="space-y-6">
      {/* Tipo de Jornada */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h4 className="font-semibold text-gray-900">Regime de Trabalho</h4>
        </div>

        <div>
          <Label>Tipo de Jornada</Label>
          <Select
            value={jornada.tipo || ''}
            onValueChange={(v) => setFormData({
              ...formData,
              jornada: { ...jornada, tipo: v }
            })}
            disabled={!canEdit}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6x1">6x1 (6 dias trabalho, 1 folga)</SelectItem>
              <SelectItem value="5x2">5x2 (5 dias trabalho, 2 folgas)</SelectItem>
              <SelectItem value="12x36">12x36 (12h trabalho, 36h folga)</SelectItem>
              <SelectItem value="7x0">7x0 (7 dias contínuo)</SelectItem>
              <SelectItem value="personalizada">Personalizada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Horários */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-600" />
          <h4 className="font-semibold text-gray-900">Horários</h4>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Entrada (HH:MM)</Label>
            <Input
              type="time"
              value={jornada.horario_entrada || ''}
              onChange={(e) => setFormData({
                ...formData,
                jornada: { ...jornada, horario_entrada: e.target.value }
              })}
              disabled={!canEdit}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Saída (HH:MM)</Label>
            <Input
              type="time"
              value={jornada.horario_saida || ''}
              onChange={(e) => setFormData({
                ...formData,
                jornada: { ...jornada, horario_saida: e.target.value }
              })}
              disabled={!canEdit}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Carga Semanal (horas)</Label>
            <Input
              type="number"
              step="0.5"
              value={jornada.carga_semanal_horas || ''}
              onChange={(e) => setFormData({
                ...formData,
                jornada: { ...jornada, carga_semanal_horas: parseFloat(e.target.value) || 0 }
              })}
              disabled={!canEdit}
              className="mt-1.5"
              placeholder="Ex: 40"
            />
            <p className="text-xs text-gray-500 mt-1">
              ~{horasMensaisEstimadas}h/mês estimadas
            </p>
          </div>
          <div>
            <Label>Intervalo (minutos)</Label>
            <Input
              type="number"
              value={jornada.intervalo_minutos || ''}
              onChange={(e) => setFormData({
                ...formData,
                jornada: { ...jornada, intervalo_minutos: parseInt(e.target.value) || 0 }
              })}
              disabled={!canEdit}
              className="mt-1.5"
              placeholder="Ex: 60"
            />
          </div>
        </div>
      </div>

      {/* Custo Hora */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">Custo Hora (Empresa)</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Calculado: Custo Total Mensal ÷ Horas Mensais
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-700">
              R$ {custoHora}
            </p>
            <p className="text-xs text-gray-600">por hora</p>
          </div>
        </div>
      </div>

      {/* Observações */}
      <div>
        <Label>Observações sobre Jornada</Label>
        <Input
          value={jornada.observacoes_jornada || ''}
          onChange={(e) => setFormData({
            ...formData,
            jornada: { ...jornada, observacoes_jornada: e.target.value }
          })}
          disabled={!canEdit}
          className="mt-1.5"
          placeholder="Ex: Flexível, home office 2x/semana, adicional noturno"
        />
      </div>
    </div>
  );
}
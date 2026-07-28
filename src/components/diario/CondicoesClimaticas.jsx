import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Sun, Cloud, CloudRain, CloudSnow, Wind, CloudDrizzle } from 'lucide-react';
import { cn } from '@/lib/utils';

const tempos = [
  { value: 'ensolarado', label: 'Ensolarado', icon: Sun, color: 'text-yellow-500' },
  { value: 'nublado', label: 'Nublado', icon: Cloud, color: 'text-gray-400' },
  { value: 'chuvoso', label: 'Chuvoso', icon: CloudRain, color: 'text-blue-500' },
  { value: 'garoa', label: 'Garoa', icon: CloudDrizzle, color: 'text-blue-400' },
  { value: 'ventoso', label: 'Ventoso', icon: Wind, color: 'text-gray-300' }
];

const turnos = [
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
  { value: 'integral', label: 'Integral' }
];

const condicoes = [
  { value: 'normal', label: 'Normal', color: 'bg-emerald-500/10 text-emerald-400' },
  { value: 'prejudicado', label: 'Prejudicado', color: 'bg-amber-500/10 text-amber-400' },
  { value: 'paralisado', label: 'Paralisado', color: 'bg-red-500/10 text-red-400' }
];

export default function CondicoesClimaticas({ dados = {}, onChange }) {
  const handleChange = (campo, valor) => {
    onChange({ ...dados, [campo]: valor });
  };

  const tempoSelecionado = tempos.find(t => t.value === dados.tempo);
  const TempoIcon = tempoSelecionado?.icon || Sun;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Condições Climáticas e Turno</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tempo */}
        <div>
          <Label className="mb-3 block">Clima do Dia</Label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {tempos.map(tempo => {
              const Icon = tempo.icon;
              const selecionado = dados.tempo === tempo.value;
              return (
                <button
                  key={tempo.value}
                  type="button"
                  onClick={() => handleChange('tempo', tempo.value)}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all",
                    selecionado
                      ? "bg-blue-500/20 border-blue-500"
                      : "bg-gray-50 border-gray-200 hover:border-gray-300"
                  )}
                >
                  <Icon className={cn("w-8 h-8 mx-auto mb-2", tempo.color)} />
                  <p className="text-sm font-medium text-center">{tempo.label}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Turno */}
        <div>
          <Label className="mb-3 block">Turno de Trabalho</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {turnos.map(turno => {
              const selecionado = dados.turno === turno.value;
              return (
                <button
                  key={turno.value}
                  type="button"
                  onClick={() => handleChange('turno', turno.value)}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all",
                    selecionado
                      ? "bg-purple-500/20 border-purple-500"
                      : "bg-gray-50 border-gray-200 hover:border-gray-300"
                  )}
                >
                  <p className="text-sm font-medium text-center">{turno.label}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Condição de Trabalho */}
        <div>
          <Label className="mb-3 block">Condição de Trabalho</Label>
          <div className="grid grid-cols-3 gap-3">
            {condicoes.map(condicao => {
              const selecionado = dados.condicao_trabalho === condicao.value;
              return (
                <button
                  key={condicao.value}
                  type="button"
                  onClick={() => handleChange('condicao_trabalho', condicao.value)}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all",
                    selecionado
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "bg-gray-50 border-gray-200 hover:border-gray-300"
                  )}
                >
                  <Badge className={cn("w-full justify-center", condicao.color)}>
                    {condicao.label}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* Resumo */}
        <div className="p-4 bg-gray-50 rounded-xl border">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <TempoIcon className={cn("w-5 h-5", tempoSelecionado?.color)} />
              <span className="font-medium">
                {tempoSelecionado?.label || 'Não informado'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-600">
                Turno: <span className="font-medium">{turnos.find(t => t.value === dados.turno)?.label || '-'}</span>
              </span>
              <Badge className={cn(
                condicoes.find(c => c.value === dados.condicao_trabalho)?.color || 'bg-gray-500/10 text-gray-400'
              )}>
                {condicoes.find(c => c.value === dados.condicao_trabalho)?.label || 'Normal'}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
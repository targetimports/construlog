import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Users } from 'lucide-react';

const PERIODOS = [
  { value: 'DIA_COMPLETO', label: 'Dia Completo' },
  { value: 'MEIO_PERIODO', label: 'Meio Período' }
];

const FUNCOES = ['Pedreiro', 'Servente', 'Encanador', 'Eletricista', 'Carpinteiro', 'Pintor', 'Mestre de obras', 'Engenheiro', 'Outro'];

export default function DiarioEquipeSection({ equipes, onChange }) {
  const adicionar = () => {
    onChange([...equipes, {
      nome_equipe_ou_funcionario: '',
      funcao: '',
      quantidade_pessoas: 1,
      periodo_trabalho: 'DIA_COMPLETO',
      horas_trabalhadas: '',
      observacao: ''
    }]);
  };

  const remover = (idx) => onChange(equipes.filter((_, i) => i !== idx));

  const atualizar = (idx, field, value) => {
    const novo = [...equipes];
    novo[idx] = { ...novo[idx], [field]: value };
    onChange(novo);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" />
          <span className="font-medium text-sm">Equipes / Trabalhadores</span>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={adicionar}>
          <Plus className="w-3 h-3 mr-1" /> Adicionar Equipe
        </Button>
      </div>

      {equipes.length === 0 && (
        <p className="text-sm text-gray-500 italic py-2">Nenhuma equipe adicionada. Clique em "+ Adicionar Equipe".</p>
      )}

      {equipes.map((eq, idx) => (
        <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nome / Equipe *</label>
              <Input
                value={eq.nome_equipe_ou_funcionario}
                onChange={(e) => atualizar(idx, 'nome_equipe_ou_funcionario', e.target.value)}
                placeholder="Ex: Equipe de alvenaria"
                className="text-sm h-8"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Função</label>
              <select
                value={eq.funcao}
                onChange={(e) => atualizar(idx, 'funcao', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
              >
                <option value="">Selecionar...</option>
                {FUNCOES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Qtd. Pessoas</label>
              <Input
                type="number"
                min="1"
                value={eq.quantidade_pessoas}
                onChange={(e) => atualizar(idx, 'quantidade_pessoas', parseInt(e.target.value) || 1)}
                className="text-sm h-8"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Período</label>
              <select
                value={eq.periodo_trabalho}
                onChange={(e) => atualizar(idx, 'periodo_trabalho', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
              >
                {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Horas (opcional)</label>
              <Input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={eq.horas_trabalhadas}
                onChange={(e) => atualizar(idx, 'horas_trabalhadas', e.target.value)}
                placeholder="8"
                className="text-sm h-8"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={eq.observacao}
              onChange={(e) => atualizar(idx, 'observacao', e.target.value)}
              placeholder="Observação (opcional)"
              className="text-sm h-8 flex-1"
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => remover(idx)} className="h-8 w-8 text-red-500 hover:text-red-700">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
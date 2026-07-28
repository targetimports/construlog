import React, { useState } from 'react';
import { DollarSign, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

/**
 * RemuneracaoColab - Editar Remuneração + Jornada do Colaborador
 * Apenas RH e Admin podem editar
 */
export function RemuneracaoColab({ colaborador, onSave, isEditing = false }) {
  const [remuneracao, setRemuneracao] = useState(colaborador?.remuneracao || {});
  const [jornada, setJornada] = useState(colaborador?.jornada || {});

  const handleSaveRemuneracao = () => {
    onSave({
      remuneracao,
      jornada
    });
    toast.success('Remuneração e jornada atualizadas');
  };

  const calcularCustoTotal = () => {
    const salario = remuneracao.salario_base || 0;
    const bonus = (remuneracao.bonificacao_percentual || 0) * salario / 100 + (remuneracao.bonificacao_valor || 0);
    const fgts = (remuneracao.fgts_percentual || 8) * salario / 100;
    const descontos = (remuneracao.desconto_vale_refeicao || 0) +
                      (remuneracao.desconto_vale_transporte || 0) +
                      (remuneracao.desconto_vale_alimentacao || 0) +
                      (remuneracao.outros_descontos || 0);
    
    return salario + bonus + fgts - descontos;
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="remuneracao" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="remuneracao" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Remuneração
          </TabsTrigger>
          <TabsTrigger value="jornada" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Jornada
          </TabsTrigger>
        </TabsList>

        {/* ABA REMUNERAÇÃO */}
        <TabsContent value="remuneracao" className="space-y-6 mt-6">
          {!isEditing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 text-sm text-blue-800">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>Você não tem permissão para editar. Contate RH.</p>
            </div>
          )}

          {/* Salário Base */}
          <div>
            <label className="block text-sm font-medium mb-2">Salário Base (R$)</label>
            <Input
              type="number"
              step="0.01"
              value={remuneracao.salario_base || ''}
              onChange={(e) => setRemuneracao({...remuneracao, salario_base: parseFloat(e.target.value) || 0})}
              disabled={!isEditing}
            />
          </div>

          {/* Bonificação */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Bônus (%)</label>
              <Input
                type="number"
                step="0.01"
                value={remuneracao.bonificacao_percentual || ''}
                onChange={(e) => setRemuneracao({...remuneracao, bonificacao_percentual: parseFloat(e.target.value) || 0})}
                disabled={!isEditing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Bônus (R$)</label>
              <Input
                type="number"
                step="0.01"
                value={remuneracao.bonificacao_valor || ''}
                onChange={(e) => setRemuneracao({...remuneracao, bonificacao_valor: parseFloat(e.target.value) || 0})}
                disabled={!isEditing}
              />
            </div>
          </div>

          {/* Descontos */}
          <div className="border-t pt-4 space-y-3">
            <h3 className="font-semibold text-sm">Descontos</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Vale Refeição</label>
                <Input
                  type="number"
                  step="0.01"
                  value={remuneracao.desconto_vale_refeicao || ''}
                  onChange={(e) => setRemuneracao({...remuneracao, desconto_vale_refeicao: parseFloat(e.target.value) || 0})}
                  disabled={!isEditing}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Vale Transporte</label>
                <Input
                  type="number"
                  step="0.01"
                  value={remuneracao.desconto_vale_transporte || ''}
                  onChange={(e) => setRemuneracao({...remuneracao, desconto_vale_transporte: parseFloat(e.target.value) || 0})}
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>

          {/* Encargos */}
          <div className="border-t pt-4 space-y-3">
            <h3 className="font-semibold text-sm">Encargos Trabalhistas</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">FGTS (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={remuneracao.fgts_percentual || 8}
                  onChange={(e) => setRemuneracao({...remuneracao, fgts_percentual: parseFloat(e.target.value) || 8})}
                  disabled={!isEditing}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">INSS (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={remuneracao.inss_percentual || 8}
                  onChange={(e) => setRemuneracao({...remuneracao, inss_percentual: parseFloat(e.target.value) || 8})}
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>

          {/* Custo Total */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Custo Total Mensal (para empresa)</p>
            <p className="text-2xl font-bold text-gray-900">
              R$ {calcularCustoTotal().toFixed(2)}
            </p>
          </div>

          {isEditing && (
            <Button onClick={handleSaveRemuneracao} className="w-full">
              Salvar Remuneração
            </Button>
          )}
        </TabsContent>

        {/* ABA JORNADA */}
        <TabsContent value="jornada" className="space-y-6 mt-6">
          <div>
            <label className="block text-sm font-medium mb-2">Tipo de Jornada</label>
            <Select value={jornada.tipo || ''} onValueChange={(v) => setJornada({...jornada, tipo: v})} disabled={!isEditing}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6x1">6x1 (6 dias trabalho, 1 folga)</SelectItem>
                <SelectItem value="5x2">5x2 (5 dias trabalho, 2 folga)</SelectItem>
                <SelectItem value="12x36">12x36 (12h trabalho, 36h folga)</SelectItem>
                <SelectItem value="7x0">7x0 (7 dias trabalho contínuo)</SelectItem>
                <SelectItem value="personalizada">Personalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Horários */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Entrada (HH:MM)</label>
              <Input
                type="time"
                value={jornada.horario_entrada || ''}
                onChange={(e) => setJornada({...jornada, horario_entrada: e.target.value})}
                disabled={!isEditing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Saída (HH:MM)</label>
              <Input
                type="time"
                value={jornada.horario_saida || ''}
                onChange={(e) => setJornada({...jornada, horario_saida: e.target.value})}
                disabled={!isEditing}
              />
            </div>
          </div>

          {/* Carga Horária e Intervalo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Carga Semanal (horas)</label>
              <Input
                type="number"
                value={jornada.carga_semanal_horas || ''}
                onChange={(e) => setJornada({...jornada, carga_semanal_horas: parseFloat(e.target.value) || 0})}
                disabled={!isEditing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Intervalo (minutos)</label>
              <Input
                type="number"
                value={jornada.intervalo_minutos || ''}
                onChange={(e) => setJornada({...jornada, intervalo_minutos: parseInt(e.target.value) || 0})}
                disabled={!isEditing}
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium mb-2">Observações</label>
            <Input
              value={jornada.observacoes_jornada || ''}
              onChange={(e) => setJornada({...jornada, observacoes_jornada: e.target.value})}
              disabled={!isEditing}
              placeholder="Ex: Flexível, com home office 2x/semana"
            />
          </div>

          {isEditing && (
            <Button onClick={handleSaveRemuneracao} className="w-full">
              Salvar Jornada
            </Button>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RemuneracaoColab;
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, DollarSign, Package } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { confirmar } from '@/lib/confirmar';

export default function BeneficiosCustosExtras({ colaborador_id, onUpdate }) {
  const [novoBeneficio, setNovoBeneficio] = useState({ nome: '', valor_mensal: 0 });
  const [novoCusto, setNovoCusto] = useState({ descricao: '', valor_mensal: 0 });

  const { data: beneficios = [], refetch: refetchBeneficios } = useQuery({
    queryKey: ['colaborador-beneficios', colaborador_id],
    queryFn: () => base44.entities.ColaboradorBeneficio.filter({ colaborador_id }),
    enabled: !!colaborador_id
  });

  const { data: custos = [], refetch: refetchCustos } = useQuery({
    queryKey: ['colaborador-custos', colaborador_id],
    queryFn: () => base44.entities.ColaboradorCustoExtra.filter({ colaborador_id }),
    enabled: !!colaborador_id
  });

  const handleAddBeneficio = async () => {
    if (!novoBeneficio.nome || novoBeneficio.valor_mensal <= 0) {
      toast.error('Preencha nome e valor do benefício');
      return;
    }

    try {
      await base44.entities.ColaboradorBeneficio.create({
        colaborador_id,
        nome: novoBeneficio.nome,
        valor_mensal: novoBeneficio.valor_mensal,
        ativo: true
      });

      setNovoBeneficio({ nome: '', valor_mensal: 0 });
      refetchBeneficios();
      onUpdate?.();
      toast.success('Benefício adicionado');
    } catch (err) {
      toast.error('Erro ao adicionar benefício');
    }
  };

  const handleAddCusto = async () => {
    if (!novoCusto.descricao || novoCusto.valor_mensal <= 0) {
      toast.error('Preencha descrição e valor do custo');
      return;
    }

    try {
      await base44.entities.ColaboradorCustoExtra.create({
        colaborador_id,
        descricao: novoCusto.descricao,
        valor_mensal: novoCusto.valor_mensal,
        ativo: true
      });

      setNovoCusto({ descricao: '', valor_mensal: 0 });
      refetchCustos();
      onUpdate?.();
      toast.success('Custo adicionado');
    } catch (err) {
      toast.error('Erro ao adicionar custo');
    }
  };

  const handleToggleAtivo = async (id, tipo, ativo) => {
    try {
      if (tipo === 'beneficio') {
        await base44.entities.ColaboradorBeneficio.update(id, { ativo });
        refetchBeneficios();
      } else {
        await base44.entities.ColaboradorCustoExtra.update(id, { ativo });
        refetchCustos();
      }
      onUpdate?.();
      toast.success('Status atualizado');
    } catch (err) {
      toast.error('Erro ao atualizar');
    }
  };

  const handleRemove = async (id, tipo) => {
    if (!(await confirmar({ titulo: 'Remover item', descricao: 'Remover este item?', destrutivo: true, confirmar: 'Remover' }))) return;

    try {
      if (tipo === 'beneficio') {
        await base44.entities.ColaboradorBeneficio.delete(id);
        refetchBeneficios();
      } else {
        await base44.entities.ColaboradorCustoExtra.delete(id);
        refetchCustos();
      }
      onUpdate?.();
      toast.success('Item removido');
    } catch (err) {
      toast.error('Erro ao remover');
    }
  };

  const totalBeneficios = beneficios.filter(b => b.ativo).reduce((sum, b) => sum + (b.valor_mensal || 0), 0);
  const totalCustos = custos.filter(c => c.ativo).reduce((sum, c) => sum + (c.valor_mensal || 0), 0);

  return (
    <div className="space-y-6">
      {/* Benefícios */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <h4 className="font-semibold text-gray-900">Benefícios</h4>
          </div>
          <p className="text-sm font-bold text-blue-700">
            Total: R$ {totalBeneficios.toFixed(2)}
          </p>
        </div>

        {beneficios.length > 0 && (
          <div className="space-y-2">
            {beneficios.map(b => (
              <div key={b.id} className="flex items-center justify-between bg-white rounded p-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={b.ativo}
                    onCheckedChange={(checked) => handleToggleAtivo(b.id, 'beneficio', checked)}
                  />
                  <div>
                    <p className="text-sm font-medium">{b.nome}</p>
                    <p className="text-xs text-gray-500">R$ {b.valor_mensal?.toFixed(2)}/mês</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(b.id, 'beneficio')}
                  className="text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="Nome (VR, VT, Plano Saúde)"
            value={novoBeneficio.nome}
            onChange={(e) => setNovoBeneficio({ ...novoBeneficio, nome: e.target.value })}
            className="text-sm"
          />
          <Input
            type="number"
            step="0.01"
            placeholder="Valor R$"
            value={novoBeneficio.valor_mensal || ''}
            onChange={(e) => setNovoBeneficio({ ...novoBeneficio, valor_mensal: parseFloat(e.target.value) || 0 })}
            className="text-sm w-32"
          />
          <Button onClick={handleAddBeneficio} size="sm">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Custos Extras */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-600" />
            <h4 className="font-semibold text-gray-900">Custos Extras</h4>
          </div>
          <p className="text-sm font-bold text-amber-700">
            Total: R$ {totalCustos.toFixed(2)}
          </p>
        </div>

        {custos.length > 0 && (
          <div className="space-y-2">
            {custos.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-white rounded p-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={c.ativo}
                    onCheckedChange={(checked) => handleToggleAtivo(c.id, 'custo', checked)}
                  />
                  <div>
                    <p className="text-sm font-medium">{c.descricao}</p>
                    <p className="text-xs text-gray-500">R$ {c.valor_mensal?.toFixed(2)}/mês</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(c.id, 'custo')}
                  className="text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="Descrição (Uniforme, EPI, Treinamento)"
            value={novoCusto.descricao}
            onChange={(e) => setNovoCusto({ ...novoCusto, descricao: e.target.value })}
            className="text-sm"
          />
          <Input
            type="number"
            step="0.01"
            placeholder="Valor R$"
            value={novoCusto.valor_mensal || ''}
            onChange={(e) => setNovoCusto({ ...novoCusto, valor_mensal: parseFloat(e.target.value) || 0 })}
            className="text-sm w-32"
          />
          <Button onClick={handleAddCusto} size="sm">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

export default function SeletorKit({ empresaId, onAplicarKit, materiaisExistentes = [] }) {
  const [kitSelecionado, setKitSelecionado] = useState('');

  const { data: kits = [] } = useQuery({
    queryKey: ['kits', empresaId],
    queryFn: () => base44.entities.KitMaterial.filter({ empresa_id: empresaId }),
    enabled: !!empresaId
  });

  const handleAplicarKit = (kit) => {
    const materiaisDoKit = kit.materiais || [];
    const materiaisJaAdicionados = materiaisExistentes.map(m => m.material_id);
    
    const novosMateriais = materiaisDoKit.filter(
      m => !materiaisJaAdicionados.includes(m.material_id)
    );

    if (novosMateriais.length === 0) {
      toast.info('Todos os materiais deste kit já foram adicionados');
      return;
    }

    novosMateriais.forEach(mat => {
      onAplicarKit?.({
        material_id: mat.material_id,
        material_nome: mat.material_nome,
        quantidade_inventario: '',
        quantidade_teorica: mat.quantidade_padrao || '',
        motivo_diferenca: ''
      });
    });

    toast.success(`${novosMateriais.length} material(is) do kit adicionado(s)`);
    setKitSelecionado('');
  };

  if (kits.length === 0) return null;

  return (
    <Card className="bg-gray-800 border-gray-700 mb-4">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="text-sm text-gray-400">Usar Kit Rápido:</div>
          <div className="flex gap-2">
            <Select value={kitSelecionado} onValueChange={setKitSelecionado}>
              <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                <SelectValue placeholder="Selecione um kit..." />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {kits.map(kit => (
                  <SelectItem key={kit.id} value={kit.id}>
                    {kit.nome} ({kit.materiais?.length || 0} itens)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              onClick={() => {
                const kit = kits.find(k => k.id === kitSelecionado);
                if (kit) handleAplicarKit(kit);
              }}
              disabled={!kitSelecionado}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Aplicar Kit
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
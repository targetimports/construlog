import React, { useState } from 'react';
import { ListSkeleton } from '@/components/shared/Skeletons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function OperacoesObra({ obraId, tipo }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  // Map de tipos de operação para entidades
  const tipoMap = {
    material: { entity: 'Material', label: 'Material' },
    mao_obra: { entity: 'MaoDeObra', label: 'Mão de Obra' },
    alimentacao: { entity: 'Alimentacao', label: 'Alimentação' },
    aluguel: { entity: 'AluguelEquipamento', label: 'Aluguel' },
    frete: { entity: 'Frete', label: 'Frete' },
    estadia: { entity: 'Estadia', label: 'Estadia' },
    imposto: { entity: 'Imposto', label: 'Imposto' },
    investimento: { entity: 'Investimento', label: 'Investimento' },
    retirada: { entity: 'Retirada', label: 'Retirada' },
    empreita: { entity: 'Empreita', label: 'Empreita' },
    nf: { entity: 'NotaFiscal', label: 'Nota Fiscal' }
  };

  const config = tipoMap[tipo];

  const { data: operacoes = [], isLoading } = useQuery({
    queryKey: [tipo, obraId],
    queryFn: async () => {
      try {
        const allData = await base44.entities[config.entity].list();
        // Filtra localmente por obra_id
        return allData.filter(item => item.obra_id === obraId);
      } catch (e) {
        console.error(`Erro ao buscar ${config.entity}:`, e);
        return [];
      }
    },
    enabled: !!obraId
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities[config.entity].delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tipo, obraId] });
    }
  });

  if (!config) return <p className="text-red-500">Tipo inválido</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{config.label}</h3>
        <Button 
          size="sm" 
          onClick={() => setShowForm(true)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo {config.label}
        </Button>
      </div>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : operacoes.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-gray-500">Nenhum {config.label.toLowerCase()} registrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {operacoes.map(op => (
            <Card key={op.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4 px-6 flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium">{op.descricao || op.nome || op.descricao_material || 'Sem descrição'}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline">{new Date(op.data).toLocaleDateString('pt-BR')}</Badge>
                    <Badge className="bg-blue-100 text-blue-800">
                      R$ {(op.valor || op.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(op.id)}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
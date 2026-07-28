import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Plus } from 'lucide-react';

export default function BuscaComposicaoDialog({ open, onClose, onSelect }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComp, setSelectedComp] = useState(null);
  const [quantidade, setQuantidade] = useState('1');

  const { data: composicoes = [], isLoading } = useQuery({
    queryKey: ['composicoes-busca', searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 2) return [];
      
      const results = await base44.entities.Composicao.list('-created_date', 50);
      
      return results.filter(c => 
        c.ativo &&
        (c.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         c.descricao?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    },
    enabled: open && searchTerm.length >= 2
  });

  const handleAdd = () => {
    if (selectedComp && quantidade > 0) {
      onSelect(selectedComp, quantidade);
      setSelectedComp(null);
      setQuantidade('1');
      setSearchTerm('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buscar Composição</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Digite código ou descrição (mín. 2 caracteres)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          {/* Resultados */}
          <div className="max-h-96 overflow-y-auto space-y-2">
            {isLoading ? (
              <p className="text-center text-gray-600 py-8">Buscando...</p>
            ) : composicoes.length === 0 ? (
              <p className="text-center text-gray-600 py-8">
                {searchTerm.length < 2 
                  ? 'Digite pelo menos 2 caracteres para buscar'
                  : 'Nenhuma composição encontrada'
                }
              </p>
            ) : (
              composicoes.map((comp) => (
                <div
                  key={comp.id}
                  onClick={() => setSelectedComp(comp)}
                  className={`
                    border rounded-lg p-4 cursor-pointer transition-all
                    ${selectedComp?.id === comp.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-gray-600">{comp.codigo}</span>
                        <Badge variant="outline">{comp.unidade}</Badge>
                        <Badge variant="secondary">{comp.fonte}</Badge>
                      </div>
                      <p className="text-gray-900 font-medium">{comp.descricao}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm text-gray-600">Custo Unit.</p>
                      <p className="text-lg font-bold text-gray-900">
                        {(comp.custo_unitario || 0).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        })}
                      </p>
                      {comp.bdi_padrao > 0 && (
                        <p className="text-xs text-gray-600">
                          +{comp.bdi_padrao}% BDI
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quantidade */}
          {selectedComp && (
            <div className="border-t border-gray-200 pt-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-900">{selectedComp.descricao}</p>
                    <p className="text-sm text-gray-600">{selectedComp.codigo}</p>
                  </div>
                  <Badge className="bg-blue-600 text-white">Selecionado</Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Quantidade *</Label>
                    <Input
                      type="number"
                      value={quantidade}
                      onChange={(e) => setQuantidade(e.target.value)}
                      min="0.01"
                      step="0.01"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Valor Total</Label>
                    <div className="mt-1.5 h-10 flex items-center">
                      <span className="text-xl font-bold text-blue-600">
                        {(quantidade * (selectedComp.custo_unitario || 0) * 
                          (1 + (selectedComp.bdi_padrao || 0) / 100)).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleAdd} 
            disabled={!selectedComp || quantidade <= 0}
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar ao Orçamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
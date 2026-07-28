import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Download, Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ImportarEstruturaOrcamento({ obraId, onImportar }) {
  const [dialog, setDialog] = useState(false);
  const [etapasSelecionadas, setEtapasSelecionadas] = useState([]);

  const { data: orcamentos = [] } = useQuery({
    queryKey: ['orcamentos', obraId],
    queryFn: () => base44.entities.Orcamento.filter({ obra_id: obraId }),
    enabled: !!obraId && dialog
  });

  const { data: itensOrcamento = [] } = useQuery({
    queryKey: ['itens-orcamento', orcamentos[0]?.id],
    queryFn: () => base44.entities.ItemOrcamento.filter({ orcamento_id: orcamentos[0]?.id }),
    enabled: orcamentos.length > 0 && dialog
  });

  // Agrupar por etapa
  const etapas = [...new Set(itensOrcamento.map(i => i.etapa).filter(Boolean))];
  const itensPorEtapa = etapas.reduce((acc, etapa) => {
    acc[etapa] = itensOrcamento.filter(i => i.etapa === etapa);
    return acc;
  }, {});

  const toggleEtapa = (etapa) => {
    if (etapasSelecionadas.includes(etapa)) {
      setEtapasSelecionadas(etapasSelecionadas.filter(e => e !== etapa));
    } else {
      setEtapasSelecionadas([...etapasSelecionadas, etapa]);
    }
  };

  const importar = () => {
    const itensParaImportar = [];
    
    etapasSelecionadas.forEach(etapa => {
      const itens = itensPorEtapa[etapa] || [];
      itens.forEach(item => {
        itensParaImportar.push({
          item_orcamento_id: item.id,
          descricao: item.descricao,
          unidade: item.unidade,
          quantidade_orcada: item.quantidade,
          quantidade_executada: 0,
          quantidade_periodo: 0,
          percentual_executado: 0,
          valor_unitario: item.valor_unitario || 0,
          valor_total: 0,
          etapa: item.etapa
        });
      });
    });

    onImportar(itensParaImportar);
    setEtapasSelecionadas([]);
    setDialog(false);
    toast.success(`${itensParaImportar.length} itens importados do orçamento`);
  };

  if (!obraId) return null;

  return (
    <>
      <Button
        onClick={() => setDialog(true)}
        variant="outline"
        className="border-gray-700 text-gray-400 gap-2"
      >
        <Download className="w-4 h-4" />
        Importar do Orçamento
      </Button>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-white">Importar Estrutura do Orçamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {orcamentos.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500">Nenhum orçamento encontrado para esta obra</p>
              </div>
            ) : (
              <>
                <p className="text-gray-400 text-sm">
                  Selecione as etapas do orçamento que deseja importar:
                </p>
                
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {etapas.map(etapa => {
                    const itens = itensPorEtapa[etapa] || [];
                    const selecionada = etapasSelecionadas.includes(etapa);
                    const valorTotal = itens.reduce((sum, i) => sum + (i.valor_total || 0), 0);

                    return (
                      <div
                        key={etapa}
                        onClick={() => toggleEtapa(etapa)}
                        className={cn(
                          "p-4 rounded-lg border cursor-pointer transition-all",
                          selecionada
                            ? "bg-blue-500/20 border-blue-500"
                            : "bg-gray-800 border-gray-700 hover:border-gray-600"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <Checkbox checked={selecionada} className="mt-1" />
                            <div>
                              <p className="text-white font-semibold">{etapa}</p>
                              <div className="flex gap-3 mt-2">
                                <Badge className="bg-gray-700 text-gray-300 border-0">
                                  {itens.length} itens
                                </Badge>
                                <span className="text-emerald-400 text-sm font-semibold">
                                  {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                  <span className="text-gray-400 text-sm">
                    {etapasSelecionadas.length} etapas selecionadas
                  </span>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setDialog(false)}
                      className="border-gray-700 text-gray-400"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={importar}
                      disabled={etapasSelecionadas.length === 0}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                      Importar
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
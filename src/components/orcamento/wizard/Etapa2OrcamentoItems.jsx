import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { base44 } from '@/api/base44Client';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

export default function Etapa2OrcamentoItems({ grupos = [], onConfirmar }) {
  const [expandedGroups, setExpandedGroups] = useState({});
  const [selecionados, setSelecionados] = useState(new Set());
  const [criandoDemandas, setCriandoDemandas] = useState(false);

  const toggleGroup = (groupNum) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupNum]: !prev[groupNum]
    }));
  };

  const toggleItem = (itemId) => {
    setSelecionados(prev => {
      const novo = new Set(prev);
      novo.has(itemId) ? novo.delete(itemId) : novo.add(itemId);
      return novo;
    });
  };

  const totalSelecionados = useMemo(() => {
    let total = 0;
    grupos.forEach(g => {
      (g.items || []).forEach(item => {
        if (selecionados.has(`${g.grupo_num}-${item.item_num}`)) {
          total += (item.quantidade || 0) * (item.valor_unitario || 0);
        }
      });
    });
    return total;
  }, [selecionados, grupos]);

  const handleCriarDemandas = async () => {
    if (selecionados.size === 0) {
      toast.error('Selecione pelo menos um item');
      return;
    }

    setCriandoDemandas(true);
    try {
      // Coletar itens selecionados
      const itensParaDemanda = [];
      grupos.forEach(g => {
        (g.items || []).forEach(item => {
          if (selecionados.has(`${g.grupo_num}-${item.item_num}`)) {
            itensParaDemanda.push({
              ...item,
              grupo_num: g.grupo_num,
              grupo_nome: g.grupo_nome
            });
          }
        });
      });

      onConfirmar({
        itens: itensParaDemanda,
        total: totalSelecionados,
        hash: Buffer.from(JSON.stringify(itensParaDemanda)).toString('base64').slice(0, 16)
      });

      toast.success(`${itensParaDemanda.length} itens selecionados para demanda`);
    } catch (error) {
      toast.error('Erro ao processar itens');
      console.error(error);
    } finally {
      setCriandoDemandas(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Etapa 2: Revisar Itens do Orçamento</CardTitle>
        <p className="text-sm text-gray-600 mt-2">
          Os materiais selecionados serão criados como DEMANDA PREVISTA da obra (não afeta estoque)
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-96 overflow-y-auto border rounded-lg">
          {grupos.map(grupo => (
            <div key={grupo.grupo_num} className="border-b last:border-b-0">
              <button
                onClick={() => toggleGroup(grupo.grupo_num)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 font-medium text-gray-900"
              >
                <span>{grupo.grupo_nome}</span>
                {expandedGroups[grupo.grupo_num] ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {expandedGroups[grupo.grupo_num] && (
                <div className="bg-gray-50 border-t space-y-2 p-3">
                  {(grupo.items || []).map(item => {
                    const itemId = `${grupo.grupo_num}-${item.item_num}`;
                    const isSelected = selecionados.has(itemId);
                    return (
                      <div key={itemId} className="flex items-start gap-3 p-2 hover:bg-gray-100 rounded">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleItem(itemId)}
                          className="mt-1"
                        />
                        <div className="flex-1 text-sm">
                          <p className="font-medium text-gray-900">{item.descricao}</p>
                          <p className="text-gray-600">
                            {item.quantidade} {item.unidade} × R$ {item.valor_unitario?.toFixed(2)}
                          </p>
                          <p className="text-gray-700 font-semibold">
                            Total: R$ {((item.quantidade || 0) * (item.valor_unitario || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <p className="text-sm text-gray-600">Total Selecionado</p>
          <p className="text-2xl font-bold text-gray-900">
            R$ {totalSelecionados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500">{selecionados.size} itens selecionados</p>
        </div>

        <Button
          onClick={handleCriarDemandas}
          disabled={selecionados.size === 0 || criandoDemandas}
          className="w-full"
        >
          {criandoDemandas ? 'Processando...' : 'Confirmar Itens'}
        </Button>
      </CardContent>
    </Card>
  );
}
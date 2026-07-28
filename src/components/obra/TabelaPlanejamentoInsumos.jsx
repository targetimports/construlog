import React, { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { IndicadorConsumo, BarraConsumo, calcularStatusConsumo } from '@/components/shared/IndicadorConsumo';

const UNIDADES = ['un', 'm', 'm2', 'm3', 'kg', 'l', 'sc', 'caixa', 'barra', 'outro'];

export default function TabelaPlanejamentoInsumos({
  obraId,
  etapaId,
  insumos,
  onInsumoAdicionado,
  onInsumoRemovido
}) {
  const [novoInsumo, setNovoInsumo] = useState({
    descricao: '',
    unidade: 'un',
    quantidade: 0
  });
  const [mostrarForm, setMostrarForm] = useState(false);
  const [edicoes, setEdicoes] = useState({});

  // Buscar solicitações aprovadas/entregues para calcular consumido
  const { data: solicitacoes = [] } = useQuery({
    queryKey: ['solicitacoes-etapa', obraId, etapaId],
    queryFn: async () => {
      if (!obraId || !etapaId) return [];
      const items = await base44.entities.MaterialSolicitado.filter({
        obra_id: obraId,
        etapa_obra_id: etapaId
      });
      return items || [];
    },
    enabled: !!obraId && !!etapaId
  });

  // Calcular consumido por insumo
  const consumoPorInsumo = useMemo(() => {
    const map = {};
    solicitacoes
      .filter(s => ['aprovado', 'entregue'].includes(s.status))
      .forEach(s => {
        const key = s.descricao;
        map[key] = (map[key] || 0) + (s.quantidade || 0);
      });
    return map;
  }, [solicitacoes]);

  const createMutation = useMutation({
    mutationFn: async (dados) => {
      return base44.entities.PlanejamentoInsumoEtapa.create({
        obra_id: obraId,
        etapa_obra_id: etapaId,
        descricao_insumo: dados.descricao,
        unidade: dados.unidade,
        quantidade_planejada: parseFloat(dados.quantidade),
        fonte: 'MANUAL'
      });
    },
    onSuccess: () => {
      toast.success('Insumo adicionado');
      setNovoInsumo({ descricao: '', unidade: 'un', quantidade: 0 });
      setMostrarForm(false);
      onInsumoAdicionado();
    },
    onError: () => toast.error('Erro ao adicionar insumo')
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, quantidadeAjustada }) => {
      return base44.entities.PlanejamentoInsumoEtapa.update(id, {
        quantidade_ajustada: quantidadeAjustada
      });
    },
    onSuccess: () => {
      toast.success('Quantidade atualizada');
      setEdicoes({});
      onInsumoAdicionado();
    },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return base44.entities.PlanejamentoInsumoEtapa.delete(id);
    },
    onSuccess: () => {
      toast.success('Insumo removido');
      onInsumoRemovido();
    },
    onError: () => toast.error('Erro ao remover')
  });

  const getQuantidadeEfetiva = (insumo) => {
    if (insumo.quantidade_ajustada !== null && insumo.quantidade_ajustada !== undefined) {
      return insumo.quantidade_ajustada;
    }
    return insumo.quantidade_planejada;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Insumos da Etapa</CardTitle>
        </div>
        <Button
          size="sm"
          onClick={() => setMostrarForm(!mostrarForm)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          {mostrarForm ? 'Cancelar' : 'Adicionar Insumo'}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* FORMULÁRIO NOVO */}
        {mostrarForm && (
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Descrição do insumo"
                value={novoInsumo.descricao}
                onChange={(e) => setNovoInsumo({ ...novoInsumo, descricao: e.target.value })}
              />
              <Select value={novoInsumo.unidade} onValueChange={(v) => setNovoInsumo({ ...novoInsumo, unidade: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Input
              type="number"
              placeholder="Quantidade planejada"
              value={novoInsumo.quantidade}
              onChange={(e) => setNovoInsumo({ ...novoInsumo, quantidade: e.target.value })}
            />

            <Button
              onClick={() => createMutation.mutate(novoInsumo)}
              disabled={!novoInsumo.descricao || !novoInsumo.quantidade || createMutation.isPending}
              className="w-full"
            >
              Adicionar Insumo
            </Button>
          </div>
        )}

        {/* TABELA */}
        {insumos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Nenhum insumo planejado para esta etapa</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Insumo</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700 w-16">Und</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700 w-20">Planejado</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700 w-20">Consumido</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700 w-32">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Obs</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700 w-16">Ações</th>
                </tr>
              </thead>
              <tbody>
                {insumos.map((insumo) => {
                  const efetiva = getQuantidadeEfetiva(insumo);
                  const consumido = consumoPorInsumo[insumo.descricao_insumo] || 0;
                  
                  return (
                    <tr key={insumo.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-900 font-medium">{insumo.descricao_insumo}</td>
                      <td className="px-3 py-2 text-center text-gray-600">{insumo.unidade}</td>
                      <td className="px-3 py-2 text-center text-gray-900 font-semibold">{efetiva}</td>
                      <td className="px-3 py-2 text-center text-gray-900">{consumido}</td>
                      <td className="px-3 py-2 text-center">
                        <IndicadorConsumo consumido={consumido} planejado={efetiva} tamanho="sm" />
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">{insumo.observacao || '—'}</td>
                      <td className="px-3 py-2 text-center space-x-1 flex justify-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => deleteMutation.mutate(insumo.id)}
                        >
                          <Trash2 className="w-3 h-3 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
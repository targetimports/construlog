import React, { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useValidarExcessoPlanejado } from '@/components/shared/ValidadorExcessoPlanejado';
import { IndicadorConsumo } from '@/components/shared/IndicadorConsumo';

const UNIDADES = ['un', 'kg', 'm', 'm2', 'm3', 'l', 'sc', 'outro'];

export default function FormSolicitacaoComValidacao({ obraId, onSucesso }) {
  const [etapaObraId, setEtapaObraId] = useState('');
  const [itens, setItens] = useState([]);
  const [novoItem, setNovoItem] = useState({
    descricao: '',
    quantidade: 0,
    unidade: 'un',
    valor_unitario: 0
  });
  const [etapas, setEtapas] = useState([]);
  const { validar, DialogComponent, isLoading: loadingValidacao } = useValidarExcessoPlanejado();

  // Buscar etapas ao montar
  React.useEffect(() => {
    if (obraId) {
      base44.entities.EtapaObra.filter(
        { obra_id: obraId, ativo: true },
        'ordem'
      ).then(setEtapas);
    }
  }, [obraId]);

  // Buscar planejamento e solicitações aprovadas para indicadores
  const { data: indicadores = {} } = useQuery({
    queryKey: ['indicadores-etapa', obraId, etapaObraId, itens],
    queryFn: async () => {
      if (!obraId || !etapaObraId || itens.length === 0) return {};

      const map = {};

      for (const item of itens) {
        // Buscar planejado
        const planejamentos = await base44.entities.PlanejamentoInsumoEtapa.filter({
          obra_id: obraId,
          etapa_obra_id: etapaObraId,
          descricao_insumo: item.descricao
        });

        const planejado = planejamentos.length > 0
          ? planejamentos.reduce((sum, p) => {
              const efetiva = (p.quantidade_ajustada !== null && p.quantidade_ajustada !== undefined)
                ? p.quantidade_ajustada
                : p.quantidade_planejada;
              return sum + efetiva;
            }, 0)
          : 0;

        // Buscar consumido (aprovado/entregue)
        const solicitacoes = await base44.entities.MaterialSolicitado.filter({
          obra_id: obraId,
          etapa_obra_id: etapaObraId,
          descricao: item.descricao
        });

        const consumido = solicitacoes
          .filter(s => ['aprovado', 'entregue'].includes(s.status))
          .reduce((sum, s) => sum + (s.quantidade || 0), 0);

        map[item.id] = { planejado, consumido, novo: item.quantidade };
      }

      return map;
    },
    enabled: !!obraId && !!etapaObraId && itens.length > 0,
    staleTime: 5000
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!etapaObraId) {
        throw new Error('Selecione uma etapa');
      }
      if (itens.length === 0) {
        throw new Error('Adicione pelo menos um item');
      }

      // Validar cada item contra o planejado
      for (const item of itens) {
        const validacao = await validar(
          obraId,
          etapaObraId,
          item.descricao,
          item.unidade,
          item.quantidade
        );

        if (!validacao) return; // Usuário cancelou na validação
      }

      // Criar solicitações
      const solicitacoes = await Promise.all(
        itens.map(item =>
          base44.entities.MaterialSolicitado.create({
            obra_id: obraId,
            etapa_obra_id: etapaObraId,
            descricao: item.descricao,
            quantidade: item.quantidade,
            unidade: item.unidade,
            valor_unitario: item.valor_unitario || 0,
            status: 'solicitado',
            motivo: 'demanda_manual',
            excedente_planejado: item.excedente || false,
            justificativa_excesso: item.justificativa || null,
            planejado_etapa: item.planejadoSnapshot || 0,
            consumido_anterior: item.consumidoSnapshot || 0
          })
        )
      );

      return solicitacoes;
    },
    onSuccess: () => {
      toast.success('Solicitação criada com sucesso');
      setItens([]);
      setEtapaObraId('');
      setNovoItem({ descricao: '', quantidade: 0, unidade: 'un', valor_unitario: 0 });
      if (onSucesso) onSucesso();
    },
    onError: (err) => {
      toast.error(`${err.message}`);
    }
  });

  const addItem = () => {
    if (!novoItem.descricao || !novoItem.quantidade) {
      toast.error('Preencha todos os campos');
      return;
    }

    setItens([...itens, { ...novoItem, id: Date.now() }]);
    setNovoItem({ descricao: '', quantidade: 0, unidade: 'un', valor_unitario: 0 });
  };

  const removeItem = (id) => {
    setItens(itens.filter(i => i.id !== id));
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Nova Solicitação de Materiais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selecionar etapa */}
          <div>
            <Label htmlFor="etapa">Etapa <span className="text-red-600">*</span></Label>
            <Select value={etapaObraId} onValueChange={setEtapaObraId}>
              <SelectTrigger id="etapa">
                <SelectValue placeholder="Selecione uma etapa" />
              </SelectTrigger>
              <SelectContent>
                {etapas.map(etapa => (
                  <SelectItem key={etapa.id} value={etapa.id}>
                    {etapa.nome_etapa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Adicionar itens */}
          {etapaObraId && (
            <div className="border-t pt-4 space-y-3">
              <h3 className="font-medium text-gray-900">Adicionar Itens</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  placeholder="Descrição do material"
                  value={novoItem.descricao}
                  onChange={(e) => setNovoItem({ ...novoItem, descricao: e.target.value })}
                />

                <Input
                  type="number"
                  placeholder="Quantidade"
                  value={novoItem.quantidade}
                  onChange={(e) => setNovoItem({ ...novoItem, quantidade: parseFloat(e.target.value) || 0 })}
                />

                <Select value={novoItem.unidade} onValueChange={(v) => setNovoItem({ ...novoItem, unidade: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Input
                type="number"
                placeholder="Valor unitário (opcional)"
                value={novoItem.valor_unitario}
                onChange={(e) => setNovoItem({ ...novoItem, valor_unitario: parseFloat(e.target.value) || 0 })}
              />

              <Button
                onClick={addItem}
                variant="outline"
                className="w-full gap-2"
              >
                <Plus className="w-4 h-4" />
                Adicionar Item
              </Button>
            </div>
          )}

          {/* Tabela de itens */}
          {itens.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-900 mb-3">Itens da Solicitação</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-3 py-2 text-left">Material</th>
                      <th className="px-3 py-2 text-center w-16">Qtd</th>
                      <th className="px-3 py-2 text-center w-12">Und</th>
                      <th className="px-3 py-2 text-center w-40">Status</th>
                      <th className="px-3 py-2 text-right w-24">Valor Unit.</th>
                      <th className="px-3 py-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map(item => {
                      const ind = indicadores[item.id];
                      const novoTotal = ind ? (ind.consumido + ind.novo) : 0;

                      return (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2">{item.descricao}</td>
                          <td className="px-3 py-2 text-center">{item.quantidade}</td>
                          <td className="px-3 py-2 text-center text-gray-600">{item.unidade}</td>
                          <td className="px-3 py-2 text-center">
                            {ind ? (
                              <div className="space-y-1">
                                <IndicadorConsumo consumido={novoTotal} planejado={ind.planejado} tamanho="sm" />
                                <div className="text-xs text-gray-600">
                                  {ind.planejado > 0 && novoTotal > ind.planejado && (
                                    <span className="text-red-600 font-medium">
                                      Excedente: +{(novoTotal - ind.planejado).toFixed(1)} {item.unidade}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {item.valor_unitario > 0 ? `R$ ${item.valor_unitario.toFixed(2)}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => removeItem(item.id)}
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
            </div>
          )}

          {/* Botão enviar */}
          <Button
            onClick={() => createMutation.mutate()}
            disabled={itens.length === 0 || !etapaObraId || createMutation.isPending || loadingValidacao}
            className="w-full"
          >
            {createMutation.isPending ? 'Criando...' : 'Criar Solicitação'}
          </Button>
        </CardContent>
      </Card>

      <DialogComponent />
    </>
  );
}
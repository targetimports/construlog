import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { formatBRL } from '@/components/shared/moneyBR';

export default function BMTabelaItens({ bm_id, contrato_versao_id, statusBM, prefixFilter = null }) {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState({});

  // Buscar BMItems com ContratoItems associados
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['bmItens', bm_id],
    queryFn: async () => {
      const bmItems = await base44.entities.BMItem.filter({ bm_id });
      if (!bmItems.length) return [];

      // Carregar ContratoItems para obter descrição e ordem
      const contratoItems = await base44.entities.ContratoItem.filter({
        contrato_versao_id,
      });

      const itemsComContrato = bmItems.map(bmi => {
        const ci = contratoItems.find(c => c.id === bmi.contrato_item_id);
        return { ...bmi, contratoItem: ci || {} };
      });

      // Ordenar por ordem do ContratoItem
      return itemsComContrato.sort(
        (a, b) => (a.contratoItem.ordem || 0) - (b.contratoItem.ordem || 0)
      );
    },
  });

  // Buscar regras de dependência para badge AUTO
  const { data: regras = {} } = useQuery({
    queryKey: ['regrasDependencia', contrato_versao_id],
    queryFn: async () => {
      const todasRegras = await base44.entities.RegraDependenciaItem.filter({
        contrato_versao_id,
        tipo: 'BM_PERIODO',
      });
      // Mapear por target_codigo para lookup rápido
      return todasRegras.reduce((acc, r) => {
        acc[r.target_codigo] = r;
        return acc;
      }, {});
    },
  });

  // Mutation para salvar qtd_periodo_input
  const updateMutation = useMutation({
    mutationFn: async ({ bm_item_id, qtd_periodo_input, override_manual }) => {
      await base44.entities.BMItem.update(bm_item_id, {
        qtd_periodo_input: parseFloat(qtd_periodo_input),
        override_manual,
      });
      return { bm_item_id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bmItens', bm_id] });
      queryClient.invalidateQueries({ queryKey: ['bm', bm_id] });
      setEditando({});
    },
  });

  const handleSave = (bmItem) => {
    const valor = editando[bmItem.id]?.valor ?? bmItem.qtd_periodo_input;
    const override = editando[bmItem.id]?.override ?? bmItem.override_manual;
    updateMutation.mutate({
      bm_item_id: bmItem.id,
      qtd_periodo_input: valor,
      override_manual: override,
    });
  };

  const temDependencia = (item_codigo) => !!regras[item_codigo];

  if (isLoading)
    return <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  // BM APROVADA: totalmente bloqueada
  // BM RETIFICADA: permite edição
  const isLocked = statusBM === 'APROVADA';

  // Filtro por prefixo (grupo): exibe itens com item_codigo === prefixo OU começando com "prefixo."
  const matchPrefix = (code) => {
    if (!prefixFilter) return true;
    if (!code) return false;
    return code === prefixFilter || code.startsWith(prefixFilter + '.');
  };
  const visibleItems = (items || []).filter((it) => matchPrefix(it.contratoItem?.item_codigo));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-100 border-b border-slate-300">
            <th className="text-left p-3 font-semibold">Item</th>
            <th className="text-left p-3 font-semibold">Descrição</th>
            <th className="text-center p-3 font-semibold">Unid</th>
            <th colSpan="3" className="text-center p-3 font-semibold bg-blue-50">Contrato</th>
            <th colSpan="2" className="text-center p-3 font-semibold bg-slate-50">Anterior</th>
            <th colSpan="3" className="text-center p-3 font-semibold bg-green-50">Período</th>
            <th colSpan="2" className="text-center p-3 font-semibold bg-slate-50">Acumulado</th>
            <th colSpan="2" className="text-center p-3 font-semibold bg-red-50">Saldo</th>
          </tr>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th colSpan="3"></th>
            <th className="text-center p-2 font-normal text-xs">Qtd</th>
            <th className="text-center p-2 font-normal text-xs">Preço Unit</th>
            <th className="text-center p-2 font-normal text-xs">Total</th>
            <th className="text-center p-2 font-normal text-xs">Qtd</th>
            <th className="text-center p-2 font-normal text-xs">Valor</th>
            <th className="text-center p-2 font-normal text-xs">Qtd</th>
            <th className="text-center p-2 font-normal text-xs">Valor</th>
            <th className="text-center p-2 font-normal text-xs">Ov</th>
            <th className="text-center p-2 font-normal text-xs">Qtd</th>
            <th className="text-center p-2 font-normal text-xs">Valor</th>
            <th className="text-center p-2 font-normal text-xs">Qtd</th>
            <th className="text-center p-2 font-normal text-xs">Valor</th>
          </tr>
        </thead>
        <tbody>
          {visibleItems.map((item) => {
            const ci = item.contratoItem;
            const isDependente = temDependencia(ci.item_codigo);
            const isEditing = !!editando[item.id];
            const qtdValue = isEditing ? editando[item.id].valor : item.qtd_periodo_input;
            const overrideValue = isEditing ? editando[item.id].override : item.override_manual;

            return (
              <tr
                key={item.id}
                className="border-b border-slate-200 hover:bg-slate-50"
              >
                <td className="p-3 font-medium">{ci.item_codigo}</td>
                <td className="p-3 text-slate-700">{ci.descricao}</td>
                <td className="text-center p-3">{ci.unidade}</td>

                {/* CONTRATO */}
                <td className="text-center p-3 bg-blue-50">{ci.qtd_contrato?.toFixed(4)}</td>
                <td className="text-center p-3 bg-blue-50">{formatBRL(ci.preco_unit_com_bdi)}</td>
                <td className="text-center p-3 bg-blue-50">{formatBRL(ci.preco_total)}</td>

                {/* ANTERIOR */}
                <td className="text-center p-3 bg-slate-50">{item.qtd_anterior?.toFixed(4)}</td>
                <td className="text-center p-3 bg-slate-50">{formatBRL(item.vl_anterior)}</td>

                {/* PERÍODO */}
                <td className="text-center p-3 bg-green-50">
                  {isDependente ? (
                    <Badge variant="outline" className="text-xs">AUTO</Badge>
                  ) : null}
                </td>
                <td className="text-center p-3 bg-green-50">
                  {isDependente && !overrideValue && statusBM !== 'RETIFICADA' ? (
                    <span className="text-slate-500 italic">{item.qtd_periodo_final?.toFixed(4)}</span>
                  ) : (
                    <Input
                      type="number"
                      step="0.01"
                      value={isEditing ? qtdValue : item.qtd_periodo_input}
                      onChange={(e) =>
                        setEditando({
                          ...editando,
                          [item.id]: { ...editando[item.id], valor: e.target.value },
                        })
                      }
                      disabled={isLocked || (isDependente && !overrideValue && statusBM !== 'RETIFICADA')}
                      className="w-20 text-center text-xs"
                    />
                  )}
                </td>
                <td className="text-center p-3 bg-green-50">{formatBRL(item.vl_periodo)}</td>

                {/* ACUMULADO */}
                <td className="text-center p-3 bg-slate-50">{item.qtd_acumulada?.toFixed(4)}</td>
                <td className="text-center p-3 bg-slate-50">{formatBRL(item.vl_acumulado)}</td>

                {/* SALDO */}
                <td className="text-center p-3 bg-red-50">{item.qtd_saldo?.toFixed(4)}</td>
                <td className="text-center p-3 bg-red-50">{formatBRL(item.vl_saldo)}</td>

                {/* OVERRIDE (se tem dependência) */}
                {isDependente && (
                  <td className="text-center p-3">
                    <Toggle
                      pressed={overrideValue}
                      onPressedChange={(pressed) =>
                        setEditando({
                          ...editando,
                          [item.id]: { ...editando[item.id], override: pressed },
                        })
                      }
                      disabled={isLocked}
                      className="text-xs"
                      title="Sobrepor cálculo automático"
                    >
                      {overrideValue ? 'M' : 'A'}
                    </Toggle>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Botões de ação */}
      {Object.keys(editando).length > 0 && !isLocked && (
        <div className="flex gap-2 mt-4 p-4 bg-blue-50 rounded-lg">
          <Button
            onClick={() => {
              // Salvar todas as mudanças em editando
              const bmItemsToUpdate = items.filter((item) => editando[item.id]);
              bmItemsToUpdate.forEach((item) => handleSave(item));
            }}
            disabled={updateMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar Alterações
          </Button>
          <Button
            onClick={() => setEditando({})}
            variant="outline"
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}
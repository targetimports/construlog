import React from 'react';
import { Input } from '@/components/ui/input';

export default function BMItemRow({ contratoItem, bmItem, previewItem, onChangeQty }) {
  const qtdAnterior = Number(bmItem?.qtd_anterior || 0);
  const qtdPeriodo = Number(previewItem?.qtd_periodo_input ?? bmItem?.qtd_periodo_input ?? 0);
  const precoUnit = Number(contratoItem?.preco_unit_com_bdi || 0);
  const vlPeriodo = Number((qtdPeriodo * precoUnit).toFixed(2));

  return (
    <tr className="text-sm">
      <td className="py-2 px-2">{contratoItem?.item_codigo}</td>
      <td className="py-2 px-2">{contratoItem?.descricao}</td>
      <td className="py-2 px-2 text-right">{contratoItem?.unidade}</td>
      <td className="py-2 px-2 text-right">{Number(contratoItem?.qtd_contrato || 0)}</td>
      <td className="py-2 px-2 text-right">{qtdAnterior}</td>
      <td className="py-2 px-2 w-32">
        <Input
          type="number"
          step="0.000001"
          value={qtdPeriodo}
          onChange={(e) => onChangeQty(contratoItem.id, Number(e.target.value))}
        />
      </td>
      <td className="py-2 px-2 text-right">{precoUnit.toFixed(6)}</td>
      <td className="py-2 px-2 text-right">{vlPeriodo.toFixed(2)}</td>
    </tr>
  );
}
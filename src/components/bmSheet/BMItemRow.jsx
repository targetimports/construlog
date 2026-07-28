import React from "react";

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function BMItemRow({ item, contratoItem, onQtyChange, onQtyBlur, locked = false }) {
  const pu = contratoItem?.preco_unit_com_bdi ?? 0;
  const qtdContrato = contratoItem?.qtd_contrato ?? 0;
  const precoTotalContrato = contratoItem?.preco_total ?? (qtdContrato * pu);

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-3 whitespace-nowrap text-gray-700">{contratoItem?.item_codigo}</td>
      <td className="py-2 pr-3 text-gray-700">{contratoItem?.descricao}</td>
      <td className="py-2 pr-3">{contratoItem?.unidade}</td>

      {/* Contrato */}
      <td className="py-2 pr-3 text-right">{qtdContrato}</td>
      <td className="py-2 pr-3 text-right">{currency.format(pu || 0)}</td>
      <td className="py-2 pr-3 text-right font-medium">{currency.format(precoTotalContrato || 0)}</td>

      {/* Anterior */}
      <td className="py-2 pr-3 text-right">{item?.qtd_anterior ?? 0}</td>
      <td className="py-2 pr-3 text-right">{currency.format(item?.vl_anterior || 0)}</td>

      {/* Período */}
      <td className="py-2 pr-3 text-right">
        <input
          type="number"
          step="0.000001"
          className="w-28 rounded-md border border-gray-300 px-2 py-1 text-right disabled:bg-gray-100"
          value={item?.qtd_periodo_input ?? 0}
          onChange={(e) => onQtyChange && !locked && onQtyChange(contratoItem.id, e.target.value)}
          onBlur={() => onQtyBlur && !locked && onQtyBlur(contratoItem.id)}
          disabled={locked}
        />
      </td>
      <td className="py-2 pr-3 text-right">{currency.format(item?.vl_periodo || 0)}</td>

      {/* Acumulado */}
      <td className="py-2 pr-3 text-right">{item?.qtd_acumulada ?? 0}</td>
      <td className="py-2 pr-3 text-right">{currency.format(item?.vl_acumulado || 0)}</td>

      {/* Saldo */}
      <td className="py-2 pr-3 text-right">{item?.qtd_saldo ?? 0}</td>
      <td className="py-2 pr-3 text-right">{currency.format(item?.vl_saldo || 0)}</td>
    </tr>
  );
}
import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtQtd = (v) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(v) || 0);
const fmtBRL = (v) => currency.format(Number(v) || 0);

// Tabela de itens do contrato no MESMO padrão visual da planilha de medição (BMDetalhes):
// header cinza, grupos de colunas coloridos (Contrato / Com BDI), números tabulares à
// direita, contagem no topo e cards no mobile.
export default function ContratoItensTable({ items, onEdit }) {
  const total = useMemo(
    () => (items || []).reduce((s, it) => s + (Number(it.preco_total) || 0), 0),
    [items]
  );

  if (!items || items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-gray-500">Nenhum item cadastrado.</CardContent>
      </Card>
    );
  }

  const pesoDe = (it) => (total > 0 ? ((Number(it.preco_total) || 0) / total) * 100 : 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Itens do Contrato
          <span className="ml-2 text-xs text-gray-500 font-normal">({items.length} {items.length === 1 ? 'item' : 'itens'})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Desktop: planilha larga com rolagem */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[860px]">
            <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10 text-gray-700">
              <tr>
                <th className="px-3 py-3 text-left font-semibold">Cód</th>
                <th className="px-3 py-3 text-left font-semibold">Descrição</th>
                <th className="px-3 py-3 text-left font-semibold">Un.</th>
                <th className="px-3 py-3 text-right font-semibold">Peso</th>
                <th colSpan="2" className="text-center font-semibold bg-blue-50 border-l border-blue-200 py-3">Contrato (Qtd · P.Unit)</th>
                <th colSpan="2" className="text-center font-semibold bg-green-50 border-l border-green-200 py-3">Com BDI (P.Unit · Total)</th>
                <th className="px-3 py-3 text-right font-semibold border-l border-gray-200">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">{it.item_codigo || '—'}</td>
                  <td className="px-3 py-2.5 max-w-[280px] truncate" title={it.descricao}>
                    <span className="text-gray-900">{it.descricao || it.item_label || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">{it.unidade || '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{pesoDe(it).toFixed(2)}%</td>
                  {/* Contrato */}
                  <td className="px-3 py-2.5 text-right tabular-nums bg-blue-50/40 border-l border-blue-100">{fmtQtd(it.qtd_contrato)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums bg-blue-50/40">{fmtBRL(it.preco_unit)}</td>
                  {/* Com BDI */}
                  <td className="px-3 py-2.5 text-right tabular-nums bg-green-50/40 border-l border-green-100">{it.preco_unit_com_bdi != null ? fmtBRL(it.preco_unit_com_bdi) : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums bg-green-50/40 font-semibold text-gray-900">{fmtBRL(it.preco_total)}</td>
                  <td className="px-3 py-2.5 text-right border-l border-gray-100">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" title="Editar item" onClick={() => onEdit(it)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200 font-semibold text-gray-900">
                <td colSpan="7" className="px-3 py-3 text-right">Total do Contrato</td>
                <td className="px-3 py-3 text-right tabular-nums">{fmtBRL(total)}</td>
                <td className="px-3 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden p-3 space-y-2">
          {items.map((it) => (
            <div key={it.id} className="rounded-lg border border-gray-200 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">{it.item_codigo || '—'} · {it.unidade || '—'}</p>
                  <p className="text-sm font-medium text-gray-900 truncate" title={it.descricao}>{it.descricao || it.item_label || '—'}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-gray-400 hover:text-blue-600" title="Editar item" onClick={() => onEdit(it)}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div className="flex justify-between gap-2"><span className="text-gray-500">Qtd</span><span className="tabular-nums text-gray-800">{fmtQtd(it.qtd_contrato)}</span></div>
                <div className="flex justify-between gap-2"><span className="text-gray-500">P.Unit</span><span className="tabular-nums text-gray-800">{fmtBRL(it.preco_unit)}</span></div>
                <div className="flex justify-between gap-2"><span className="text-gray-500">c/ BDI</span><span className="tabular-nums text-gray-800">{it.preco_unit_com_bdi != null ? fmtBRL(it.preco_unit_com_bdi) : '—'}</span></div>
                <div className="flex justify-between gap-2"><span className="text-gray-500">Total</span><span className="tabular-nums font-semibold text-gray-900">{fmtBRL(it.preco_total)}</span></div>
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center px-1 pt-1 text-sm font-semibold text-gray-900">
            <span>Total do Contrato</span>
            <span className="tabular-nums">{fmtBRL(total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

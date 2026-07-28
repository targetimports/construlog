import React from 'react';
import CampoNFe from './CampoNFe';
import { SITUACOES_ICMS, ORIGENS_ICMS } from './nfeConstants';
import { Package, Plus, Trash2 } from 'lucide-react';

export default function EmissaoNFeItens({ items, onUpdate, onAdd, onDelete, total }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/80 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
        <Package className="w-4 h-4" /> Itens da Nota
      </div>
      <div className="p-6 space-y-3">
        {items.map((it, i) => (
          <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-700">Item {i + 1}</span>
              {items.length > 1 && (
                <button
                  onClick={() => onDelete(i)}
                  className="flex items-center gap-1 bg-red-50 text-red-600 rounded-md px-2.5 py-1 text-xs font-semibold hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Remover
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4">
              <CampoNFe label="Código" name="codigo_produto" value={it.codigo_produto} onChange={e => onUpdate(i, e)} mono />
              <CampoNFe label="Descrição" name="descricao" value={it.descricao} onChange={e => onUpdate(i, e)} colSpan={2} />
              <CampoNFe label="NCM" name="codigo_ncm" value={it.codigo_ncm} onChange={e => onUpdate(i, e)} mono placeholder="00000000" />
              <CampoNFe label="CFOP" name="cfop" value={it.cfop} onChange={e => onUpdate(i, e)} mono />
              <CampoNFe label="Unidade" name="unidade_comercial" value={it.unidade_comercial} onChange={e => onUpdate(i, e)} />
              <CampoNFe label="Quantidade" name="quantidade_comercial" type="number" value={it.quantidade_comercial} onChange={e => onUpdate(i, e)} />
              <CampoNFe label="Valor Unitário (R$)" name="valor_unitario_comercial" type="number" value={it.valor_unitario_comercial} onChange={e => onUpdate(i, e)} />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Subtotal</label>
                <div className="h-11 flex items-center px-3 bg-gray-50 border border-gray-200 rounded-md font-mono text-sm font-semibold text-emerald-700">
                  R$ {(parseFloat(it.quantidade_comercial || 0) * parseFloat(it.valor_unitario_comercial || 0)).toFixed(2)}
                </div>
              </div>
              <CampoNFe label="Situação ICMS" name="icms_situacao_tributaria" value={it.icms_situacao_tributaria} onChange={e => onUpdate(i, e)} opts={SITUACOES_ICMS} />
              <CampoNFe label="Origem ICMS" name="icms_origem" value={it.icms_origem} onChange={e => onUpdate(i, e)} opts={ORIGENS_ICMS} />
            </div>
          </div>
        ))}

        <button
          onClick={onAdd}
          className="flex items-center gap-2 w-full bg-gray-50 border border-dashed border-gray-300 rounded-xl px-5 py-3 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:border-gray-400 hover:text-gray-700 transition-all"
        >
          <Plus className="w-4 h-4" /> Adicionar Item
        </button>

        <div className="flex justify-end items-center gap-2 pt-2">
          <span className="text-sm text-gray-500 font-medium">Total da Nota:</span>
          <span className="font-mono text-xl font-bold text-gray-900">R$ {total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
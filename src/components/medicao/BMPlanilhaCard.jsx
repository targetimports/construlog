/**
 * BMPlanilhaCard: versão MOBILE (card) de uma linha da planilha de BM.
 * Espelha EXATAMENTE a lógica do BMPlanilhaRow (mesmo estado, debounce e
 * onUpdate) — só muda o layout de <tr>/<td> para um card empilhável.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { formatBRL } from '@/components/shared/moneyBR';
import { fmtQtd as num3, maskQtdBR, parseQtdBR } from './qtdMaskBR';

export default function BMPlanilhaCard({ item, onUpdate, readOnly = false }) {
  // Medição por ACUMULADO (mesma regra do desktop, ver BMPlanilhaRow): digita-se o
  // total executado até aqui; o período é a diferença, calculada. Campo já nasce com
  // o acumulado atual — deixar igual não mede nada, aumentar mede a diferença.
  const acumAtual = (Number(item.qtd_anterior) || 0) + (Number(item.qtd_periodo_input) || 0);
  const [editingAcum, setEditingAcum] = useState(acumAtual ? num3(acumAtual) : '');
  const debounceRef = useRef(null);

  useEffect(() => {
    const acum = (Number(item.qtd_anterior) || 0) + (Number(item.qtd_periodo_input) || 0);
    setEditingAcum(acum ? num3(acum) : '');
  }, [item.qtd_periodo_input, item.qtd_anterior]);

  const isEditable = !readOnly;
  const saldoNegativo = (item.qtd_saldo ?? 0) < -0.0001;
  const foiRecortado = Boolean(item._recortado);
  const jaConcluido = (item.qtd_contrato ?? 0) > 0 && (item.qtd_anterior ?? 0) >= (item.qtd_contrato ?? 0) - 0.0001;

  // Mesma leitura do desktop (BMPlanilhaRow): item parcial mostra o quanto já foi
  // medido, e o corte ao saldo é avisado ANTES de salvar.
  const qtdContrato = Number(item.qtd_contrato) || 0;
  const qtdAnterior = Number(item.qtd_anterior) || 0;
  const pctAnterior = qtdContrato > 0 ? Math.min(100, (qtdAnterior / qtdContrato) * 100) : 0;
  const parcial = !jaConcluido && qtdAnterior > 0.0001;
  const saldoParaMedir = Math.max(0, qtdContrato - qtdAnterior);
  const acumDigitado = parseQtdBR(editingAcum) || 0;
  const periodoCalculado = Math.max(0, acumDigitado - qtdAnterior);
  const abaixoDoAnterior = acumDigitado > 0.0001 && acumDigitado < qtdAnterior - 0.0001;
  const vaiSerCortado = qtdContrato > 0 && acumDigitado > qtdContrato + 0.0001;

  const handleAcumChange = (value) => {
    const masked = maskQtdBR(value);
    setEditingAcum(masked);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const acum = parseQtdBR(masked) || 0;
      onUpdate({
        contrato_item_id: item.contrato_item_id,
        qtd_periodo_input: Math.max(0, acum - qtdAnterior),   // motor trabalha por período
        override_manual: item.override_manual,
      });
    }, 300);
  };

  return (
    <div className={`border rounded-lg p-3 space-y-2 ${saldoNegativo ? 'border-red-200 bg-red-50' : foiRecortado ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
      {/* Cabeçalho: código + descrição + peso */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 tabular-nums">{item.item_codigo}</p>
          <p className="text-sm text-gray-800 line-clamp-2" title={item.item_label || item.descricao}>
            {item.item_label || item.descricao}
          </p>
        </div>
        <span className="text-xs text-gray-400 tabular-nums shrink-0" title="Peso sobre o contrato">
          {(item.peso_percentual || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
        </span>
      </div>

      {foiRecortado && (
        <Badge title="Quantidade ajustada ao saldo do contrato (não ultrapassa 100%)." className="bg-sky-100 text-sky-700 text-[10px] px-1.5 py-0 gap-0.5">
          <Info className="w-3 h-3" /> Ajustado
        </Badge>
      )}

      {/* ACUMULADO — editável (destaque). É aqui que se digita: total executado. */}
      <div className="bg-green-50 border border-green-100 rounded-md p-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-gray-600">Total executado (acumulado)</label>
          <span className="text-sm font-semibold text-blue-700 tabular-nums">{formatBRL(item.vl_acumulado || 0)}</span>
        </div>
        {!isEditable ? (
          <div className="mt-1 text-right text-blue-700 tabular-nums">{num3(item.qtd_acumulada)}</div>
        ) : jaConcluido ? (
          <div className="mt-1 flex justify-end">
            <Badge title="Item já 100% medido em BM anterior — não há saldo a medir." className="bg-emerald-100 text-emerald-700 border-0 text-[10px] gap-0.5">
              <CheckCircle2 className="w-3 h-3" /> 100% medido
            </Badge>
          </div>
        ) : (
          <>
            <Input
              type="text"
              inputMode="decimal"
              value={editingAcum}
              onChange={(e) => handleAcumChange(e.target.value)}
              placeholder="0,00"
              className={`mt-1 h-10 text-right tabular-nums placeholder:text-gray-300 ${saldoNegativo ? 'border-red-400' : ''} ${vaiSerCortado || abaixoDoAnterior ? 'border-amber-400' : ''}`}
            />
            {parcial && !vaiSerCortado && !abaixoDoAnterior && (
              <div className="flex items-center gap-1.5 justify-end mt-1">
                <div className="h-1 w-10 bg-gray-200 rounded-full overflow-hidden shrink-0">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pctAnterior}%` }} />
                </div>
                <span className="text-[10px] text-gray-500 whitespace-nowrap">
                  {pctAnterior.toFixed(0)}% · falta {num3(saldoParaMedir)}
                </span>
              </div>
            )}
            {abaixoDoAnterior && (
              <p className="text-[10px] text-amber-700 flex items-center justify-end gap-1 mt-0.5">
                <AlertTriangle className="w-3 h-3" />
                Abaixo do já aprovado ({num3(qtdAnterior)}) — não mede nada
              </p>
            )}
            {vaiSerCortado && (
              <p className="text-[10px] text-amber-700 flex items-center justify-end gap-1 mt-0.5">
                <AlertTriangle className="w-3 h-3" />
                Passa do contrato — será ajustado p/ {num3(qtdContrato)}
              </p>
            )}
          </>
        )}
      </div>

      {/* Período — calculado (a diferença do que foi digitado acima) */}
      <div className="flex items-center justify-between gap-2 text-xs bg-yellow-50 border border-yellow-100 rounded-md px-2 py-1.5">
        <span className="text-gray-500">Medido neste boletim</span>
        <span className="tabular-nums font-medium text-gray-800">
          {num3(item.qtd_periodo_final ?? periodoCalculado ?? 0)} · {formatBRL(item.vl_periodo || 0)}
        </span>
      </div>

      {/* Read-only: contrato / anterior / acumulado / saldo */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <p className="text-gray-400">Contrato</p>
          <p className="tabular-nums text-gray-700">{num3(item.qtd_contrato)} · {formatBRL(item.preco_unit_com_bdi || 0)}</p>
        </div>
        <div>
          <p className="text-gray-400">Anterior</p>
          <p className="tabular-nums text-gray-600">{num3(item.qtd_anterior)} · {formatBRL(item.vl_anterior || 0)}</p>
        </div>
        {/* "Acumulado" não se repete aqui: virou o campo editável lá em cima. */}
        <div>
          <p className="text-gray-400">Saldo</p>
          <p className={`tabular-nums font-medium ${saldoNegativo ? 'text-red-700' : 'text-red-600'}`}>
            {saldoNegativo && <AlertTriangle className="w-3 h-3 inline mr-0.5 text-red-500" />}
            {num3(item.qtd_saldo)} · {formatBRL(item.vl_saldo || 0)}
          </p>
        </div>
      </div>
    </div>
  );
}

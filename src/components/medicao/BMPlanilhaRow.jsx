/**
 * BMPlanilhaRow: Uma linha da planilha de BM
 * Edita qtd_periodo_input e calcula tudo mais em tempo real
 */

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { formatBRL } from '@/components/shared/moneyBR';
import { fmtQtd, maskQtdBR, parseQtdBR } from './qtdMaskBR';

export default function BMPlanilhaRow({ item, onUpdate, readOnly = false }) {
  // MEDIÇÃO POR ACUMULADO: o usuário digita ONDE O ITEM CHEGOU no total, não o que
  // fez no mês. O campo já nasce com o acumulado atual (= o que veio das BMs
  // aprovadas), então a tela nunca aparece "zerada como se estivesse bugada".
  // Deixar o número igual = nada medido neste boletim; aumentar = mede a diferença.
  //
  // O motor continua trabalhando por PERÍODO — a conversão é feita aqui
  // (período = digitado − anterior). Por isso o campo mora na coluna ACUMULADO:
  // digitar acumulado numa coluna chamada "Período" faria a coluna mentir o próprio
  // nome, e é o tipo de ambiguidade que gera medição errada.
  const acumAtual = (Number(item.qtd_anterior) || 0) + (Number(item.qtd_periodo_input) || 0);
  const [editingAcum, setEditingAcum] = useState(acumAtual ? fmtQtd(acumAtual) : '');
  const debounceRef = useRef(null);

  // Sincroniza quando o item muda por fora (ex.: recalc do motor após salvar).
  useEffect(() => {
    const acum = (Number(item.qtd_anterior) || 0) + (Number(item.qtd_periodo_input) || 0);
    setEditingAcum(acum ? fmtQtd(acum) : '');
  }, [item.qtd_periodo_input, item.qtd_anterior]);

  // A medição é sempre levantamento de campo → quantidade editável (salvo somente leitura).
  const isEditable = !readOnly;

  // Validação: saldo negativo = excedeu contrato
  const saldoNegativo = (item.qtd_saldo ?? 0) < -0.0001;
  // Item foi recortado pelo motor de cálculo
  const foiRecortado = Boolean(item._recortado);
  // Já 100% medido em BM(s) anterior(es) — não há saldo a medir nesta BM.
  const jaConcluido = (item.qtd_contrato ?? 0) > 0 && (item.qtd_anterior ?? 0) >= (item.qtd_contrato ?? 0) - 0.0001;

  // ESTADO DO ITEM. Antes o item só "falava" nos extremos (100% medido / ajustado):
  // o PARCIAL não dizia nada, e a pessoa tinha que comparar Anterior × Contrato de
  // cabeça para saber quanto já foi e quanto falta.
  const qtdContrato = Number(item.qtd_contrato) || 0;
  const qtdAnterior = Number(item.qtd_anterior) || 0;
  const pctAnterior = qtdContrato > 0 ? Math.min(100, (qtdAnterior / qtdContrato) * 100) : 0;
  const parcial = !jaConcluido && qtdAnterior > 0.0001;

  // Saldo REAL a medir nesta BM (o que sobra do contrato depois do já aprovado).
  const saldoParaMedir = Math.max(0, qtdContrato - qtdAnterior);

  // O que a pessoa digitou = ACUMULADO pretendido. O período é a diferença.
  const acumDigitado = parseQtdBR(editingAcum) || 0;
  const periodoCalculado = Math.max(0, acumDigitado - qtdAnterior);
  // Digitou MENOS que o já aprovado? Não dá para "desmedir" (o anterior está
  // aprovado): o período vira 0 e o item fica onde estava.
  const abaixoDoAnterior = acumDigitado > 0.0001 && acumDigitado < qtdAnterior - 0.0001;
  // Passou do contrato: o motor corta no teto. Avisar depois de salvar é tarde.
  const vaiSerCortado = qtdContrato > 0 && acumDigitado > qtdContrato + 0.0001;

  const handleAcumChange = (value) => {
    const masked = maskQtdBR(value);
    setEditingAcum(masked);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const acum = parseQtdBR(masked) || 0;
      // Converte para o que o motor entende (período), sem deixar negativo.
      const periodo = Math.max(0, acum - qtdAnterior);
      onUpdate({
        contrato_item_id: item.contrato_item_id,
        qtd_periodo_input: periodo,
        override_manual: item.override_manual
      });
    }, 300);
  };

  return (
    <tr className={`border-b border-gray-100 hover:bg-gray-50 ${saldoNegativo ? 'bg-red-50' : ''} ${foiRecortado ? 'bg-amber-50' : ''}`}>
      <td className="px-3 py-3 text-sm font-medium text-gray-700 whitespace-nowrap tabular-nums">
        {item.item_codigo}
      </td>
      <td className="px-3 py-3 text-sm max-w-[240px] text-gray-800">
        <span className="line-clamp-1" title={item.item_label || item.descricao}>
          {item.item_label || item.descricao}
        </span>
        {foiRecortado && (
          <Badge title="Quantidade ajustada ao saldo do contrato (não ultrapassa 100%)." className="bg-sky-100 text-sky-700 text-[10px] px-1 py-0 ml-1 gap-0.5">
            <Info className="w-3 h-3" /> Ajustado
          </Badge>
        )}
      </td>

      {/* Peso (% do item sobre o total do contrato) */}
      <td className="px-3 py-3 text-sm text-right text-gray-500 tabular-nums">{(item.peso_percentual || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>

      {/* Contrato */}
      <td className="px-3 py-3 text-sm text-right text-gray-600 tabular-nums border-l border-blue-100">{fmtQtd(item.qtd_contrato)}</td>
      <td className="px-3 py-3 text-sm text-right text-gray-600 tabular-nums">{formatBRL(item.preco_unit_com_bdi || 0)}</td>

      {/* Anterior (aprovadas) */}
      <td className="px-3 py-3 text-sm text-right text-gray-500 tabular-nums border-l border-gray-100">{fmtQtd(item.qtd_anterior)}</td>
      <td className="px-3 py-3 text-sm text-right text-gray-500 tabular-nums">{formatBRL(item.vl_anterior || 0)}</td>

      {/* Período — CALCULADO (acumulado digitado − anterior). Não se digita aqui:
          é o retrato do que o boletim está medindo. */}
      <td className="px-3 py-3 text-sm border-l border-yellow-100">
        <div className="text-right pr-1 tabular-nums">
          <span className={periodoCalculado > 0.0001 ? 'text-gray-800 font-medium' : 'text-gray-300'}>
            {fmtQtd(item.qtd_periodo_final ?? periodoCalculado ?? 0)}
          </span>
        </div>
      </td>
      <td className="px-3 py-3 text-sm text-right font-semibold text-gray-800 tabular-nums">{formatBRL(item.vl_periodo || 0)}</td>

      {/* Acumulado — EDITÁVEL: onde o item chegou no total. */}
      <td className="px-3 py-3 text-sm border-l border-green-100">
        {!isEditable ? (
          <div className="text-right text-blue-600 pr-1 tabular-nums">{fmtQtd(item.qtd_acumulada)}</div>
        ) : jaConcluido ? (
          <div className="flex justify-end pr-1">
            <Badge title="Item já 100% medido em BM anterior — não há saldo a medir." className="bg-emerald-100 text-emerald-700 border-0 text-[10px] gap-0.5">
              <CheckCircle2 className="w-3 h-3" /> 100% medido
            </Badge>
          </div>
        ) : (
          // Barra ACIMA do campo, com a largura dele: fica ancorada (não escorrega,
          // porque não divide linha com o texto de tamanho variável) e a coluna
          // continua estreita. Embaixo, o número — que é o que se lê para decidir.
          <div className="flex flex-col gap-0.5 items-end">
            {parcial && (
              <div
                className="h-1 w-28 bg-gray-200 rounded-full overflow-hidden"
                title={`Já aprovado em BMs anteriores: ${fmtQtd(qtdAnterior)} de ${fmtQtd(qtdContrato)}`}
              >
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pctAnterior}%` }} />
              </div>
            )}
            <Input
              type="text"
              inputMode="decimal"
              value={editingAcum}
              onChange={(e) => handleAcumChange(e.target.value)}
              placeholder="0,00"
              title={`Total executado até aqui. Contrato: ${fmtQtd(qtdContrato)} · já aprovado: ${fmtQtd(qtdAnterior)}`}
              // Campo com a largura do NÚMERO (não da coluna): a coluna é larga só
              // para o texto de baixo caber inteiro, mas um input esticado fica feio
              // e sugere que cabe muito mais dígito do que se digita aqui.
              className={`w-28 h-9 text-sm text-right tabular-nums placeholder:text-gray-300 ${vaiSerCortado || abaixoDoAnterior ? 'border-amber-400 focus-visible:ring-amber-400' : ''}`}
            />

            {/* Andamento ao lado do campo: quem digita vê onde o item está e quanto
                falta, sem precisar comparar Anterior × Contrato de cabeça. */}
            {parcial && !vaiSerCortado && !abaixoDoAnterior && (
              <span
                className="text-[10px] text-gray-500 whitespace-nowrap"
                title={`Já aprovado em BMs anteriores: ${fmtQtd(qtdAnterior)} de ${fmtQtd(qtdContrato)}. Falta ${fmtQtd(saldoParaMedir)}.`}
              >
                {pctAnterior.toFixed(0)}% medido · falta {fmtQtd(saldoParaMedir)}
              </span>
            )}

            {/* Digitou menos que o já aprovado: não dá para desmedir o que já foi
                aprovado — o boletim simplesmente não mede nada neste item. */}
            {abaixoDoAnterior && (
              <span className="text-[10px] text-amber-700 flex items-start gap-1 leading-tight" title="Para reduzir uma medição já aprovada, use a retificação da BM.">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                <span>Abaixo do aprovado ({fmtQtd(qtdAnterior)}) — não mede nada</span>
              </span>
            )}

            {/* Passou do contrato: o motor corta no teto. Avisa antes de salvar. */}
            {vaiSerCortado && (
              <span className="text-[10px] text-amber-700 flex items-start gap-1 leading-tight">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                <span>Passa do contrato — será ajustado p/ {fmtQtd(qtdContrato)}</span>
              </span>
            )}
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-sm text-right text-blue-700 font-semibold tabular-nums">{formatBRL(item.vl_acumulado || 0)}</td>

      {/* Saldo */}
      <td className={`px-3 py-3 text-sm text-right tabular-nums border-l border-red-100 ${saldoNegativo ? 'text-red-600 font-bold' : 'text-red-600'}`}>
        {saldoNegativo && <AlertTriangle className="w-3 h-3 inline mr-0.5 text-red-500" />}
        {fmtQtd(item.qtd_saldo)}
      </td>
      <td className={`px-3 py-3 text-sm text-right tabular-nums ${saldoNegativo ? 'text-red-700 font-bold' : 'text-red-700'}`}>
        {formatBRL(item.vl_saldo || 0)}
      </td>
    </tr>
  );
}
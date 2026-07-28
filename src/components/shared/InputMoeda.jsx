import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { maskNumeroBR, parseNumeroBR } from '@/lib/masks';

// Campo numérico com máscara pt-BR (milhar "." · decimal ","). Mantém o NÚMERO
// como fonte de verdade para o pai: `value` é number, `onValueChange` recebe number.
// Enquanto está em foco, não é sobrescrito pelo pai (evita "brigar" com a digitação).
export default function InputMoeda({ value, onValueChange, decimals = 2, prefixo = 'R$', className = '', ...props }) {
  const fmt = (n) =>
    (n === null || n === undefined || n === '') ? '' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: decimals });

  const [draft, setDraft] = useState(fmt(value));
  const focusRef = useRef(false);

  useEffect(() => {
    if (!focusRef.current) setDraft(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals]);

  const handleChange = (e) => {
    const masked = maskNumeroBR(e.target.value, decimals);
    setDraft(masked);
    onValueChange?.(parseNumeroBR(masked));
  };

  const input = (
    <Input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={handleChange}
      onFocus={(e) => { focusRef.current = true; props.onFocus?.(e); }}
      onBlur={(e) => { focusRef.current = false; setDraft(fmt(value)); props.onBlur?.(e); }}
      className={prefixo ? `pl-9 text-right tabular-nums ${className}` : `text-right tabular-nums ${className}`}
      {...props}
    />
  );

  if (!prefixo) return input;
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">{prefixo}</span>
      {input}
    </div>
  );
}

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ComboboxBusca from '@/components/shared/ComboboxBusca';

// Campo genérico do formulário de NF-e, no padrão do sistema:
// - opts => ComboboxBusca (com busca); senão => Input.
// Mantém a API por evento (onChange recebe { target: { name, value } }).
export default function CampoNFe({ label, name, value, onChange, type = 'text', placeholder = '', mono = false, colSpan = 1, opts }) {
  const style = colSpan > 1 ? { gridColumn: `span ${colSpan}` } : {};

  return (
    <div className="flex flex-col gap-1.5" style={style}>
      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</Label>
      {opts ? (
        <ComboboxBusca
          options={opts.map((o) => ({ value: o.v, label: o.l }))}
          value={value}
          onSelect={(val) => onChange({ target: { name, value: val } })}
          placeholder="Selecione"
          searchPlaceholder="Buscar..."
        />
      ) : (
        <Input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`h-11 ${mono ? 'font-mono text-[13px]' : ''}`}
        />
      )}
    </div>
  );
}

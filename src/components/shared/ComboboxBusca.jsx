import React, { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

// Combobox com busca (padrão do sistema para campos de seleção).
// Mostra as opções ao abrir e filtra conforme você digita; marca a selecionada.
// Props:
//   options: [{ value, label }]
//   value: valor selecionado
//   onSelect(value)
//   placeholder, searchPlaceholder, emptyMessage, disabled, className
//   buscarParaListar: quando true, NÃO lista nada ao abrir — só revela
//     resultados depois que o usuário digita algo (ideal p/ listas longas,
//     ex.: obras, colaboradores). Default false (lista tudo ao abrir).
//   dicaBusca: texto exibido enquanto nada foi digitado (modo buscarParaListar).
export default function ComboboxBusca({
  options = [],
  value,
  onSelect,
  placeholder = 'Selecionar...',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Nenhum resultado.',
  buscarParaListar = false,
  dicaBusca = 'Digite para buscar...',
  disabled = false,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedLabel = options.find((o) => o.value === value)?.label || (value || '');

  // No modo "buscar para listar", a lista só aparece depois de digitar.
  const aguardandoBusca = buscarParaListar && !query.trim();

  const fechar = () => { setOpen(false); setQuery(''); };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('flex h-11 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50', className)}
        >
          {/* min-w-0 é o que faz o truncate funcionar: dentro de um flex, o item não
              encolhe abaixo do próprio conteúdo sem isso — um nome longo esticava o
              botão e estourava a largura do modal no celular. */}
          <span className={cn('truncate min-w-0 flex-1 text-left', value ? 'text-gray-900' : 'text-gray-400')}>
            {value ? selectedLabel : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
        <Command>
          {/* Não-controlado: o cmdk filtra nativamente; o onValueChange só
              alimenta o gating de "buscarParaListar". */}
          <CommandInput
            key={open ? 'aberto' : 'fechado'}
            onValueChange={setQuery}
            placeholder={searchPlaceholder}
          />
          <CommandList>
            {aguardandoBusca ? (
              <div className="py-6 text-center text-sm text-gray-400">{dicaBusca}</div>
            ) : (
              <>
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup>
                  {options.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      onSelect={() => { onSelect?.(opt.value); fechar(); }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', opt.value === value ? 'opacity-100' : 'opacity-0')} />
                      {opt.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

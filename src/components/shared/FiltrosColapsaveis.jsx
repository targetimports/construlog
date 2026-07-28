import React, { useState } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Filtro colapsável padrão do sistema (mesmo esquema do /Agenda e /Orcamentos).
// Cabeçalho clicável (ícone + título + badge de ativos + chevron) e conteúdo
// que anima a altura (grid-rows 0fr → 1fr). Fechado por padrão, mobile e desktop.
//
// Props:
//   ativos:        número de filtros ativos — mostra o badge. Default 0.
//   onLimpar:      callback p/ limpar — mostra "Limpar filtros" quando ativos>0.
//   acao:          ReactNode opcional à direita do cabeçalho (ex.: botão Importar/Novo).
//   titulo:        texto do cabeçalho. Default "Filtros".
//   defaultAberto: começa aberto? Default false.
//   rodape:        ReactNode opcional no fim do conteúdo (ex.: "120 itens").
//   children:      os campos de filtro (mantém o grid/layout que a página já usa).
//   className:     classes extras no Card.
export default function FiltrosColapsaveis({
  ativos = 0,
  onLimpar,
  acao,
  titulo = 'Filtros',
  defaultAberto = false,
  rodape,
  children,
  className,
}) {
  const [aberto, setAberto] = useState(defaultAberto);

  return (
    <Card className={cn('bg-white border-gray-200', className)}>
      <CardContent className="pt-4 sm:pt-6">
        {/* Cabeçalho clicável — expande/recolhe */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="flex items-center gap-2 flex-1 text-left min-w-0"
          >
            <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <h3 className="font-semibold text-gray-900">{titulo}</h3>
            {ativos > 0 && (
              <span className="text-xs font-semibold bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 flex-shrink-0">
                {ativos}
              </span>
            )}
            <ChevronDown
              className={cn(
                'w-4 h-4 text-gray-400 transition-transform duration-300 flex-shrink-0',
                aberto && 'rotate-180',
              )}
            />
          </button>
          {acao && <div className="flex-shrink-0">{acao}</div>}
        </div>

        {/* Conteúdo — anima a altura (grid-rows 0fr → 1fr) */}
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-300 ease-out',
            aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <div className="pt-4">{children}</div>
            {(rodape || (ativos > 0 && onLimpar)) && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {rodape}
                {ativos > 0 && onLimpar && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-gray-500 hover:text-gray-700"
                    onClick={onLimpar}
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

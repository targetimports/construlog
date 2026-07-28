import React from 'react';
import { HardHat } from 'lucide-react';

// TELA "EM CONSTRUÇÃO" — placeholder para módulos ainda não liberados.
//
// Minimalista de propósito (mesma linha da Central de Ajuda): um ícone, uma frase
// e o rótulo do que vem aí. Sem cronômetro, sem promessa de data — o que envelhece
// mal numa tela que pode ficar meses no ar.
//
// Mobile-first: tudo centralizado numa coluna, tipografia que escala do celular
// ao desktop, e a caixa nunca passa da largura da tela.
export default function EmConstrucao({
  titulo = 'Em construção',
  subtitulo = 'Estamos preparando esta área. Em breve ela estará disponível por aqui.',
  modulo,
}) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        {modulo && (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 mb-6">
            {modulo}
          </p>
        )}

        {/* Ícone num círculo suave — o mesmo peso visual dos marcadores da Ajuda. */}
        <div className="mx-auto mb-7 w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center">
          <HardHat className="w-9 h-9 text-blue-600" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
          {titulo}
        </h1>
        <p className="mt-3 text-sm sm:text-base text-gray-500 leading-relaxed">
          {subtitulo}
        </p>

        <span className="mt-8 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-medium text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Em breve
        </span>
      </div>
    </div>
  );
}

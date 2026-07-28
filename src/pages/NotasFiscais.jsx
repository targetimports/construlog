import React from 'react';
import EmConstrucao from '@/components/shared/EmConstrucao';

// Módulo de Notas Fiscais em construção — a lógica anterior foi suspensa para
// evitar lançamento em duplicidade com o recebimento de compras. Quando o fluxo
// de NF for definido, esta página volta a listar as notas.
export default function NotasFiscais() {
  return (
    <EmConstrucao
      modulo="Notas Fiscais"
      titulo="Notas Fiscais em breve"
      subtitulo="Esta área vai reunir todas as notas fiscais das suas compras. Estamos finalizando os detalhes."
    />
  );
}

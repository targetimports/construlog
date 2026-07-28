import React from 'react';
import EmConstrucao from '@/components/shared/EmConstrucao';

// Revisão de NF em construção (suspensa para não duplicar o lançamento
// financeiro do recebimento de compras).
export default function RevisarNotaFiscal() {
  return (
    <EmConstrucao
      modulo="Notas Fiscais"
      titulo="Revisar NF em breve"
      subtitulo="A revisão e conferência de notas fiscais está a caminho. Em breve disponível por aqui."
    />
  );
}

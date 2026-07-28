import React from 'react';
import EmConstrucao from '@/components/shared/EmConstrucao';

// Importação de NF em construção (suspensa para não duplicar o lançamento
// financeiro do recebimento de compras).
export default function NovaNotaFiscal() {
  return (
    <EmConstrucao
      modulo="Notas Fiscais"
      titulo="Importar NF em breve"
      subtitulo="A importação de notas fiscais está sendo preparada. Em breve você poderá trazer suas NFs para o sistema."
    />
  );
}

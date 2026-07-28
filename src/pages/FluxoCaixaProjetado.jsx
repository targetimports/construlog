import React from 'react';
import FluxoCaixaProjetadoEmpresa from '../components/fluxo-caixa/FluxoCaixaProjetadoEmpresa';

export default function FluxoCaixaProjetado({ embedded = false }) {
  return (
    <div className={embedded ? "" : "p-4 md:p-6 max-w-[1400px] mx-auto"}>
      <FluxoCaixaProjetadoEmpresa />
    </div>
  );
}
import React from 'react';
import SugestaoCompraPanel from '../components/estoque/SugestaoCompraPanel';

export default function SugestaoCompraPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Sugestão de Compra Inteligente</h1>
        <p className="text-gray-600">Calcule sugestões baseado em consumo, políticas e saldos atuais</p>
      </div>

      <SugestaoCompraPanel />
    </div>
  );
}
import React from 'react';
import ObraLayout from '../components/obras/ObraLayout';
import ObraAlimentacao from './ObraAlimentacao';

export default function ObraAlimentacaoWrapper() {
  return (
    <ObraLayout>
      <ObraAlimentacao />
    </ObraLayout>
  );
}
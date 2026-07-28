import React from 'react';
import ObraLayout from '../components/obras/ObraLayout';
import ObraAluguelCombustivel from './ObraAluguelCombustivel';

export default function ObraAluguelCombustivelWrapper() {
  return (
    <ObraLayout>
      <ObraAluguelCombustivel />
    </ObraLayout>
  );
}
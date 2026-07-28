import React from 'react';
import ObraLayout from '../components/obras/ObraLayout';
import ObraResumo from './ObraResumo';

export default function ObraResumoWrapper() {
  return (
    <ObraLayout>
      <ObraResumo />
    </ObraLayout>
  );
}
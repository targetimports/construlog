import React from 'react';
import ObraLayout from '../components/obras/ObraLayout';
import ObraImpostos from './ObraImpostos';

export default function ObraImpostosWrapper() {
  return (
    <ObraLayout>
      <ObraImpostos />
    </ObraLayout>
  );
}
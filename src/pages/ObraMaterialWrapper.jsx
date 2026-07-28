import React from 'react';
import ObraLayout from '../components/obras/ObraLayout';
import ObraMaterial from './ObraMaterial';

export default function ObraMaterialWrapper() {
  return (
    <ObraLayout>
      <ObraMaterial />
    </ObraLayout>
  );
}
import React from 'react';
import ObraLayout from '../components/obras/ObraLayout';
import ObraMaoDeObra from './ObraMaoDeObra';

export default function ObraMaoDeObraWrapper() {
  return (
    <ObraLayout>
      <ObraMaoDeObra />
    </ObraLayout>
  );
}
import React from 'react';
import ObraLayout from '../components/obras/ObraLayout';
import ObraPessoas from './ObraPessoas';

export default function ObraPessoasWrapper() {
  return (
    <ObraLayout>
      <ObraPessoas />
    </ObraLayout>
  );
}
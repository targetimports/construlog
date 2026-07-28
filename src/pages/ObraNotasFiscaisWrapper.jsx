import React from 'react';
import ObraLayout from '../components/obras/ObraLayout';
import ObraNotasFiscais from './ObraNotasFiscais';

export default function ObraNotasFiscaisWrapper() {
  return (
    <ObraLayout>
      <ObraNotasFiscais />
    </ObraLayout>
  );
}
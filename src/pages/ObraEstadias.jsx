import React from 'react';
import { useParams } from 'react-router-dom';
import ObraLayout from '@/components/obras/ObraLayout';
import EstadiasForm from './EstadiasForm';

export default function ObraEstadias() {
  const { obraId } = useParams();

  return (
    <ObraLayout>
      <EstadiasForm obraId={obraId} />
    </ObraLayout>
  );
}
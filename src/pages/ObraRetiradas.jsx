import React from 'react';
import { useParams } from 'react-router-dom';
import ObraLayout from '@/components/obras/ObraLayout';
import RetiradaForm from './RetiradaForm';

export default function ObraRetiradas() {
  const { obraId } = useParams();

  return (
    <ObraLayout>
      <RetiradaForm obraId={obraId} />
    </ObraLayout>
  );
}
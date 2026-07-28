import React from 'react';
import { useParams } from 'react-router-dom';
import ObraLayout from '@/components/obras/ObraLayout';
import AluguelForm from './AluguelForm';

export default function ObraAluguelCombustivel() {
  const { obraId } = useParams();

  return (
    <ObraLayout>
      <AluguelForm obraId={obraId} />
    </ObraLayout>
  );
}
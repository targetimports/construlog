import React from 'react';
import { useParams } from 'react-router-dom';
import ObraLayout from '@/components/obras/ObraLayout';
import AlimentacaoForm from './AlimentacaoForm';

export default function ObraAlimentacao() {
  const { obraId } = useParams();

  return (
    <ObraLayout>
      <AlimentacaoForm obraId={obraId} />
    </ObraLayout>
  );
}
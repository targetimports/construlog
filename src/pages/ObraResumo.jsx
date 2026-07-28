import React from 'react';
import { useParams } from 'react-router-dom';
import ObraLayout from '@/components/obras/ObraLayout';
import Resumo from './Resumo';

export default function ObraResumo() {
  const { obraId } = useParams();

  return (
    <ObraLayout>
      <Resumo obraId={obraId} />
    </ObraLayout>
  );
}
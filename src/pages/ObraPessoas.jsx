import React from 'react';
import { useParams } from 'react-router-dom';
import ObraLayout from '@/components/obras/ObraLayout';
import Pessoas from './Pessoas';

export default function ObraPessoas() {
  const { obraId } = useParams();

  return (
    <ObraLayout>
      <Pessoas obraId={obraId} />
    </ObraLayout>
  );
}
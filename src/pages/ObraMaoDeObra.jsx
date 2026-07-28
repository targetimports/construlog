import React from 'react';
import { useParams } from 'react-router-dom';
import ObraLayout from '@/components/obras/ObraLayout';
import MaoDeObraForm from './MaoDeObraForm';

export default function ObraMaoDeObra() {
  const { obraId } = useParams();

  return (
    <ObraLayout>
      <MaoDeObraForm obraId={obraId} />
    </ObraLayout>
  );
}
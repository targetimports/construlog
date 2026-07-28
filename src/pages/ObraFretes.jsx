import React from 'react';
import { useParams } from 'react-router-dom';
import ObraLayout from '@/components/obras/ObraLayout';
import FreteForm from './FreteForm';

export default function ObraFretes() {
  const { obraId } = useParams();

  return (
    <ObraLayout>
      <FreteForm obraId={obraId} />
    </ObraLayout>
  );
}
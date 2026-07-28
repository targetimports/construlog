import React from 'react';
import { useParams } from 'react-router-dom';
import ObraLayout from '@/components/obras/ObraLayout';
import ImpostosForm from './ImpostosForm';

export default function ObraImpostos() {
  const { obraId } = useParams();

  return (
    <ObraLayout>
      <ImpostosForm obraId={obraId} />
    </ObraLayout>
  );
}
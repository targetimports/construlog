import React from 'react';
import { useParams } from 'react-router-dom';
import ObraLayout from '@/components/obras/ObraLayout';
import MaterialForm from './MaterialForm';

export default function ObraMaterial() {
  const { obraId } = useParams();

  return (
    <ObraLayout>
      <MaterialForm obraId={obraId} />
    </ObraLayout>
  );
}
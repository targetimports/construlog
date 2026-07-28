import React from 'react';
import { useParams } from 'react-router-dom';
import ObraLayout from '@/components/obras/ObraLayout';
import BICompras from './BICompras';

export default function ObraBICompras() {
  const { obraId } = useParams();

  return (
    <ObraLayout>
      <BICompras obraId={obraId} />
    </ObraLayout>
  );
}
import React from 'react';
import { useParams } from 'react-router-dom';
import ObraLayout from '@/components/obras/ObraLayout';
import ImportarNotaFiscal from './ImportarNotaFiscal';

export default function ObraNotasFiscais() {
  const { obraId } = useParams();

  return (
    <ObraLayout>
      <ImportarNotaFiscal obraId={obraId} />
    </ObraLayout>
  );
}
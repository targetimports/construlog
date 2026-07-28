import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';
import EmissaoNFeForm from '@/components/notas-fiscais/EmissaoNFeForm';

function EmissaoNFeContent() {
  return <EmissaoNFeForm />;
}

export default function EmissaoNFe() {
  return (
    <RouteGuardFinalV2 requiredPermissionKey="COMPRAS_CREATE">
      <EmissaoNFeContent />
    </RouteGuardFinalV2>
  );
}
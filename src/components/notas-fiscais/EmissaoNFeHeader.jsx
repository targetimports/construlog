import React from 'react';
import { FileText } from 'lucide-react';

export default function EmissaoNFeHeader() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5 text-blue-600" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Emissão de NF-e</h1>
        <p className="text-gray-500 mt-0.5 text-sm">Nota Fiscal Eletrônica via Focus NFe · Ambiente de Homologação</p>
      </div>
    </div>
  );
}
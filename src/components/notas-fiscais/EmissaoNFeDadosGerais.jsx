import React from 'react';
import CampoNFe from './CampoNFe';
import { TIPOS_DOCUMENTO, FINALIDADES, MODALIDADES_FRETE } from './nfeConstants';
import { ClipboardList } from 'lucide-react';

export default function EmissaoNFeDadosGerais({ geral, onChange }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/80 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
        <ClipboardList className="w-4 h-4" /> Dados Gerais
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6">
        <CampoNFe label="Natureza da Operação" name="natureza_operacao" value={geral.natureza_operacao} onChange={onChange} colSpan={2} />
        <CampoNFe label="Data de Emissão" name="data_emissao" type="datetime-local" value={geral.data_emissao} onChange={onChange} />
        <CampoNFe label="Tipo de Documento" name="tipo_documento" value={geral.tipo_documento} onChange={onChange} opts={TIPOS_DOCUMENTO} />
        <CampoNFe label="Finalidade" name="finalidade_emissao" value={geral.finalidade_emissao} onChange={onChange} opts={FINALIDADES} />
        <CampoNFe label="Modalidade de Frete" name="modalidade_frete" value={geral.modalidade_frete} onChange={onChange} opts={MODALIDADES_FRETE} />
      </div>
    </div>
  );
}
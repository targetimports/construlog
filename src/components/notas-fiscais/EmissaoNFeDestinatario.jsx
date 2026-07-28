import React from 'react';
import CampoNFe from './CampoNFe';
import { UFs, INDICADORES_IE } from './nfeConstants';
import { User } from 'lucide-react';

export default function EmissaoNFeDestinatario({ dest, onChange }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/80 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
        <User className="w-4 h-4" /> Destinatário
      </div>
      <div className="px-6 py-3 text-xs text-amber-800 bg-amber-50 border-b border-amber-200">
        Em <strong>homologação</strong>, o nome do destinatário será substituído automaticamente pelo valor exigido pela SEFAZ.
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6">
        <CampoNFe label="CPF" name="cpf_destinatario" value={dest.cpf_destinatario} onChange={onChange} mono placeholder="000.000.000-00" />
        <CampoNFe label="CNPJ (ou CPF acima)" name="cnpj_destinatario" value={dest.cnpj_destinatario} onChange={onChange} mono placeholder="opcional" />
        <CampoNFe label="Indicador IE" name="indicador_inscricao_estadual_destinatario" value={dest.indicador_inscricao_estadual_destinatario} onChange={onChange} opts={INDICADORES_IE} />
        <CampoNFe label="Logradouro" name="logradouro_destinatario" value={dest.logradouro_destinatario} onChange={onChange} colSpan={2} />
        <CampoNFe label="Número" name="numero_destinatario" value={dest.numero_destinatario} onChange={onChange} />
        <CampoNFe label="Bairro" name="bairro_destinatario" value={dest.bairro_destinatario} onChange={onChange} />
        <CampoNFe label="Município" name="municipio_destinatario" value={dest.municipio_destinatario} onChange={onChange} />
        <CampoNFe label="UF" name="uf_destinatario" value={dest.uf_destinatario} onChange={onChange} opts={UFs} />
        <CampoNFe label="CEP" name="cep_destinatario" value={dest.cep_destinatario} onChange={onChange} mono placeholder="00000-000" />
      </div>
    </div>
  );
}
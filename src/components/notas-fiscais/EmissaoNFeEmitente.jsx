import React from 'react';
import CampoNFe from './CampoNFe';
import { UFs, REGIMES_TRIBUTARIOS } from './nfeConstants';
import { Building2 } from 'lucide-react';

export default function EmissaoNFeEmitente({ emit, onChange }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/80 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
        <Building2 className="w-4 h-4" /> Emitente
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6">
        <CampoNFe label="CNPJ" name="cnpj_emitente" value={emit.cnpj_emitente} onChange={onChange} mono placeholder="00.000.000/0000-00" />
        <CampoNFe label="Razão Social" name="nome_emitente" value={emit.nome_emitente} onChange={onChange} colSpan={2} />
        <CampoNFe label="Nome Fantasia" name="nome_fantasia_emitente" value={emit.nome_fantasia_emitente} onChange={onChange} />
        <CampoNFe label="Inscrição Estadual" name="inscricao_estadual_emitente" value={emit.inscricao_estadual_emitente} onChange={onChange} mono />
        <CampoNFe label="Regime Tributário" name="regime_tributario_emitente" value={emit.regime_tributario_emitente} onChange={onChange} opts={REGIMES_TRIBUTARIOS} />
        <CampoNFe label="Logradouro" name="logradouro_emitente" value={emit.logradouro_emitente} onChange={onChange} colSpan={2} />
        <CampoNFe label="Número" name="numero_emitente" value={emit.numero_emitente} onChange={onChange} />
        <CampoNFe label="Bairro" name="bairro_emitente" value={emit.bairro_emitente} onChange={onChange} />
        <CampoNFe label="Município" name="municipio_emitente" value={emit.municipio_emitente} onChange={onChange} />
        <CampoNFe label="UF" name="uf_emitente" value={emit.uf_emitente} onChange={onChange} opts={UFs} />
        <CampoNFe label="CEP" name="cep_emitente" value={emit.cep_emitente} onChange={onChange} mono placeholder="00000-000" />
      </div>
    </div>
  );
}
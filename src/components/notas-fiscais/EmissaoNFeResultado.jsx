import React from 'react';
import { CheckCircle2, Clock, Send, AlertCircle, Loader2, Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const BASE_URL = 'https://homologacao.focusnfe.com.br';

const tipoConfig = {
  autorizado: {
    icon: CheckCircle2,
    label: 'Autorizado',
    border: 'border-emerald-300',
    bg: 'bg-emerald-50',
    badgeBg: 'bg-emerald-100 text-emerald-800',
  },
  processando: {
    icon: Clock,
    label: 'Processando',
    border: 'border-amber-300',
    bg: 'bg-amber-50',
    badgeBg: 'bg-amber-100 text-amber-800',
  },
  enviado: {
    icon: Send,
    label: 'Enviado — Aguardando SEFAZ',
    border: 'border-blue-300',
    bg: 'bg-blue-50',
    badgeBg: 'bg-blue-100 text-blue-800',
  },
  erro: {
    icon: AlertCircle,
    label: 'Erro',
    border: 'border-red-300',
    bg: 'bg-red-50',
    badgeBg: 'bg-red-100 text-red-800',
  },
};

export default function EmissaoNFeResultado({ resultado, consultando, onConsultar }) {
  const cfg = tipoConfig[resultado.tipo] || tipoConfig.erro;
  const Icon = cfg.icon;

  return (
    <div className={cn('rounded-2xl border-2 overflow-hidden animate-in slide-in-from-bottom-2', cfg.border, cfg.bg)}>
      <div className="px-6 py-4 flex items-center gap-3 border-b border-black/5">
        <Icon className="w-5 h-5" />
        <div>
          <span className={cn('text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full', cfg.badgeBg)}>
            {cfg.label}
          </span>
          {resultado.data?.mensagem_sefaz && (
            <p className="text-sm text-gray-700 mt-1">{resultado.data.mensagem_sefaz}</p>
          )}
        </div>
      </div>
      <div className="px-6 py-5 space-y-3">
        {resultado.ref && (
          <p className="text-sm text-gray-700">Referência: <strong className="text-gray-900">{resultado.ref}</strong></p>
        )}
        {resultado.data?.numero && (
          <p className="text-sm text-gray-700">Número / Série: <strong className="text-gray-900">{resultado.data.numero} / {resultado.data.serie}</strong></p>
        )}
        {resultado.data?.chave_nfe && (
          <div>
            <p className="text-sm text-gray-700 mb-1">Chave NF-e:</p>
            <div className="font-mono text-[13px] text-gray-700 bg-black/5 px-3 py-2 rounded-lg break-all">
              {resultado.data.chave_nfe}
            </div>
          </div>
        )}
        {resultado.data?.erros?.length > 0 && (
          <div className="space-y-1">
            {resultado.data.erros.map((e, i) => (
              <div key={i} className="text-sm text-red-800 bg-red-100 px-3 py-2 rounded-lg">
                {e.mensagem}
              </div>
            ))}
          </div>
        )}
        {resultado.tipo === 'autorizado' && resultado.data?.caminho_danfe && (
          <div className="flex gap-3 flex-wrap pt-2">
            <a
              href={`${BASE_URL}${resultado.data.caminho_danfe}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              <Download className="w-4 h-4" /> Baixar DANFE (PDF)
            </a>
            <a
              href={`${BASE_URL}${resultado.data.caminho_xml_nota_fiscal}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              <FileText className="w-4 h-4" /> Baixar XML
            </a>
          </div>
        )}
        {(resultado.tipo === 'enviado' || resultado.tipo === 'processando') && (
          <button
            onClick={onConsultar}
            disabled={consultando}
            className="mt-3 inline-flex items-center gap-2 h-9 px-5 rounded-lg border border-amber-300 bg-white text-amber-800 text-sm font-semibold hover:bg-amber-50 transition-colors disabled:opacity-50"
          >
            {consultando ? <Loader2 className="w-4 h-4 animate-spin" /> : ''} 
            {consultando ? 'Consultando...' : 'Consultar Status na SEFAZ'}
          </button>
        )}
      </div>
    </div>
  );
}
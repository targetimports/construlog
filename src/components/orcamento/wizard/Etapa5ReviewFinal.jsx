import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, FileText, Calendar, Building } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Mapa de enums para labels legíveis
const TIPO_LABEL = { privada: 'Privada', publica: 'Pública' };
const STATUS_LABEL = { orcamento: 'Orçamento', a_iniciar: 'A Iniciar', em_andamento: 'Em Andamento', pausada: 'Paralisada', concluida: 'Finalizada', cancelada: 'Cancelada' };
const DRE_LABEL = { EDUCACAO: 'Educação', SAUDE: 'Saúde', INFRA: 'Infraestrutura', ADMINISTRATIVO: 'Administrativo', OUTRO: 'Outro' };
const ESTRUTURAL_LABEL = { CONTENCAO: 'Contenção', FUNDACAO: 'Fundação', ESTRUTURA: 'Estrutura', ALVENARIA: 'Alvenaria', COBERTURA: 'Cobertura', ACABAMENTO: 'Acabamento', INSTALACOES: 'Instalações', PAVIMENTACAO: 'Pavimentação', DRENAGEM: 'Drenagem', OUTRO: 'Outro' };
const INTERVENCAO_LABEL = { REFORMA: 'Reforma', CONSTRUCAO_NOVA: 'Construção Nova', AMPLIACAO: 'Ampliação', INDEFINIDA: 'Indefinida' };

function val(v, fallback = null) {
  return v && String(v).trim() ? v : fallback;
}

// Campos obrigatórios para validação da revisão
const OBRIGATORIOS = [
  { campo: 'nome', label: 'Nome da Obra' },
  { campo: 'responsavel_tecnico', label: 'Responsável Técnico' },
  { campo: 'responsavel_obra', label: 'Responsável da Obra' },
  { campo: 'data_inicio', label: 'Data de Início' },
  { campo: 'data_prevista_fim', label: 'Data Prevista de Fim' },
  { campo: 'cidade', label: 'Cidade' },
  { campo: 'estado', label: 'Estado' },
];

export default function Etapa5ReviewFinal({ dados }) {
  // Desempacotar payload — suporta ambos os formatos
  const obraData = dados?.dadosObra?.payload || dados?.dadosObra || {};
  const { sintetico, cronograma } = dados;

  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
    enabled: !!obraData?.cliente_id
  });

  const cliente = clientes?.find(c => c.id === obraData?.cliente_id);
  const nomeCliente = val(cliente?.nome) || val(obraData?.cliente_nome) || val(obraData?.novo_cliente_nome) || '—';

  const { data: empresasRev } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list(),
    enabled: !!obraData?.empresa_id,
  });
  const nomeEmpresa = empresasRev?.find(e => e.id === obraData?.empresa_id)?.nome || null;

  const nomeResponsavelTecnico = val(obraData?.responsavel_tecnico);
  const nomeResponsavelObra = val(obraData?.responsavel_obra);

  // Detectar pendências obrigatórias
  const pendencias = OBRIGATORIOS.filter(({ campo }) => !val(obraData?.[campo])).map(o => o.label);
  // Cliente também obrigatório
  if (!obraData?.cliente_id && !val(obraData?.novo_cliente_nome) && !val(obraData?.cliente_nome)) {
    pendencias.push('Cliente/Contratante');
  }

  const temPendencias = pendencias.length > 0;

  const localizacao = [val(obraData?.cidade), val(obraData?.estado)].filter(Boolean).join('/');
  const periodo = val(obraData?.data_inicio) && val(obraData?.data_prevista_fim)
    ? `${fmtData(obraData.data_inicio)} → ${fmtData(obraData.data_prevista_fim)}`
    : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Revisão Final</h2>
        <p className="text-sm text-gray-500 mt-0.5">Confira todos os dados antes de finalizar.</p>
      </div>

      {/* Pendências */}
      {temPendencias && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900 flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4" /> Campos obrigatórios ausentes
          </p>
          <ul className="list-disc list-inside space-y-1">
            {pendencias.map(p => <li key={p} className="text-sm text-red-700">{p}</li>)}
          </ul>
          <p className="text-xs text-red-600 mt-2">Volte à etapa anterior e preencha esses campos para finalizar.</p>
        </div>
      )}

      {/* Orçamento */}
      <SecaoResumo icone={FileText} cor="blue" titulo="Orçamento Sintético" ok>
        <p className="text-sm text-gray-500">
          {sintetico?.resumo?.total_grupos ?? sintetico?.resumo?.grupos ?? 0} grupos · {sintetico?.resumo?.total_itens ?? sintetico?.resumo?.itens ?? 0} itens
        </p>
        <p className="text-sm font-semibold text-emerald-600 mt-0.5">
          {Number(sintetico?.meta?.total_geral || sintetico?.resumo?.valor_total || 0)
            .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
      </SecaoResumo>

      {/* Cronograma */}
      <SecaoResumo icone={Calendar} cor="amber" titulo="Cronograma" ok={!!cronograma}>
        {cronograma
          ? <p className="text-sm text-gray-500">Cronograma importado</p>
          : <p className="text-sm text-gray-400">Não importado (opcional)</p>}
      </SecaoResumo>

      {/* Dados da Obra */}
      {obraData && Object.keys(obraData).length > 0 ? (
        <SecaoResumo icone={Building} cor={temPendencias ? 'amber' : 'emerald'} titulo="Dados da Obra" ok={!temPendencias}>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
            <Campo label="Nome" value={val(obraData?.nome)} required />
            <Campo label="Empresa Responsável" value={nomeEmpresa} required />
            <Campo label="Cliente" value={nomeCliente !== '—' ? nomeCliente : null} required />
            <Campo label="Responsável Técnico" value={nomeResponsavelTecnico} required />
            <Campo label="Responsável da Obra" value={nomeResponsavelObra} required />
            <Campo label="Período" value={periodo} required />
            <Campo label="Cidade/Estado" value={localizacao || null} required />
            {val(obraData?.endereco) && <Campo label="Endereço" value={obraData.endereco} />}
            {val(obraData?.cep) && <Campo label="CEP" value={obraData.cep} />}
            {val(obraData?.categoria_dre) && <Campo label="Categoria DRE" value={DRE_LABEL[obraData.categoria_dre] || obraData.categoria_dre} />}
            {val(obraData?.tipo_estrutural) && <Campo label="Tipo Estrutural" value={ESTRUTURAL_LABEL[obraData.tipo_estrutural] || obraData.tipo_estrutural} />}
            {val(obraData?.tipo_intervencao) && <Campo label="Tipo Intervenção" value={INTERVENCAO_LABEL[obraData.tipo_intervencao] || obraData.tipo_intervencao} />}
            {val(obraData?.centro_custo_codigo) && (
              <Campo label="Centro de Custo" value={`${obraData.centro_custo_codigo}${val(obraData?.centro_custo_nome) ? ` — ${obraData.centro_custo_nome}` : ''}`} />
            )}
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Badge>{TIPO_LABEL[obraData?.tipo] || obraData?.tipo || 'Privada'}</Badge>
            <Badge variant="outline">{STATUS_LABEL[obraData?.status] || obraData?.status || 'Orçamento'}</Badge>
          </div>
        </SecaoResumo>
      ) : (
        <SecaoResumo icone={Building} cor="gray" titulo="Dados da Obra">
          <p className="text-sm text-gray-400">Aguardando preenchimento...</p>
        </SecaoResumo>
      )}

      {/* Aviso de Persistência */}
      {!temPendencias && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-900 font-semibold">Todos os dados serão salvos permanentemente</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Após confirmar, a obra será criada com todos os materiais vinculados.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtData(iso) {
  const s = String(iso || '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

const COR_CHIP = {
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  gray: 'bg-gray-100 text-gray-400',
};

// Card de seção no padrão do sistema: ícone em chip colorido + título + conteúdo,
// com o check verde à direita quando a etapa está completa.
function SecaoResumo({ icone: Icone, cor = 'blue', titulo, ok = false, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${COR_CHIP[cor] || COR_CHIP.blue}`}>
          <Icone className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{titulo}</p>
          {children}
        </div>
        {ok && <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />}
      </div>
    </div>
  );
}

// Rótulo (uppercase) + valor; "Obrigatório" em vermelho quando falta.
function Campo({ label, value, required = false }) {
  const hasValue = value && String(value).trim();
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      {hasValue
        ? <p className="text-sm text-gray-800 break-words">{value}</p>
        : <p className="text-sm text-red-500 font-medium">{required ? 'Obrigatório' : '—'}</p>}
    </div>
  );
}
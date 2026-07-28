import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, FileText, Calendar, Building2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function SummaryRow({ label, value, sub }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold text-gray-900">{value}</span>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

export default function Etapa4RevisaoFinal({ sintetico, cronograma, obra, onConcluir }) {
  const temSintetico  = !!sintetico;
  const temCronograma = !!cronograma;

  if (!temSintetico) {
    return (
      <div className="flex items-center gap-3 p-5 bg-amber-50 border border-amber-200 rounded-xl">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <p className="text-sm text-amber-800">O Orçamento Sintético é obrigatório. Volte à Etapa 1 e faça o upload.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Etapa 4: Revisão Final</h2>
        <p className="text-sm text-gray-500">Confira o resumo antes de concluir a importação.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Orçamento Sintético */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
              <FileText className="w-4 h-4" /> Orçamento Sintético
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SummaryRow label="Arquivo"     value={sintetico.arquivo} />
            <SummaryRow label="Total Geral" value={fmtBRL(sintetico.meta?.total_geral)} />
            <SummaryRow
              label="BDI"
              value={sintetico.meta?.bdi_percent > 0 ? `${sintetico.meta.bdi_percent}%` : '—'}
              sub={sintetico.meta?.total_bdi > 0 ? fmtBRL(sintetico.meta.total_bdi) : undefined}
            />
            <SummaryRow label="Etapas" value={sintetico.resumo?.total_grupos ?? '—'} />
            <SummaryRow label="Itens"  value={sintetico.resumo?.total_itens  ?? '—'} />
          </CardContent>
        </Card>

        {/* Cronograma */}
        <Card className={!temCronograma ? 'opacity-50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-green-700">
              <Calendar className="w-4 h-4" />
              Cronograma Físico-Financeiro
              {!temCronograma && <span className="text-xs text-gray-400 font-normal ml-1">(não importado)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {temCronograma ? (
              <>
                <SummaryRow label="Arquivo"  value={cronograma.arquivo} />
                <SummaryRow label="Linhas"   value={cronograma.resumo?.linhas   ?? '—'} />
                <SummaryRow label="Períodos" value={cronograma.resumo?.periodos ?? '—'}
                  sub={cronograma.periodos_labels?.join(', ')} />
                <SummaryRow label="Total Geral" value={fmtBRL(cronograma.meta?.total_geral)} />
              </>
            ) : (
              <p className="text-sm text-gray-400 italic py-2">Etapa pulada</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dados da obra */}
      {obra && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-purple-700">
              <Building2 className="w-4 h-4" /> Dados da Obra
            </CardTitle>
          </CardHeader>
          <CardContent>
            {obra.nome_obra    && <SummaryRow label="Nome"       value={obra.nome_obra} />}
            {obra.tipo         && <SummaryRow label="Tipo"       value={obra.tipo} />}
            {obra.status       && <SummaryRow label="Status"     value={obra.status} />}
            {(obra.cidade || obra.estado) && (
              <SummaryRow label="Localidade" value={[obra.cidade, obra.estado].filter(Boolean).join(' — ')} />
            )}
            {obra.data_inicio  && (
              <SummaryRow
                label="Período"
                value={`${obra.data_inicio}${obra.data_prevista_fim ? ` → ${obra.data_prevista_fim}` : ''}`}
              />
            )}
            {obra.responsavel_user_ids?.length > 0 && (
              <SummaryRow label="Responsáveis" value={`${obra.responsavel_user_ids.length} selecionado(s)`} />
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
        <p className="text-sm text-green-800">Tudo pronto! Clique em <strong>Concluir Importação</strong> para finalizar.</p>
      </div>

      <Button onClick={onConcluir} className="w-full bg-green-600 hover:bg-green-700 text-white">
        <CheckCircle className="w-4 h-4 mr-2" /> Concluir Importação
      </Button>
    </div>
  );
}
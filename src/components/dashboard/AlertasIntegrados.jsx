import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Package,
  DollarSign,
  TrendingDown,
  FileText,
  ChevronRight } from
'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { cn } from '@/lib/utils';

export default function AlertasIntegrados({
  solicitacoesPendentes = [],
  medicoesAguardando = [],
  contasVencendo = [],
  estoqueBaixo = [],
  obrasCriticas = []
}) {
  const alertas = [
  ...solicitacoesPendentes.map((s) => ({
    tipo: 'solicitacao',
    icone: FileText,
    cor: 'amber',
    titulo: 'Solicitação aguardando aprovação',
    descricao: s.titulo || `Solicitação #${s.id?.substring(0, 8)}`,
    link: createPageUrl(`SolicitacaoDetalhes?id=${s.id}`),
    prioridade: s.prioridade === 'urgente' ? 'alta' : 'normal'
  })),
  ...medicoesAguardando.map((m) => ({
    tipo: 'medicao',
    icone: Clock,
    cor: 'blue',
    titulo: 'Medição aguardando aprovação',
    descricao: `Medição BM ${m.numero}`,
    link: createPageUrl(`BMDetalhes?bm_id=${m.id}`),
    prioridade: 'normal'
  })),
  ...contasVencendo.map((c) => ({
    tipo: 'financeiro',
    icone: DollarSign,
    cor: 'red',
    titulo: 'Conta vencendo em breve',
    descricao: c.descricao,
    valor: c.valor,
    link: createPageUrl(`Financeiro?conta_id=${c.id}`),
    prioridade: 'alta'
  })),
  ...estoqueBaixo.map((e) => ({
    tipo: 'estoque',
    icone: Package,
    cor: 'orange',
    titulo: 'Material com estoque baixo',
    descricao: e.nome,
    link: createPageUrl('Estoque'),
    prioridade: 'normal'
  })),
  ...obrasCriticas.map((o) => ({
    tipo: 'obra',
    icone: TrendingDown,
    cor: 'red',
    titulo: 'Obra com variação negativa',
    descricao: o.nome,
    link: createPageUrl(`GestaoObraDetalhada?obra_id=${o.id}`),
    prioridade: 'alta'
  }))].
  sort((a, b) => (b.prioridade === 'alta' ? 1 : 0) - (a.prioridade === 'alta' ? 1 : 0));

  if (alertas.length === 0) {
    return (
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-8 text-center">
          <div
            className="w-16 h-16 bg-emerald-50 ring-1 ring-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3"
            aria-label="Nenhum alerta">

            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-gray-900 font-semibold mb-2">Tudo em ordem!</h3>
          <p className="text-gray-500 text-sm">Nenhum alerta no momento</p>
        </CardContent>
      </Card>);

  }

  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardHeader className="p-6 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Alertas e Pendências ({alertas.length})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 p-6">
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {alertas.slice(0, 10).map((alerta, index) => {
            const Icon = alerta.icone;
            const cores = {
              amber: 'bg-amber-50 border-amber-200 text-amber-700',
              blue: 'bg-blue-50 border-blue-200 text-blue-700',
              red: 'bg-red-50 border-red-200 text-red-700',
              orange: 'bg-orange-50 border-orange-200 text-orange-700'
            };

            return (
              <Link key={index} to={alerta.link} className="block">
                <div className={cn("p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md", cores[alerta.cor] || 'bg-gray-50 border-gray-200 text-gray-700')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-gray-900 font-medium text-sm">{alerta.titulo}</p>
                        <p className="text-gray-500 text-sm mt-1">{alerta.descricao}</p>
                        {alerta.valor &&
                        <p className="text-gray-900 font-semibold text-sm mt-2">
                            {alerta.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        }
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 flex-shrink-0 text-gray-400" />
                  </div>
                </div>
              </Link>);

          })}
        </div>
      </CardContent>
    </Card>);

}
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Shield,
  AlertTriangle,
  FileCheck,
  Users,
  Lock,
  TrendingUp,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/dashboard/StatCard';
import MatrizRiscos from '../components/governanca/MatrizRiscos';
import TimelineAuditoria from '../components/governanca/TimelineAuditoria';
import ControleAlcadas from '../components/governanca/ControleAlcadas';

export default function Governanca() {
  const { data: riscos = [] } = useQuery({
    queryKey: ['riscos'],
    queryFn: () => base44.entities.Risco.list('-created_date', 100)
  });

  const { data: alcadas = [] } = useQuery({
    queryKey: ['alcadas'],
    queryFn: () => base44.entities.Alcada.list()
  });

  const { data: logsAuditoria = [] } = useQuery({
    queryKey: ['logs-auditoria'],
    queryFn: () => base44.entities.LogAuditoria.list('-created_date', 200)
  });

  const { data: historicoAlteracoes = [] } = useQuery({
    queryKey: ['historico-alteracoes'],
    queryFn: () => base44.entities.HistoricoAlteracao.list('-created_date', 100)
  });

  // Métricas
  const riscosCriticos = riscos.filter(r => r.classificacao_risco === 'critico').length;
  const riscosAltos = riscos.filter(r => r.classificacao_risco === 'alto').length;
  const riscosAtivos = riscos.filter(r => r.status !== 'resolvido').length;
  
  const alcadasAtivas = alcadas.filter(a => a.ativo).length;
  
  const hoje = new Date();
  const logsHoje = logsAuditoria.filter(l => {
    const dataLog = new Date(l.created_date);
    return dataLog.toDateString() === hoje.toDateString();
  }).length;

  const alteracoesRecentes = historicoAlteracoes.filter(h => {
    const dataAlteracao = new Date(h.created_date);
    const diff = Math.abs(hoje - dataAlteracao);
    const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return dias <= 7;
  }).length;

  // Taxa de conformidade (exemplo simplificado)
  const logsSucesso = logsAuditoria.filter(l => l.sucesso).length;
  const taxaConformidade = logsAuditoria.length > 0 
    ? (logsSucesso / logsAuditoria.length) * 100 
    : 100;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Governança, Risco e Compliance"
        subtitle="Controle total de riscos, alçadas e auditoria"
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard
          title="Riscos Críticos"
          value={riscosCriticos}
          subtitle={`${riscosAltos} riscos altos`}
          icon={AlertTriangle}
          iconBg="bg-red-500/10"
          iconColor="text-red-500"
        />
        <StatCard
          title="Alçadas Ativas"
          value={alcadasAtivas}
          subtitle="Controles de aprovação"
          icon={Lock}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
        />
        <StatCard
          title="Logs Hoje"
          value={logsHoje}
          subtitle="Ações registradas"
          icon={FileCheck}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-500"
        />
        <StatCard
          title="Conformidade"
          value={`${taxaConformidade.toFixed(1)}%`}
          subtitle="Taxa de sucesso"
          icon={CheckCircle2}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
        />
      </div>

      {/* Alertas */}
      {(riscosCriticos > 0 || riscosAltos > 0) && (
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <h3 className="text-red-400 font-semibold text-sm mb-0.5">Atenção: Riscos Elevados</h3>
                <p className="text-gray-400 text-xs">
                  {riscosCriticos > 0 && `${riscosCriticos} risco(s) crítico(s) requer(em) ação imediata. `}
                  {riscosAltos > 0 && `${riscosAltos} risco(s) alto(s) em monitoramento.`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="riscos" className="space-y-3">
        <TabsList className="bg-gray-800">
          <TabsTrigger value="riscos" className="data-[state=active]:bg-amber-500 data-[state=active]:text-gray-900">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Gestão de Riscos ({riscosAtivos})
          </TabsTrigger>
          <TabsTrigger value="alcadas" className="data-[state=active]:bg-amber-500 data-[state=active]:text-gray-900">
            <Lock className="w-4 h-4 mr-2" />
            Alçadas ({alcadasAtivas})
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="data-[state=active]:bg-amber-500 data-[state=active]:text-gray-900">
            <FileCheck className="w-4 h-4 mr-2" />
            Auditoria ({logsAuditoria.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="riscos">
          <MatrizRiscos riscos={riscos} />
        </TabsContent>

        <TabsContent value="alcadas">
          <ControleAlcadas alcadas={alcadas} />
        </TabsContent>

        <TabsContent value="auditoria">
          <TimelineAuditoria 
            logs={logsAuditoria} 
            historico={historicoAlteracoes}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
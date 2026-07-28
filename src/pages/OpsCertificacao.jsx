import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Shield, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  RefreshCw,
  Lock,
  Unlock,
  FileCheck,
  History,
  Award
} from 'lucide-react';
import { toast } from 'sonner';
import { PageSkeleton } from '@/components/shared/Skeletons';

export default function OpsCertificacao() {
  const [versionTag, setVersionTag] = useState('');
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  // Verificar status de certificação
  const { data: certStatus, isLoading, refetch } = useQuery({
    queryKey: ['certification-status'],
    queryFn: async () => {
      const res = await base44.functions.invoke('verificarCertificacaoSistema', {});
      return res.data;
    },
    refetchInterval: 30000
  });

  // Buscar QA Gate atual
  const { data: qaStatus } = useQuery({
    queryKey: ['qa-gate-status'],
    queryFn: async () => {
      const checks = await base44.entities.HealthCheck.filter({ tipo: 'qa_gate', archived: false });
      const sorted = checks.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      return sorted[0];
    }
  });

  // Buscar runtime health
  const { data: healthStatus } = useQuery({
    queryKey: ['health-status'],
    queryFn: async () => {
      const checks = await base44.entities.HealthCheck.filter({ tipo: 'producao', archived: false });
      const sorted = checks.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      return sorted[0];
    }
  });

  // Buscar histórico
  const { data: certHistory } = useQuery({
    queryKey: ['certification-history'],
    queryFn: () => base44.entities.SystemCertification.list('-certified_at_iso', 10)
  });

  // Mutation para certificar
  const certifyMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('certificarSistemaProducao', {
        version_tag: versionTag || undefined,
        notes: notes || undefined
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.ok) {
        toast.success(`Sistema certificado! Build: ${data.build_id}`);
        queryClient.invalidateQueries({ queryKey: ['certification-status'] });
        queryClient.invalidateQueries({ queryKey: ['certification-history'] });
        setVersionTag('');
        setNotes('');
      } else {
        toast.error(`Erro: ${data.message || data.error}`);
      }
    },
    onError: (error) => {
      toast.error(`Falha: ${error.message}`);
    }
  });

  const qaOk = qaStatus?.status === 'ok' || qaStatus?.detalhes?.qa_gate_status === 'PASS';
  const healthOk = healthStatus?.status !== 'critical';
  const canCertify = qaOk && healthOk;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CERTIFIED':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" />Certificado</Badge>;
      case 'EXPIRED':
        return <Badge className="bg-orange-100 text-orange-700"><Clock className="w-3 h-3 mr-1" />Expirado</Badge>;
      case 'DEGRADED':
        return <Badge className="bg-yellow-100 text-yellow-700"><AlertTriangle className="w-3 h-3 mr-1" />Degradado</Badge>;
      case 'NOT_CERTIFIED':
        return <Badge className="bg-gray-100 text-gray-700"><XCircle className="w-3 h-3 mr-1" />Não Certificado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <PageSkeleton kpis={3} rows={4} cols={3} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Award className="w-7 h-7 text-purple-600" />
            Certificação de Produção
          </h1>
          <p className="text-gray-500 mt-1">Validação e selo de certificação do ambiente</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Status Card */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                Status da Certificação
              </CardTitle>
              <CardDescription>Estado atual do sistema</CardDescription>
            </div>
            {certStatus && getStatusBadge(certStatus.status)}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {certStatus?.certified_exists ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 uppercase">Build ID</p>
                <p className="font-mono text-sm font-medium">{certStatus.last_certification?.build_id}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 uppercase">Certificado em</p>
                <p className="text-sm font-medium">
                  {new Date(certStatus.last_certification?.certified_at_iso).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 uppercase">Idade</p>
                <p className="text-sm font-medium">
                  {certStatus.age?.days > 0 ? `${certStatus.age.days} dias` : 
                   certStatus.age?.hours > 0 ? `${certStatus.age.hours} horas` :
                   `${certStatus.age?.minutes} min`}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 uppercase">Versão</p>
                <p className="text-sm font-medium">{certStatus.last_certification?.version_tag || '-'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 uppercase">Snapshot Checkpoint</p>
                <p className="font-mono text-xs">{certStatus.last_certification?.snapshot_checkpoint_id?.slice(0, 12)}...</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 uppercase">Config Frozen</p>
                <p className="text-sm font-medium flex items-center gap-1">
                  {certStatus.last_certification?.config_frozen ? (
                    <><Lock className="w-4 h-4 text-green-600" /> Sim</>
                  ) : (
                    <><Unlock className="w-4 h-4 text-orange-600" /> Não</>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <XCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Sistema ainda não foi certificado</p>
            </div>
          )}

          {certStatus?.warnings?.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm font-medium text-yellow-800 mb-1">Avisos:</p>
              <ul className="text-sm text-yellow-700 list-disc list-inside">
                {certStatus.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pre-requisitos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCheck className="w-5 h-5" />
            Pré-requisitos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg border-2 ${qaOk ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-center gap-2">
                {qaOk ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                <span className="font-medium">QA Gate</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Status: {qaStatus?.detalhes?.qa_gate_status || qaStatus?.status || 'Não executado'}
              </p>
            </div>
            <div className={`p-4 rounded-lg border-2 ${healthOk ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-center gap-2">
                {healthOk ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                <span className="font-medium">Runtime Health</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Status: {healthStatus?.status || 'Desconhecido'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Certificar */}
      <Card className={!canCertify ? 'opacity-60' : ''}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-600" />
            Executar Certificação
          </CardTitle>
          <CardDescription>
            Cria snapshot checkpoint, congela configs e registra certificação
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Tag de Versão (opcional)</label>
              <Input
                placeholder="Ex: v1.0.0"
                value={versionTag}
                onChange={(e) => setVersionTag(e.target.value)}
                disabled={!canCertify}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Notas (opcional)</label>
              <Input
                placeholder="Observações sobre a certificação"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!canCertify}
              />
            </div>
          </div>

          <Button
            onClick={() => certifyMutation.mutate()}
            disabled={!canCertify || certifyMutation.isPending}
            className="w-full bg-purple-600 hover:bg-purple-700"
            size="lg"
          >
            {certifyMutation.isPending ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Certificando...</>
            ) : (
              <><Award className="w-4 h-4 mr-2" />Certificar Sistema para Produção</>
            )}
          </Button>

          {!canCertify && (
            <p className="text-sm text-red-600 text-center">
              Resolva os pré-requisitos antes de certificar
            </p>
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="w-5 h-5" />
            Histórico de Certificações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {certHistory?.length > 0 ? (
            <div className="space-y-3">
              {certHistory.map((cert) => (
                <div key={cert.id} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-medium">{cert.build_id}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(cert.certified_at_iso).toLocaleString('pt-BR')} • {cert.certified_by}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {cert.version_tag && (
                      <Badge variant="outline">{cert.version_tag}</Badge>
                    )}
                    <Badge className="bg-green-100 text-green-700">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {cert.qa_gate_status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Nenhuma certificação registrada</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import { 
  ArrowLeft, 
  User,
  Briefcase,
  Calendar,
  Clock,
  Shield,
  FileText,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const statusConfig = {
  ativo: { label: 'Ativo', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  ferias: { label: 'Férias', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  afastado: { label: 'Afastado', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  desligado: { label: 'Desligado', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' }
};

export default function ColaboradorDetalhes() {
  const urlParams = new URLSearchParams(window.location.search);
  const colaboradorId = urlParams.get('id');

  const { data: colaboradorData, isLoading } = useQuery({
    queryKey: ['colaborador', colaboradorId],
    queryFn: () => base44.entities.Colaborador.filter({ id: colaboradorId }),
    enabled: !!colaboradorId
  });

  const { data: apontamentos = [] } = useQuery({
    queryKey: ['apontamentos-colab', colaboradorId],
    queryFn: () => base44.entities.ApontamentoHoras.filter({ colaborador_id: colaboradorId }, '-data', 30),
    enabled: !!colaboradorId
  });

  const { data: epis = [] } = useQuery({
    queryKey: ['epis-colab', colaboradorId],
    queryFn: () => base44.entities.ControleEPI.filter({ colaborador_id: colaboradorId }, '-data_entrega'),
    enabled: !!colaboradorId
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  if (isLoading) {
    return <Skeleton className="h-64 bg-gray-800 rounded-2xl" />;
  }

  const colaborador = colaboradorData?.[0];
  if (!colaborador) {
    return <p className="text-gray-500 text-center py-12">Colaborador não encontrado</p>;
  }

  const status = statusConfig[colaborador.status];
  const obraAtual = obras.find(o => o.id === colaborador.obra_atual);
  const obrasVinculadas = colaborador.obras_vinculadas || [];

  // Estatísticas
  const totalHoras = apontamentos.reduce((acc, a) => acc + (a.horas_trabalhadas || 0), 0);
  const horasExtras = apontamentos.reduce((acc, a) => acc + (a.horas_extras || 0), 0);
  const episAtivos = epis.filter(e => e.status === 'em_uso').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{colaborador.nome}</h1>
              <Badge className={cn("border", status.color)}>{status.label}</Badge>
            </div>
            <p className="text-gray-500">{colaborador.cargo} • {colaborador.departamento}</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-gray-400 text-sm mb-1">Horas Trabalhadas (30d)</p>
            <p className="text-2xl font-bold text-white">{totalHoras.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
            <p className="text-gray-400 text-sm mb-1">Horas Extras</p>
            <p className="text-2xl font-bold text-white">{horasExtras.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Shield className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-gray-400 text-sm mb-1">EPIs Ativos</p>
            <p className="text-2xl font-bold text-white">{episAtivos}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Briefcase className="w-8 h-8 text-purple-500" />
            </div>
            <p className="text-gray-400 text-sm mb-1">Obra Atual</p>
            <p className="text-lg font-bold text-white">{obraAtual?.nome || 'Não alocado'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="apontamentos">
        <TabsList className="bg-gray-900 border border-gray-800">
          <TabsTrigger value="apontamentos" className="data-[state=active]:bg-amber-500 data-[state=active]:text-gray-900">
            <Clock className="w-4 h-4 mr-2" />
            Apontamentos ({apontamentos.length})
          </TabsTrigger>
          <TabsTrigger value="epis" className="data-[state=active]:bg-amber-500 data-[state=active]:text-gray-900">
            <Shield className="w-4 h-4 mr-2" />
            EPIs ({epis.length})
          </TabsTrigger>
          <TabsTrigger value="dados" className="data-[state=active]:bg-amber-500 data-[state=active]:text-gray-900">
            <FileText className="w-4 h-4 mr-2" />
            Dados Pessoais
          </TabsTrigger>
        </TabsList>

        <TabsContent value="apontamentos" className="mt-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-6">
              {apontamentos.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhum apontamento</p>
              ) : (
                <div className="space-y-3">
                  {apontamentos.map(a => (
                    <div key={a.id} className="p-4 bg-gray-800/50 rounded-xl">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white font-medium">{new Date(a.data).toLocaleDateString('pt-BR')}</p>
                          <p className="text-gray-400 text-sm">{a.atividade}</p>
                          <p className="text-gray-500 text-xs mt-1">
                            {a.hora_entrada} - {a.hora_saida} • {a.horas_trabalhadas}h trabalhadas
                            {a.horas_extras > 0 && ` • ${a.horas_extras}h extras`}
                          </p>
                        </div>
                        <Badge className={a.aprovado ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}>
                          {a.aprovado ? 'Aprovado' : 'Pendente'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="epis" className="mt-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-6">
              {epis.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhum EPI registrado</p>
              ) : (
                <div className="space-y-3">
                  {epis.map(epi => (
                    <div key={epi.id} className="p-4 bg-gray-800/50 rounded-xl">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white font-medium">{epi.tipo_epi.replace('_', ' ')}</p>
                          <p className="text-gray-400 text-sm">{epi.descricao}</p>
                          <p className="text-gray-500 text-xs mt-1">
                            Entregue em: {new Date(epi.data_entrega).toLocaleDateString('pt-BR')}
                            {epi.data_validade && ` • Validade: ${new Date(epi.data_validade).toLocaleDateString('pt-BR')}`}
                          </p>
                        </div>
                        <Badge className={cn(
                          "border",
                          epi.status === 'em_uso' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'
                        )}>
                          {epi.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dados" className="mt-6 space-y-4">
          {/* Dados Pessoais */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Dados Pessoais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-400 text-sm mb-1">CPF</p>
                  <p className="text-white font-medium">{colaborador.cpf}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Telefone</p>
                  <p className="text-white font-medium">{colaborador.telefone || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Email Pessoal</p>
                  <p className="text-white font-medium">{colaborador.email || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Data Admissão</p>
                  <p className="text-white font-medium">
                    {colaborador.data_admissao ? new Date(colaborador.data_admissao).toLocaleDateString('pt-BR') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Salário</p>
                  <p className="text-white font-medium">
                    {colaborador.salario ? colaborador.salario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Endereço</p>
                  <p className="text-white font-medium">{colaborador.endereco || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Acesso ao Sistema */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="w-5 h-5" />
                Acesso ao Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              {colaborador.user_email ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div>
                      <p className="text-white font-medium">{colaborador.user_email}</p>
                      <p className="text-gray-400 text-sm mt-1">
                        {colaborador.user_role === 'admin' ? 'Administrador' : 'Usuário Regular'}
                      </p>
                    </div>
                    <Badge className="bg-emerald-500/10 text-emerald-400">Ativo</Badge>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <User className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500">Sem acesso ao sistema</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Obras Vinculadas */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Histórico de Obras ({obrasVinculadas.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {obrasVinculadas.length === 0 ? (
                <div className="text-center py-6">
                  <Briefcase className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500">Nenhuma obra vinculada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {obrasVinculadas.map((vinculo, idx) => {
                    const obra = obras.find(o => o.id === vinculo.obra_id);
                    return (
                      <div key={idx} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                         <div className="flex items-start justify-between mb-2">
                           <p className="text-white font-medium">{obra?.nome || 'Obra não encontrada'}</p>
                           <Badge className={cn(
                             vinculo.status === 'ativo' ? 'bg-emerald-500/10 text-emerald-400' :
                             vinculo.status === 'pausado' ? 'bg-amber-500/10 text-amber-400' :
                             'bg-gray-500/10 text-gray-400'
                           )}>
                             {vinculo.status}
                           </Badge>
                         </div>
                         <div className="flex items-center gap-4 text-xs text-gray-500">
                           <div className="flex items-center gap-1">
                             <Calendar className="w-3 h-3" />
                             {new Date(vinculo.data_inicio).toLocaleDateString('pt-BR')}
                           </div>
                           {vinculo.data_fim && (
                             <>
                               <span>→</span>
                               <div className="flex items-center gap-1">
                                 <Calendar className="w-3 h-3" />
                                 {new Date(vinculo.data_fim).toLocaleDateString('pt-BR')}
                               </div>
                             </>
                           )}
                         </div>
                       </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
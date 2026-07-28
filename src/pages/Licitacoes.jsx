import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  Plus, 
  Search,
  FileText,
  Calendar,
  Trophy,
  AlertCircle,
  MoreVertical,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/dashboard/StatCard';

const statusConfig = {
  em_analise: { label: 'Em Análise', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  habilitado: { label: 'Habilitado', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  proposta_enviada: { label: 'Proposta Enviada', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  vencedor: { label: 'Vencedor', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  perdedor: { label: 'Perdedor', color: 'bg-red-100 text-red-700 border-red-200' },
  desistencia: { label: 'Desistência', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  cancelado: { label: 'Cancelado', color: 'bg-gray-100 text-gray-700 border-gray-200' }
};

const modalidadeConfig = {
  concorrencia: 'Concorrência',
  tomada_preco: 'Tomada de Preço',
  convite: 'Convite',
  pregao: 'Pregão',
  rdc: 'RDC',
  dispensa: 'Dispensa',
  inexigibilidade: 'Inexigibilidade'
};

export default function Licitacoes() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [modalidadeFilter, setModalidadeFilter] = useState('todas');
  const queryClient = useQueryClient();

  const { data: licitacoes = [], isLoading } = useQuery({
    queryKey: ['licitacoes'],
    queryFn: () => base44.entities.Licitacao.list('-data_publicacao', 200)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Licitacao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licitacoes'] });
      toast.success('Licitação excluída!');
    }
  });

  const filteredLicitacoes = licitacoes.filter(l => {
    const matchSearch = l.numero_edital?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       l.objeto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       l.orgao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'todos' || l.status === statusFilter;
    const matchModalidade = modalidadeFilter === 'todas' || l.modalidade === modalidadeFilter;
    return matchSearch && matchStatus && matchModalidade;
  });

  // Stats
  const total = licitacoes.length;
  const emAndamento = licitacoes.filter(l => ['em_analise', 'habilitado', 'proposta_enviada'].includes(l.status)).length;
  const vencidas = licitacoes.filter(l => l.status === 'vencedor').length;
  const taxaSucesso = total > 0 ? ((vencidas / total) * 100).toFixed(1) : 0;

  // Alertas de prazos
  const alertasPrazo = licitacoes.filter(l => {
    if (!l.data_abertura || l.status !== 'em_analise') return false;
    const hoje = new Date();
    const abertura = new Date(l.data_abertura);
    const diasRestantes = Math.ceil((abertura - hoje) / (1000 * 60 * 60 * 24));
    return diasRestantes > 0 && diasRestantes <= 7;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Licitações"
        subtitle="Gestão de editais e participações"
        action={() => window.location.href = createPageUrl('LicitacaoForm')}
        actionLabel="Nova Licitação"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total de Licitações"
          value={total}
          icon={FileText}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
        />
        <StatCard
          title="Em Andamento"
          value={emAndamento}
          icon={Calendar}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-500"
        />
        <StatCard
          title="Vencidas"
          value={vencidas}
          icon={Trophy}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
        />
        <StatCard
          title="Taxa de Sucesso"
          value={`${taxaSucesso}%`}
          icon={Trophy}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-500"
        />
      </div>

      {/* Alertas de Prazo */}
      {alertasPrazo.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-white font-semibold mb-2">Alertas de Prazo</h3>
              <div className="space-y-2">
                {alertasPrazo.map(l => {
                  const diasRestantes = Math.ceil((new Date(l.data_abertura) - new Date()) / (1000 * 60 * 60 * 24));
                  return (
                    <p key={l.id} className="text-amber-400 text-sm">
                      <strong>{l.numero_edital}</strong> - Abertura em {diasRestantes} dia(s) ({new Date(l.data_abertura).toLocaleDateString('pt-BR')})
                    </p>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <Input
            placeholder="Buscar por edital, objeto ou órgão..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            {Object.entries(statusConfig).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={modalidadeFilter} onValueChange={setModalidadeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas Modalidades</SelectItem>
            {Object.entries(modalidadeConfig).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : filteredLicitacoes.length === 0 ? (
        <div className="border border-gray-200 rounded-2xl p-12 text-center bg-white">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhuma licitação encontrada</h3>
          <p className="text-gray-600 mb-6">Cadastre a primeira licitação</p>
          <Link to={createPageUrl('LicitacaoForm')}>
            <Button className="bg-amber-500 hover:bg-amber-600 text-gray-900">
              <Plus className="w-4 h-4 mr-2" />
              Nova Licitação
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLicitacoes.map(licitacao => {
            const status = statusConfig[licitacao.status] || statusConfig.em_analise;
            const diasRestantes = licitacao.data_abertura 
              ? Math.ceil((new Date(licitacao.data_abertura) - new Date()) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <div key={licitacao.id} className="border border-gray-200 rounded-2xl p-6 hover:border-blue-300 transition-colors bg-white">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-gray-900 font-semibold">{licitacao.numero_edital}</h3>
                      <Badge className={cn("border", status.color)}>
                        {status.label}
                      </Badge>
                      <Badge variant="outline" className="text-gray-700 border-gray-300">
                        {modalidadeConfig[licitacao.modalidade]}
                      </Badge>
                    </div>
                    <p className="text-gray-600 mb-2">{licitacao.objeto}</p>
                    <p className="text-gray-500 text-sm">{licitacao.orgao}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
                        <MoreVertical className="w-5 h-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white border-gray-200">
                      <DropdownMenuItem 
                        onClick={() => window.location.href = createPageUrl(`LicitacaoDetalhes?id=${licitacao.id}`)}
                        className="text-gray-700"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver Detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => window.location.href = createPageUrl(`LicitacaoForm?id=${licitacao.id}`)}
                        className="text-gray-700"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => deleteMutation.mutate(licitacao.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Valor Estimado</p>
                    <p className="text-gray-900 font-medium">
                      {licitacao.valor_estimado?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '-'}
                    </p>
                  </div>
                  {licitacao.nossa_proposta && (
                    <div>
                      <p className="text-gray-600">Nossa Proposta</p>
                      <p className="text-amber-600 font-medium">
                        {licitacao.nossa_proposta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-600">Data Abertura</p>
                    <p className="text-gray-900 font-medium">
                      {licitacao.data_abertura ? new Date(licitacao.data_abertura).toLocaleDateString('pt-BR') : '-'}
                      {diasRestantes !== null && diasRestantes > 0 && (
                        <span className={cn("ml-2 text-xs", diasRestantes <= 7 ? "text-amber-600" : "text-gray-500")}>
                          ({diasRestantes}d)
                        </span>
                      )}
                    </p>
                  </div>
                  {licitacao.vencedor_nome && (
                    <div>
                      <p className="text-gray-600">Vencedor</p>
                      <p className="text-gray-900 font-medium">{licitacao.vencedor_nome}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
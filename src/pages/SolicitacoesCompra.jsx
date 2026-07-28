import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Plus, Filter, Eye, Clock, AlertCircle, CheckCircle2
} from 'lucide-react';
import RequisicaoForm from '../components/compras/RequisicaoForm';
import DetalheRequisicaoComAprovacao from '../components/compras/DetalheRequisicaoComAprovacao';

export default function SolicitacoesCompra() {
  const [showNovaRequisicao, setShowNovaRequisicao] = useState(false);
  const [detalheRequisicao, setDetalheRequisicao] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('todas');

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: requisicoes = [], refetch: refetchRequisicoes } = useQuery({
    queryKey: ['requisicoes-compra'],
    queryFn: () => base44.entities.RequisicaoCompra.list('-updated_date', 100)
  });

  const requisicoesFiltradas = filtroStatus === 'todas' 
    ? requisicoes 
    : requisicoes.filter(r => r.status_aprovacao === filtroStatus);

  const statusConfig = {
    'pendente': { label: 'Pendente de Aprovação', bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
    'aprovada': { label: 'Aprovada - Pronta para Cotação', bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle2 },
    'rejeitada': { label: 'Rejeitada', bg: 'bg-red-100', text: 'text-red-800', icon: AlertCircle }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Solicitações de Compra</h1>
          <p className="text-gray-600 mt-1">Gerenciar aprovações de requisições</p>
        </div>
        <Dialog open={showNovaRequisicao} onOpenChange={setShowNovaRequisicao}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Nova Solicitação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Solicitação de Compra</DialogTitle>
            </DialogHeader>
            <RequisicaoForm
              onSuccess={() => {
                setShowNovaRequisicao(false);
                refetchRequisicoes();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-gray-600 text-sm">Total</p>
              <p className="text-2xl font-bold text-blue-600">{requisicoes.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Clock className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-600">
                {requisicoes.filter(r => r.status_aprovacao === 'pendente').length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">Aprovadas</p>
              <p className="text-2xl font-bold text-green-600">
                {requisicoes.filter(r => r.status_aprovacao === 'aprovada').length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-500" />
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="todas">Todos os Status</option>
          <option value="pendente">Pendentes de Aprovação</option>
          <option value="aprovada">Aprovadas</option>
          <option value="rejeitada">Rejeitadas</option>
        </select>
      </div>

      {/* Lista de Requisições */}
      <div className="space-y-3">
        {requisicoesFiltradas.length === 0 ? (
          <Card>
            <CardContent className="pt-12 text-center text-gray-500">
              Nenhuma solicitação encontrada
            </CardContent>
          </Card>
        ) : (
          requisicoesFiltradas.map(req => {
            const config = statusConfig[req.status_aprovacao] || statusConfig['pendente'];
            const Icon = config.icon;
            return (
              <Card key={req.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Icon className={`w-5 h-5 ${config.text}`} />
                        <h3 className="font-semibold text-gray-900">
                          {req.titulo || `Solicitação de ${req.solicitante_nome}`}
                        </h3>
                        <Badge className={`${config.bg} ${config.text}`}>
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{req.descricao_resumo}</p>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Solicitante</p>
                          <p className="font-semibold">{req.solicitante_nome}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Itens</p>
                          <p className="font-semibold">{req.qtd_itens || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Prioridade</p>
                          <p className="font-semibold capitalize">{req.prioridade}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Valor Total</p>
                          <p className="font-semibold">
                            R$ {(req.valor_total_estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => {
                      setDetalheRequisicao(req);
                    }} title="Ver Detalhes & Aprovar/Rejeitar">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Modal de Detalhe e Aprovação */}
      <DetalheRequisicaoComAprovacao
        requisicao={detalheRequisicao}
        open={!!detalheRequisicao}
        onClose={() => {
          setDetalheRequisicao(null);
          refetchRequisicoes();
        }}
        userRole={user?.role || user?.cargo}
      />
    </div>
  );
}
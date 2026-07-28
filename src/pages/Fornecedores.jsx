import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Plus, 
  Search,
  Truck,
  Star,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/dashboard/StatCard';
import { CardGridSkeleton } from '@/components/shared/Skeletons';

const statusConfig = {
  ativo: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  inativo: { label: 'Inativo', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  bloqueado: { label: 'Bloqueado', color: 'bg-red-100 text-red-700 border-red-200' }
};

export default function Fornecedores() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [segmentoFilter, setSegmentoFilter] = useState('todos');
  const [cidadeFilter, setCidadeFilter] = useState('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState(null);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    nome: '',
    nome_fantasia: '',
    cnpj: '',
    email: '',
    telefone: '',
    endereco: '',
    cidade: '',
    estado: '',
    contato_principal: '',
    categorias_fornecimento: [],
    prazo_pagamento_padrao: '',
    condicoes_comerciais: '',
    status: 'ativo',
    observacoes: ''
  });

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.list('-created_date', 100)
  });

  const { data: avaliacoes = [] } = useQuery({
    queryKey: ['avaliacoes-fornecedores'],
    queryFn: () => base44.entities.AvaliacaoFornecedor.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Fornecedor.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      toast.success('Fornecedor cadastrado!');
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Fornecedor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      toast.success('Fornecedor atualizado!');
      resetForm();
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      nome_fantasia: '',
      cnpj: '',
      email: '',
      telefone: '',
      endereco: '',
      cidade: '',
      estado: '',
      contato_principal: '',
      categorias_fornecimento: [],
      prazo_pagamento_padrao: '',
      condicoes_comerciais: '',
      status: 'ativo',
      observacoes: ''
    });
    setEditingFornecedor(null);
    setDialogOpen(false);
  };

  const handleEdit = (fornecedor) => {
    setFormData({
      nome: fornecedor.nome || '',
      nome_fantasia: fornecedor.nome_fantasia || '',
      cnpj: fornecedor.cnpj || '',
      email: fornecedor.email || '',
      telefone: fornecedor.telefone || '',
      endereco: fornecedor.endereco || '',
      cidade: fornecedor.cidade || '',
      estado: fornecedor.estado || '',
      contato_principal: fornecedor.contato_principal || '',
      categorias_fornecimento: fornecedor.categorias_fornecimento || [],
      prazo_pagamento_padrao: fornecedor.prazo_pagamento_padrao || '',
      condicoes_comerciais: fornecedor.condicoes_comerciais || '',
      status: fornecedor.status || 'ativo',
      observacoes: fornecedor.observacoes || ''
    });
    setEditingFornecedor(fornecedor);
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingFornecedor) {
      updateMutation.mutate({ id: editingFornecedor.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleCategoria = (categoria) => {
    const cats = formData.categorias_fornecimento || [];
    if (cats.includes(categoria)) {
      setFormData({ ...formData, categorias_fornecimento: cats.filter(c => c !== categoria) });
    } else {
      setFormData({ ...formData, categorias_fornecimento: [...cats, categoria] });
    }
  };

  const getAvaliacaoMedia = (fornecedorId) => {
    const avalsFornecedor = avaliacoes.filter(a => a.fornecedor_id === fornecedorId);
    if (avalsFornecedor.length === 0) return null;
    const soma = avalsFornecedor.reduce((acc, a) => acc + (a.nota_geral || 0), 0);
    return (soma / avalsFornecedor.length).toFixed(1);
  };

  const filteredFornecedores = fornecedores.filter(f => {
    const matchSearch = f.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       f.nome_fantasia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       f.cnpj?.includes(searchTerm);
    const matchStatus = statusFilter === 'todos' || f.status === statusFilter;
    const matchSegmento = segmentoFilter === 'todos' || f.categorias_fornecimento?.includes(segmentoFilter);
    const matchCidade = cidadeFilter === 'todos' || f.cidade === cidadeFilter;
    return matchSearch && matchStatus && matchSegmento && matchCidade;
  });

  const cidadesUnicas = [...new Set(fornecedores.map(f => f.cidade).filter(Boolean))];

  const fornecedoresAtivos = fornecedores.filter(f => f.status === 'ativo').length;
  const fornecedoresBloqueados = fornecedores.filter(f => f.status === 'bloqueado').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Fornecedores"
        subtitle="Cadastro e avaliação de fornecedores"
        action={() => { resetForm(); setDialogOpen(true); }}
        actionLabel="Novo Fornecedor"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Fornecedores"
          value={fornecedores.length}
          icon={Truck}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
        />
        <StatCard
          title="Ativos"
          value={fornecedoresAtivos}
          icon={Truck}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
        />
        <StatCard
          title="Bloqueados"
          value={fornecedoresBloqueados}
          icon={Truck}
          iconBg="bg-red-500/10"
          iconColor="text-red-500"
        />
        <StatCard
          title="Avaliações"
          value={avaliacoes.length}
          icon={Star}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-500"
        />
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <Input
            placeholder="Buscar por nome, fantasia ou CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
            <SelectItem value="bloqueado">Bloqueado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={segmentoFilter} onValueChange={setSegmentoFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Segmentos</SelectItem>
            <SelectItem value="materiais">Materiais</SelectItem>
            <SelectItem value="equipamentos">Equipamentos</SelectItem>
            <SelectItem value="servicos">Serviços</SelectItem>
            <SelectItem value="transporte">Transporte</SelectItem>
            <SelectItem value="mao_obra">Mão de Obra</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Select value={cidadeFilter} onValueChange={setCidadeFilter}>
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue placeholder="Cidade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todas Cidades</SelectItem>
          {cidadesUnicas.map(cidade => (
            <SelectItem key={cidade} value={cidade}>{cidade}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Lista */}
      {isLoading ? (
        <CardGridSkeleton count={6} cols="md:grid-cols-2 lg:grid-cols-3" />
      ) : filteredFornecedores.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhum fornecedor</h3>
            <p className="text-gray-600 mb-6">Comece cadastrando seu primeiro fornecedor</p>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Fornecedor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFornecedores.map(fornecedor => {
            const status = statusConfig[fornecedor.status] || statusConfig.ativo;
            const avaliacaoMedia = getAvaliacaoMedia(fornecedor.id);

            return (
              <Card 
                key={fornecedor.id}
                className="hover:border-blue-300 transition-all cursor-pointer shadow-sm hover:shadow-md"
                onClick={() => handleEdit(fornecedor)}
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-gray-900 font-semibold">{fornecedor.nome}</h3>
                      {fornecedor.nome_fantasia && (
                        <p className="text-gray-600 text-sm">{fornecedor.nome_fantasia}</p>
                      )}
                    </div>
                    <Badge className={cn("border", status.color)}>
                      {status.label}
                    </Badge>
                  </div>

                  {avaliacaoMedia && (
                    <div className="flex items-center gap-1 mb-3">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="text-amber-400 font-semibold">{avaliacaoMedia}</span>
                      <span className="text-gray-500 text-sm">
                        ({avaliacoes.filter(a => a.fornecedor_id === fornecedor.id).length} avaliações)
                      </span>
                    </div>
                  )}

                  <div className="space-y-2 text-sm">
                    {fornecedor.email && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{fornecedor.email}</span>
                      </div>
                    )}
                    {fornecedor.telefone && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span>{fornecedor.telefone}</span>
                      </div>
                    )}
                    {(fornecedor.cidade || fornecedor.estado) && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-4 h-4" />
                        <span>{fornecedor.cidade}{fornecedor.cidade && fornecedor.estado && ', '}{fornecedor.estado}</span>
                      </div>
                    )}
                  </div>

                  {fornecedor.categorias_fornecimento && fornecedor.categorias_fornecimento.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {fornecedor.categorias_fornecimento.map((cat, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingFornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Razão Social *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Nome Fantasia</Label>
                <Input
                  value={formData.nome_fantasia}
                  onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input
                  mask="cnpj"
                  placeholder="00.000.000/0000-00"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  mask="telefone"
                  placeholder="(00) 00000-0000"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div className="col-span-2">
                <Label>Categorias de Fornecimento</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {['materiais', 'equipamentos', 'servicos', 'transporte', 'mao_obra'].map(cat => (
                    <Button
                      key={cat}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => toggleCategoria(cat)}
                      className={cn(
                        formData.categorias_fornecimento?.includes(cat) && "bg-blue-500 text-white border-blue-500"
                      )}
                    >
                      {cat.replace('_', ' ')}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Prazo Pagamento</Label>
                <Input
                  value={formData.prazo_pagamento_padrao}
                  onChange={(e) => setFormData({ ...formData, prazo_pagamento_padrao: e.target.value })}
                  placeholder="Ex: 30 dias"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                    <SelectItem value="bloqueado">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Condições Comerciais</Label>
                <Textarea
                  value={formData.condicoes_comerciais}
                  onChange={(e) => setFormData({ ...formData, condicoes_comerciais: e.target.value })}
                  className="mt-1.5"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
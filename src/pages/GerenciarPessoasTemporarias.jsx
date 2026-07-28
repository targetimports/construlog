import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, ArrowRight, Trash2, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { garantirAcessoColaborador } from '@/components/shared/acessoColaborador';

export default function GerenciarPessoasTemporarias() {
  const queryClient = useQueryClient();
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [busca, setBusca] = useState('');
  const [converterDialog, setConverterDialog] = useState(null);
  const [formConversao, setFormConversao] = useState({
    tipo_destino: 'colaborador',
    cargo: '',
    salario: 0,
    data_admissao: new Date().toISOString().split('T')[0]
  });

  const { data: temporarios = [] } = useQuery({
    queryKey: ['pessoas-temporarias'],
    queryFn: () => base44.entities.PessoaTemporaria.filter({ status: 'temporario' })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PessoaTemporaria.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['pessoas-temporarias']);
      toast.success('Pessoa temporária excluída');
    }
  });

  const converterMutation = useMutation({
    mutationFn: async ({ pessoa, dadosAdicionais }) => {
      let novoId = null;

      // Criar registro definitivo baseado no tipo
      if (dadosAdicionais.tipo_destino === 'colaborador') {
        const colaborador = await base44.entities.Colaborador.create({
          nome: pessoa.nome,
          cpf: pessoa.cpf,
          telefone: pessoa.telefone,
          email: pessoa.email,
          cargo: dadosAdicionais.cargo || pessoa.funcao,
          salario: dadosAdicionais.salario,
          data_admissao: dadosAdicionais.data_admissao,
          status: 'ativo'
        });
        novoId = colaborador.id;
        // Regra-mãe: tornar o colaborador um usuário do sistema (se tiver e-mail + CPF)
        const acesso = await garantirAcessoColaborador({
          id: novoId, nome: pessoa.nome, email: pessoa.email, cpf: pessoa.cpf,
          user_role: dadosAdicionais.user_role,
        });
        if (acesso.status === 'criado') toast.success('Acesso de usuário criado (senha inicial = CPF).');
      } else if (dadosAdicionais.tipo_destino === 'motorista') {
        const motorista = await base44.entities.Motorista.create({
          nome: pessoa.nome,
          cpf: pessoa.cpf,
          telefone: pessoa.telefone,
          categoria_cnh: 'D',
          status: 'ativo'
        });
        novoId = motorista.id;
      }

      // Atualizar pessoa temporária
      await base44.entities.PessoaTemporaria.update(pessoa.id, {
        status: 'convertido',
        convertido_para_id: novoId,
        data_conversao: new Date().toISOString()
      });

      return { sucesso: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['pessoas-temporarias']);
      queryClient.invalidateQueries(['colaboradores']);
      queryClient.invalidateQueries(['motoristas']);
      toast.success('Pessoa convertida com sucesso!');
      setConverterDialog(null);
    }
  });

  const temporariosFiltrados = temporarios.filter(t => {
    const matchTipo = filtroTipo === 'todos' || t.tipo === filtroTipo;
    const matchBusca = t.nome.toLowerCase().includes(busca.toLowerCase()) ||
                       (t.cpf && t.cpf.includes(busca)) ||
                       (t.email && t.email.toLowerCase().includes(busca.toLowerCase()));
    return matchTipo && matchBusca;
  });

  const tipoCor = {
    colaborador: 'bg-blue-100 text-blue-700',
    motorista: 'bg-purple-100 text-purple-700',
    fornecedor: 'bg-green-100 text-green-700',
    visitante: 'bg-gray-100 text-gray-700',
    terceirizado: 'bg-yellow-100 text-yellow-700'
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Pessoas Temporárias</h1>
        <p className="text-gray-600 mt-1">Gerencie cadastros temporários e converta para registros completos</p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Total</div>
            <div className="text-2xl font-bold">{temporarios.length}</div>
          </CardContent>
        </Card>
        {['colaborador', 'motorista', 'fornecedor', 'terceirizado'].map(tipo => (
          <Card key={tipo}>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600 mb-1 capitalize">{tipo}s</div>
              <div className="text-2xl font-bold">
                {temporarios.filter(t => t.tipo === tipo).length}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nome, CPF ou email..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                <SelectItem value="colaborador">Colaborador</SelectItem>
                <SelectItem value="motorista">Motorista</SelectItem>
                <SelectItem value="fornecedor">Fornecedor</SelectItem>
                <SelectItem value="visitante">Visitante</SelectItem>
                <SelectItem value="terceirizado">Terceirizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Pessoas */}
      <div className="grid gap-3">
        {temporariosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-gray-500">
              Nenhuma pessoa temporária encontrada
            </CardContent>
          </Card>
        ) : (
          temporariosFiltrados.map(pessoa => (
            <Card key={pessoa.id} className="border-orange-200 bg-orange-50/30">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">{pessoa.nome}</h3>
                      <Badge className="bg-orange-100 text-orange-700 border-orange-300">
                        TEMP
                      </Badge>
                      <Badge className={tipoCor[pessoa.tipo]}>
                        {pessoa.tipo}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-600">
                      {pessoa.cpf && <div>CPF: {pessoa.cpf}</div>}
                      {pessoa.telefone && <div>{pessoa.telefone}</div>}
                      {pessoa.email && <div>{pessoa.email}</div>}
                      {pessoa.funcao && <div>{pessoa.funcao}</div>}
                    </div>
                    {pessoa.empresa && (
                      <div className="mt-2 text-sm text-gray-600">
                        Empresa: {pessoa.empresa}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setConverterDialog(pessoa);
                        setFormConversao({
                          tipo_destino: pessoa.tipo === 'motorista' ? 'motorista' : 'colaborador',
                          cargo: pessoa.funcao || '',
                          salario: 0,
                          data_admissao: new Date().toISOString().split('T')[0]
                        });
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <ArrowRight className="w-4 h-4 mr-1" />
                      Converter
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm(`Excluir ${pessoa.nome}?`)) {
                          deleteMutation.mutate(pessoa.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialog de Conversão */}
      <Dialog open={!!converterDialog} onOpenChange={() => setConverterDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Converter para Cadastro Completo</DialogTitle>
          </DialogHeader>

          {converterDialog && (
            <div className="space-y-4 pt-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="font-semibold text-gray-900">{converterDialog.nome}</div>
                <div className="text-sm text-gray-600">
                  {converterDialog.cpf} • {converterDialog.tipo}
                </div>
              </div>

              <div>
                <Label>Converter para *</Label>
                <Select 
                  value={formConversao.tipo_destino} 
                  onValueChange={(v) => setFormConversao({...formConversao, tipo_destino: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="colaborador">Colaborador</SelectItem>
                    <SelectItem value="motorista">Motorista</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formConversao.tipo_destino === 'colaborador' && (
                <>
                  <div>
                    <Label>Cargo</Label>
                    <Input
                      value={formConversao.cargo}
                      onChange={(e) => setFormConversao({...formConversao, cargo: e.target.value})}
                      placeholder="Ex: Pedreiro"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Salário</Label>
                      <Input
                        type="number"
                        value={formConversao.salario}
                        onChange={(e) => setFormConversao({...formConversao, salario: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div>
                      <Label>Data Admissão</Label>
                      <Input
                        type="date"
                        value={formConversao.data_admissao}
                        onChange={(e) => setFormConversao({...formConversao, data_admissao: e.target.value})}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setConverterDialog(null)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => converterMutation.mutate({
                    pessoa: converterDialog,
                    dadosAdicionais: formConversao
                  })}
                  disabled={converterMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {converterMutation.isPending ? 'Convertendo...' : 'Converter'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Mail, Phone, MapPin, Plus } from 'lucide-react';
import PermissaoGuard from '../components/shared/PermissaoGuard';

export default function Pessoas() {
  const [filtroStatus, setFiltroStatus] = useState('ativo');

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list('-updated_date', 100)
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const colaboradoresFiltrados = filtroStatus === 'todos'
    ? colaboradores
    : colaboradores.filter(c => c.status === filtroStatus);

  const statusConfig = {
    'ativo': { label: 'Ativo', bg: 'bg-green-100', text: 'text-green-800' },
    'inativo': { label: 'Inativo', bg: 'bg-gray-100', text: 'text-gray-800' },
    'ferias': { label: 'Férias', bg: 'bg-blue-100', text: 'text-blue-800' },
    'afastado': { label: 'Afastado', bg: 'bg-orange-100', text: 'text-orange-800' },
    'desligado': { label: 'Desligado', bg: 'bg-red-100', text: 'text-red-800' }
  };

  const tipoContratoConfig = {
    'clt': 'CLT',
    'pj': 'PJ',
    'terceirizado': 'Terceirizado',
    'temporario': 'Temporário'
  };

  const totalColaboradores = colaboradores.length;
  const ativos = colaboradores.filter(c => c.status === 'ativo').length;
  const emFerias = colaboradores.filter(c => c.status === 'ferias').length;
  const afastados = colaboradores.filter(c => c.status === 'afastado').length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestão de Pessoas</h1>
          <p className="text-gray-600 mt-1">Colaboradores e Recursos Humanos</p>
        </div>
        <PermissaoGuard acao="criar" modulo="pessoas">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Novo Colaborador
          </Button>
        </PermissaoGuard>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">Total</p>
              <p className="text-2xl font-bold">{totalColaboradores}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">Ativos</p>
              <p className="text-2xl font-bold text-green-600">{ativos}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">Em Férias</p>
              <p className="text-2xl font-bold text-blue-600">{emFerias}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">Afastados</p>
              <p className="text-2xl font-bold text-orange-600">{afastados}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-gray-600 text-sm">Custo Mensal</p>
              <p className="text-lg font-bold text-gray-700">
                R$ {colaboradores.reduce((sum, c) => sum + (c.salario || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-2">
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="todos">Todos</option>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
          <option value="ferias">Em Férias</option>
          <option value="afastado">Afastados</option>
          <option value="desligado">Desligados</option>
        </select>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {colaboradoresFiltrados.length === 0 ? (
          <Card>
            <CardContent className="pt-12 text-center text-gray-500">
              Nenhum colaborador encontrado
            </CardContent>
          </Card>
        ) : (
          colaboradoresFiltrados.map(colab => {
            const config = statusConfig[colab.status] || statusConfig['ativo'];
            return (
              <Card key={colab.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Users className="w-5 h-5 text-gray-600" />
                        <h3 className="font-semibold">{colab.nome}</h3>
                        <Badge className={`${config.bg} ${config.text}`}>
                          {config.label}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-gray-500">Email</p>
                            <p className="font-semibold text-xs">{colab.email}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-gray-500">Cargo</p>
                          <p className="font-semibold">{colab.cargo}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Contrato</p>
                          <p className="font-semibold">{tipoContratoConfig[colab.tipo_contrato]}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Departamento</p>
                          <p className="font-semibold">{colab.departamento || 'N/A'}</p>
                        </div>
                      </div>

                      {colab.telefone && (
                        <div className="flex items-center gap-2 text-sm mt-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <p>{colab.telefone}</p>
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm">Ver Detalhes</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
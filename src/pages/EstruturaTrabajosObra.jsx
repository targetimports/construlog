import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';

export default function EstruturaTrabajosObra() {
  const [searchParams] = useSearchParams();
  const obra_id = searchParams.get('obra_id');
  const [expandedCC, setExpandedCC] = useState(null);
  const [expandedEtapa, setExpandedEtapa] = useState(null);
  const queryClient = useQueryClient();

  const { data: obra } = useQuery({
    queryKey: ['obra', obra_id],
    queryFn: () => base44.entities.Obra.read(obra_id),
    enabled: !!obra_id
  });

  const { data: centrosCusto = [] } = useQuery({
    queryKey: ['centrosCusto', obra_id],
    queryFn: () => base44.entities.CentroCusto.filter({ obra_id }),
    enabled: !!obra_id
  });

  const { data: etapas = [] } = useQuery({
    queryKey: ['etapas', obra_id],
    queryFn: () => base44.entities.Etapa.filter({ obra_id }),
    enabled: !!obra_id
  });

  const { data: frentes = [] } = useQuery({
    queryKey: ['frentes', obra_id],
    queryFn: () => base44.entities.FrenteServico.filter({ obra_id }),
    enabled: !!obra_id
  });

  const { data: pacotes = [] } = useQuery({
    queryKey: ['pacotes', obra_id],
    queryFn: () => base44.entities.PacoteTrabalho.filter({ obra_id }),
    enabled: !!obra_id
  });

  const criarCCMutation = useMutation({
    mutationFn: (data) => base44.entities.CentroCusto.create({ obra_id, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['centrosCusto'] });
      toast.success('Centro de custo criado!');
    }
  });

  if (!obra_id) return <div className="text-center py-12">Obra não selecionada</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{obra?.nome}</h1>
          <p className="text-gray-600">Estrutura WBS - Centros, Etapas, Frentes e Pacotes</p>
        </div>
      </div>

      {/* CENTROS DE CUSTO */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Centros de Custo</CardTitle>
          <Button 
            size="sm"
            onClick={() => {
              const nome = prompt('Nome do centro:');
              if (nome) criarCCMutation.mutate({ nome });
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {centrosCusto.map(cc => {
            const etapasCC = etapas.filter(e => e.obra_id === obra_id);
            const ativas = etapasCC.length;
            const isExpanded = expandedCC === cc.id;

            return (
              <div key={cc.id} className="border rounded-lg p-3">
                <button
                  onClick={() => setExpandedCC(isExpanded ? null : cc.id)}
                  className="w-full flex items-center justify-between hover:bg-gray-50 p-2 rounded"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">{cc.nome}</p>
                      <p className="text-xs text-gray-500">{ativas} etapas</p>
                    </div>
                  </div>
                  <Badge variant={cc.ativo ? 'default' : 'outline'}>
                    {cc.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </button>

                {isExpanded && (
                  <div className="ml-8 mt-3 space-y-2 border-l-2 border-blue-200 pl-4">
                    <p className="text-sm text-gray-600">Etapas vinculadas a esta obra</p>
                    {etapasCC.map(etapa => (
                      <div key={etapa.id} className="p-2 bg-blue-50 rounded text-sm">
                        {etapa.nome}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ETAPAS */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Etapas</CardTitle>
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Nova Etapa
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {etapas.filter(e => e.ativo).map(etapa => (
            <div key={etapa.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-gray-900">{etapa.nome}</p>
                  <p className="text-xs text-gray-500">Ordem: {etapa.ordem}</p>
                </div>
              </div>
              {etapa.data_inicio_prevista && (
                <p className="text-xs text-gray-600">
                  {new Date(etapa.data_inicio_prevista).toLocaleDateString()} até {new Date(etapa.data_fim_prevista).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* RESUMO */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Centros de Custo</p>
            <p className="text-2xl font-bold text-blue-600">{centrosCusto.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Etapas</p>
            <p className="text-2xl font-bold text-green-600">{etapas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Frentes/Pacotes</p>
            <p className="text-2xl font-bold text-purple-600">{frentes.length + pacotes.length}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
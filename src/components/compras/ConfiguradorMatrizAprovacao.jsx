/**
 * Interface para Configurar Matriz de Aprovação por Alçadas
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

export default function ConfiguradorMatrizAprovacao() {
  const [expandedId, setExpandedId] = useState(null);
  const [showFormNova, setShowFormNova] = useState(false);
  const queryClient = useQueryClient();

  const { data: alcadas, isLoading } = useQuery({
    queryKey: ['alcadas'],
    queryFn: () => base44.entities.AlcadaAprovacao.list()
  });

  const mutacaoCriar = useMutation({
    mutationFn: (dados) => base44.entities.AlcadaAprovacao.create(dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alcadas'] });
      setShowFormNova(false);
      toast.success('Alçada criada com sucesso');
    }
  });

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Matriz de Aprovação</h2>
        <Button onClick={() => setShowFormNova(!showFormNova)} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Alçada
        </Button>
      </div>

      {showFormNova && (
        <FormNovaAlcada
          onSalvar={(dados) => mutacaoCriar.mutate(dados)}
          onCancelar={() => setShowFormNova(false)}
          loading={mutacaoCriar.isPending}
        />
      )}

      <div className="space-y-3">
        {alcadas?.map((alcada) => (
          <CardAlcada
            key={alcada.id}
            alcada={alcada}
            expanded={expandedId === alcada.id}
            onToggle={() => setExpandedId(expandedId === alcada.id ? null : alcada.id)}
          />
        ))}
      </div>
    </div>
  );
}

function CardAlcada({ alcada, expanded, onToggle }) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow">
      <CardHeader onClick={onToggle} className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <span>{alcada.nome}</span>
            <Badge variant="outline">Nível {alcada.nivel}</Badge>
            {alcada.ativa ? (
              <Badge className="bg-green-100 text-green-800">Ativa</Badge>
            ) : (
              <Badge className="bg-gray-100 text-gray-800">Inativa</Badge>
            )}
          </CardTitle>
        </div>
        <ChevronDown
          className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-sm mb-2">Valor</h4>
              <p className="text-sm text-gray-600">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                }).format(alcada.criterios.valor_minimo || 0)}{' '}
                a{' '}
                {alcada.criterios.valor_maximo
                  ? new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(alcada.criterios.valor_maximo)
                  : 'Ilimitado'}
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Tipo de Compra</h4>
              <p className="text-sm text-gray-600">
                {alcada.criterios.tipos_compra?.length > 0
                  ? alcada.criterios.tipos_compra.join(', ')
                  : 'Todos'}
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Categorias</h4>
              <p className="text-sm text-gray-600">
                {alcada.criterios.categorias?.length > 0
                  ? alcada.criterios.categorias.join(', ')
                  : 'Todas'}
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Aprovadores</h4>
              <p className="text-sm text-gray-600">
                {alcada.aprovadores?.length || 0} usuário(s)
                {alcada.requer_todos_aprovadores && ' (todos)'}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t">
            <h4 className="font-semibold text-sm mb-2">Aprovadores</h4>
            <div className="space-y-1">
              {alcada.aprovadores?.map((ap) => (
                <div key={ap.user_email} className="text-sm">
                  <span className="font-medium">{ap.nome}</span>
                  <span className="text-gray-500"> ({ap.user_email})</span>
                  {ap.cargo && <span className="text-gray-400"> - {ap.cargo}</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="gap-1">
              <Edit2 className="w-3 h-3" /> Editar
            </Button>
            <Button variant="destructive" size="sm" className="gap-1">
              <Trash2 className="w-3 h-3" /> Deletar
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function FormNovaAlcada({ onSalvar, onCancelar, loading }) {
  const [nome, setNome] = useState('');
  const [nivel, setNivel] = useState('');

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle>Nova Alçada</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            placeholder="Nome (ex: Gerente)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Input
            placeholder="Nível (1, 2, 3...)"
            type="number"
            value={nivel}
            onChange={(e) => setNivel(e.target.value)}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onSalvar({
                nome,
                nivel: parseInt(nivel),
                criterios: {
                  valor_minimo: 0,
                  tipos_compra: [],
                  categorias: [],
                  obras_ids: [],
                  centros_custo: []
                },
                aprovadores: [],
                ativa: true
              })
            }
            loading={loading}
          >
            Criar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Settings, Save, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';

export default function ConfiguracaoApontamentos() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroObra, setFiltroObra] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [materialEditando, setMaterialEditando] = useState(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const queryClient = useQueryClient();

  const { data: materiais = [] } = useQuery({
    queryKey: ['materiais-config'],
    queryFn: () => base44.entities.Material.list('-created_date', 500)
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const atualizarMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Material.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['materiais-config']);
      toast.success('Configuração atualizada!');
      setMaterialEditando(null);
      setDialogAberto(false);
    }
  });

  const materiaiFiltrados = materiais.filter(mat => {
    const matchSearch = mat.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        mat.codigo?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchObra = filtroObra === 'todos' || mat.obra_id === filtroObra;
    const matchCategoria = filtroCategoria === 'todos' || mat.categoria === filtroCategoria;
    return matchSearch && matchObra && matchCategoria;
  });

  const materiaisComApontamento = materiais.filter(m => m.requer_apontamento_semanal).length;

  const motivoConfig = {
    controle_critico: 'Controle Crítico',
    alto_custo: 'Alto Custo',
    risco_seguranca: 'Risco de Segurança',
    rotacao_rapida: 'Rotação Rápida',
    outro: 'Outro'
  };

  const categoriaConfig = {
    cimento: 'Cimento',
    areia: 'Areia',
    brita: 'Brita',
    aco: 'Aço',
    madeira: 'Madeira',
    eletrico: 'Elétrico',
    hidraulico: 'Hidráulico',
    acabamento: 'Acabamento',
    epi: 'EPI',
    ferramentas: 'Ferramentas',
    outros: 'Outros'
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuração de Apontamentos"
        subtitle="Defina quais materiais requerem apontamento semanal obrigatório"
        actionIcon={Settings}
      />

      {/* Stats */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 border-0 shadow-lg">
           <CardContent className="pt-6">
             <div className="text-3xl font-bold text-white mb-1">{materiais.length}</div>
             <div className="text-sm text-indigo-100">Total de Materiais</div>
           </CardContent>
         </Card>

         <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 shadow-lg">
           <CardContent className="pt-6">
             <div className="text-3xl font-bold text-white mb-1">{materiaisComApontamento}</div>
             <div className="text-sm text-emerald-100">Com Apontamento Obrigatório</div>
           </CardContent>
         </Card>

         <Card className="bg-gradient-to-br from-orange-500 to-orange-600 border-0 shadow-lg">
           <CardContent className="pt-6">
             <div className="text-3xl font-bold text-white mb-1">
               {((materiaisComApontamento / materiais.length) * 100).toFixed(0)}%
             </div>
             <div className="text-sm text-orange-100">Taxa de Apontamento</div>
           </CardContent>
         </Card>
       </div>

      {/* Filtros */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
              <Label className="text-gray-700 mb-2 block text-sm font-medium">Buscar Material</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Nome ou código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white border-gray-300 text-gray-900"
                />
              </div>
            </div>

            <div className="flex-1">
              <Label className="text-gray-700 mb-2 block text-sm font-medium">Obra</Label>
              <Select value={filtroObra} onValueChange={setFiltroObra}>
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  <SelectItem value="todos">Todas as Obras</SelectItem>
                  {obras.map(obra => (
                    <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label className="text-gray-700 mb-2 block text-sm font-medium">Categoria</Label>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  <SelectItem value="todos">Todas</SelectItem>
                  {Object.entries(categoriaConfig).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Materiais */}
      <div className="space-y-3">
        {materiaiFiltrados.length === 0 ? (
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhum material encontrado com os filtros aplicados</p>
            </CardContent>
          </Card>
        ) : (
          materiaiFiltrados.map(material => {
            const obra = obras.find(o => o.id === material.obra_id);

            return (
              <Card
                key={material.id}
                className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-all"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-lg font-semibold text-gray-900">{material.nome}</h3>
                        <Badge className="text-xs bg-gray-200 text-gray-700">
                          {material.codigo || 'Sem código'}
                        </Badge>
                        <Badge className="text-xs bg-blue-100 text-blue-700">
                          {categoriaConfig[material.categoria]}
                        </Badge>
                      </div>

                      <div className="text-sm text-gray-600 space-y-1">
                        {obra && <div>Obra: {obra.nome}</div>}
                        <div>Estoque: {material.estoque_atual} {material.unidade}</div>
                        <div>Mínimo: {material.estoque_minimo} {material.unidade}</div>
                      </div>

                      {material.requer_apontamento_semanal && (
                        <div className="mt-3 flex gap-2 flex-wrap">
                          <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-300">
                            ✓ Apontamento Obrigatório
                          </Badge>
                          {material.motivo_apontamento && (
                            <Badge className="bg-orange-100 text-orange-700 border border-orange-300">
                              {motivoConfig[material.motivo_apontamento]}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => {
                        setMaterialEditando(material);
                        setDialogAberto(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium gap-2 flex-shrink-0"
                    >
                      <Settings className="w-4 h-4" />
                      Configurar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Dialog de Configuração */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="bg-white border-gray-200 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              Configurar Apontamento - {materialEditando?.nome}
            </DialogTitle>
          </DialogHeader>

          {materialEditando && (
            <div className="space-y-5">
              {/* Switch Apontamento Obrigatório */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-900 font-medium">Apontamento Obrigatório</Label>
                    <p className="text-sm text-gray-600 mt-1">
                      Este material requer apontamento semanal?
                    </p>
                  </div>
                  <Switch
                    checked={materialEditando.requer_apontamento_semanal}
                    onCheckedChange={(checked) =>
                      setMaterialEditando({
                        ...materialEditando,
                        requer_apontamento_semanal: checked
                      })
                    }
                  />
                </div>
              </div>

              {/* Motivo do Apontamento */}
              {materialEditando.requer_apontamento_semanal && (
                <div>
                  <Label className="text-gray-700 mb-2 block text-sm font-medium">Motivo do Apontamento</Label>
                  <Select
                    value={materialEditando.motivo_apontamento || ''}
                    onValueChange={(value) =>
                      setMaterialEditando({
                        ...materialEditando,
                        motivo_apontamento: value
                      })
                    }
                  >
                    <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300">
                      {Object.entries(motivoConfig).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Informações do Material */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                <div>
                  <Label className="text-gray-700 text-xs font-medium">Categoria</Label>
                  <div className="text-gray-900 font-medium mt-1">{categoriaConfig[materialEditando.categoria]}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-700 text-xs font-medium">Estoque Atual</Label>
                    <div className="text-gray-900 font-medium mt-1">
                      {materialEditando.estoque_atual} {materialEditando.unidade}
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-700 text-xs font-medium">Estoque Mínimo</Label>
                    <div className="text-gray-900 font-medium mt-1">
                      {materialEditando.estoque_minimo} {materialEditando.unidade}
                    </div>
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogAberto(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    atualizarMutation.mutate({
                      id: materialEditando.id,
                      data: {
                        requer_apontamento_semanal: materialEditando.requer_apontamento_semanal,
                        motivo_apontamento: materialEditando.motivo_apontamento
                      }
                    });
                  }}
                  disabled={atualizarMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium gap-2"
                >
                  <Save className="w-4 h-4" />
                  {atualizarMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
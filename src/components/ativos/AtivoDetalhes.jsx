import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { toast } from 'sonner';
import { DollarSign, Calendar, User, MapPin, Wrench } from 'lucide-react';

const statusConfig = {
  disponivel: { color: 'bg-emerald-100 text-emerald-700', label: 'Disponível' },
  em_uso: { color: 'bg-blue-100 text-blue-700', label: 'Em Uso' },
  manutencao: { color: 'bg-amber-100 text-amber-700', label: 'Manutenção' },
  inativo: { color: 'bg-gray-100 text-gray-600', label: 'Inativo' },
  descartado: { color: 'bg-red-100 text-red-700', label: 'Descartado' },
};

export default function AtivoDetalhes({ open, onOpenChange, ativo }) {
  const queryClient = useQueryClient();
  const [movimentando] = useState(false);
  const [novoStatus, setNovoStatus] = useState(ativo?.status || '');
  const [novaLocalizacao, setNovaLocalizacao] = useState(ativo?.localizacao_atual || '');
  const [obraDestino, setObraDestino] = useState('');

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const atualizarStatusMutation = useMutation({
    mutationFn: async () => {
      const updateData = {
        status: novoStatus,
        localizacao_atual: novaLocalizacao
      };
      if (novaLocalizacao === 'em_obra' && obraDestino) {
        updateData.obra_atual_id = obraDestino;
      }
      return base44.entities.Ativo.update(ativo.id, updateData);
    },
    onSuccess: async () => {
      if (novaLocalizacao !== ativo.localizacao_atual) {
        await base44.entities.MovimentacaoAtivo.create({
          ativo_id: ativo.id,
          tipo: novaLocalizacao === 'em_obra' ? 'saida' : 'entrada',
          obra_destino_id: obraDestino || null,
          data_movimentacao: new Date().toISOString().split('T')[0],
          responsavel_saida: ativo.responsavel_atual
        });
      }
      queryClient.invalidateQueries(['ativos']);
      toast.success('Ativo atualizado!');
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  if (!ativo) return null;

  const getObraNome = (obraId) => obras.find(o => o.id === obraId)?.nome || 'Obra não identificada';
  const st = statusConfig[ativo.status] || { color: 'bg-gray-100 text-gray-600', label: ativo.status };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-gray-900 text-xl">{ativo.nome}</DialogTitle>
            <Badge className={`border-0 ${st.color}`}>{st.label}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {ativo.foto && (
            <img src={ativo.foto} alt={ativo.nome} className="w-full h-64 object-cover rounded-lg" />
          )}

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <Card className="bg-white border-gray-200">
              <CardContent className="pt-4">
                <div className="text-xs text-gray-500">Código</div>
                <div className="text-gray-900 font-medium">{ativo.codigo || '—'}</div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="pt-4">
                <div className="text-xs text-gray-500">Tipo</div>
                <div className="text-gray-900 font-medium capitalize">{(ativo.tipo || '—').replace(/_/g, ' ')}</div>
              </CardContent>
            </Card>
            {ativo.marca && (
              <Card className="bg-white border-gray-200">
                <CardContent className="pt-4">
                  <div className="text-xs text-gray-500">Marca</div>
                  <div className="text-gray-900 font-medium">{ativo.marca}</div>
                </CardContent>
              </Card>
            )}
            {ativo.numero_serie && (
              <Card className="bg-white border-gray-200">
                <CardContent className="pt-4">
                  <div className="text-xs text-gray-500">Série</div>
                  <div className="text-gray-900 font-medium">{ativo.numero_serie}</div>
                </CardContent>
              </Card>
            )}
          </div>

          {ativo.descricao && (
            <Card className="bg-white border-gray-200">
              <CardContent className="pt-4">
                <div className="text-sm text-gray-600">{ativo.descricao}</div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {ativo.valor_aquisicao && (
              <Card className="bg-white border-gray-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-gray-500">Valor Aquisição</div>
                      <div className="text-gray-900 font-medium">
                        R$ {ativo.valor_aquisicao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {ativo.data_aquisicao && (
              <Card className="bg-white border-gray-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-gray-500">Data Aquisição</div>
                      <div className="text-gray-900 font-medium">
                        {new Date(ativo.data_aquisicao).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {ativo.responsavel_atual && (
              <Card className="bg-white border-gray-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-gray-500">Responsável</div>
                      <div className="text-gray-900 font-medium text-sm">{ativo.responsavel_atual}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {ativo.localizacao_atual && (
              <Card className="bg-white border-gray-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-gray-500">Localização</div>
                      <div className="text-gray-900 font-medium">
                        {ativo.localizacao_atual === 'almoxarifado' ? 'Almoxarifado' :
                         ativo.localizacao_atual === 'em_obra' ? `Obra: ${getObraNome(ativo.obra_atual_id)}` :
                         'Em Trânsito'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="bg-white border-gray-200">
            <CardContent className="pt-6 space-y-4">
              <h4 className="text-gray-900 font-medium flex items-center gap-2">
                <Wrench className="w-4 h-4 text-blue-600" />
                Movimentar Ativo
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
                  <ComboboxBusca
                    options={[
                      { value: 'disponivel', label: 'Disponível' },
                      { value: 'em_uso', label: 'Em Uso' },
                      { value: 'manutencao', label: 'Manutenção' },
                      { value: 'inativo', label: 'Inativo' },
                    ]}
                    value={novoStatus}
                    onSelect={(v) => setNovoStatus(v || '')}
                    placeholder="Selecione o status"
                    searchPlaceholder="Buscar status..."
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Localização</Label>
                  <ComboboxBusca
                    options={[
                      { value: 'almoxarifado', label: 'Almoxarifado' },
                      { value: 'em_obra', label: 'Em Obra' },
                      { value: 'em_transito', label: 'Em Trânsito' },
                    ]}
                    value={novaLocalizacao}
                    onSelect={(v) => setNovaLocalizacao(v || '')}
                    placeholder="Selecione a localização"
                    searchPlaceholder="Buscar localização..."
                  />
                </div>
                {novaLocalizacao === 'em_obra' && (
                  <div className="sm:col-span-2">
                    <Label className="text-xs text-gray-600 mb-1 block">Obra Destino</Label>
                    <ComboboxBusca
                      options={obras.map(o => ({ value: o.id, label: o.nome || o.codigo || o.id }))}
                      value={obraDestino}
                      onSelect={(v) => setObraDestino(v || '')}
                      placeholder="Selecione a obra"
                      searchPlaceholder="Buscar obra..."
                      emptyMessage="Nenhuma obra."
                    />
                  </div>
                )}
              </div>

              <Button
                onClick={() => atualizarStatusMutation.mutate()}
                disabled={atualizarStatusMutation.isPending || !novoStatus || !novaLocalizacao}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {atualizarStatusMutation.isPending ? 'Atualizando...' : 'Atualizar Localização'}
              </Button>
            </CardContent>
          </Card>

          {ativo.observacoes && (
            <Card className="bg-white border-gray-200">
              <CardContent className="pt-4">
                <div className="text-sm text-gray-600">{ativo.observacoes}</div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

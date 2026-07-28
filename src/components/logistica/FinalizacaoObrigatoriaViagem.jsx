import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Camera, MapPin, Check, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function FinalizacaoObrigatoriaViagem({ open, onClose, viagem, onSuccess }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const [formData, setFormData] = useState({
    foto_painel_final_url: null,
    foto_veiculo_final_url: null,
    latitude_destino: null,
    longitude_destino: null,
    destino_gps: null,
    observacoes: '',
    houve_abastecimento: 'nao',
    houve_despesas: 'nao',
    valor_abastecimento: 0,
    valor_despesas: 0
  });

  // Capturar GPS automaticamente ao abrir
  useEffect(() => {
    if (open) {
      capturarGPS();
    }
  }, [open]);

  const capturarGPS = () => {
    setGpsLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          setFormData(prev => ({
            ...prev,
            latitude_destino: lat,
            longitude_destino: lng,
            destino_gps: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
          }));
          
          setGpsLoading(false);
          toast.success('Localização de retorno capturada!');
        },
        (error) => {
          setGpsLoading(false);
          toast.error('Não foi possível capturar localização');
        }
      );
    } else {
      setGpsLoading(false);
      toast.error('GPS não disponível');
    }
  };

  const uploadFoto = async (file, tipo) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      if (tipo === 'painel') {
        setFormData(prev => ({ ...prev, foto_painel_final_url: file_url }));
      } else {
        setFormData(prev => ({ ...prev, foto_veiculo_final_url: file_url }));
      }

      toast.success(`Foto ${tipo === 'painel' ? 'do painel' : 'do veículo'} enviada!`);
    } catch (error) {
      toast.error('Erro ao enviar foto');
    }
  };

  const finalizarViagemMutation = useMutation({
    mutationFn: async () => {
      const resultado = await base44.functions.invoke('finalizarViagemComRegistro', {
        viagem_id: viagem.id,
        foto_painel_final_url: formData.foto_painel_final_url,
        foto_veiculo_final_url: formData.foto_veiculo_final_url,
        latitude_destino: formData.latitude_destino,
        longitude_destino: formData.longitude_destino,
        observacoes: formData.observacoes,
        houve_abastecimento: formData.houve_abastecimento,
        houve_despesas: formData.houve_despesas,
        valor_abastecimento: formData.valor_abastecimento,
        valor_despesas: formData.valor_despesas
      });
      return resultado.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minhas-viagens'] });
      queryClient.invalidateQueries({ queryKey: ['viagens'] });
      toast.success('Viagem finalizada com sucesso!');
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao finalizar viagem');
    }
  });

  const handleFinalizar = () => {
    // Validações
    if (!formData.foto_painel_final_url) {
      toast.error('Foto do painel é obrigatória!');
      return;
    }
    if (!formData.latitude_destino || !formData.longitude_destino) {
      toast.error('GPS não capturado! Clique em "Capturar GPS"');
      return;
    }

    finalizarViagemMutation.mutate();
  };

  const camposObrigatoriosOK = 
    formData.foto_painel_final_url && 
    formData.latitude_destino;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Finalização de Viagem
          </DialogTitle>
          <DialogDescription>
            Complete os dados de retorno para finalizar a viagem
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* DADOS DA VIAGEM */}
          <div className="bg-blue-50 p-4 rounded-lg space-y-1 text-sm">
            <p><strong>Viagem:</strong> {viagem?.numero}</p>
            <p><strong>KM Inicial:</strong> {viagem?.km_inicial || 'N/A'}</p>
            <p><strong>Saída:</strong> {viagem?.saida_real ? new Date(viagem.saida_real).toLocaleString('pt-BR') : 'N/A'}</p>
          </div>

          {/* SEÇÃO 1: FOTOS */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-red-600">1. FOTOS DE RETORNO</h3>
            
            {/* Foto Painel Final (OBRIGATÓRIA) */}
            <div className="border rounded-lg p-4 bg-red-50 border-red-200">
              <Label className="text-sm font-bold mb-2 flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Foto do Painel (KM Final) * OBRIGATÓRIO
              </Label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFoto(file, 'painel');
                }}
                className="w-full mt-2"
              />
              {formData.foto_painel_final_url && (
                <div className="mt-2 flex items-center gap-2 text-green-600 text-sm">
                  <Check className="w-4 h-4" />
                  Foto enviada
                </div>
              )}
            </div>

            {/* Foto Veículo (OPCIONAL) */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <Label className="text-sm font-bold mb-2 flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Foto do Veículo (Externa) - Opcional
              </Label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFoto(file, 'veiculo');
                }}
                className="w-full mt-2"
              />
              {formData.foto_veiculo_final_url && (
                <div className="mt-2 flex items-center gap-2 text-green-600 text-sm">
                  <Check className="w-4 h-4" />
                  Foto enviada
                </div>
              )}
            </div>
          </div>

          {/* SEÇÃO 2: GPS DE RETORNO */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-red-600">2. LOCALIZAÇÃO DE RETORNO (GPS)</h3>
            
            <div className="border rounded-lg p-4 bg-green-50">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-bold flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  GPS Atual *
                </Label>
                <Button
                  onClick={capturarGPS}
                  disabled={gpsLoading}
                  size="sm"
                  variant="outline"
                >
                  {gpsLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Capturando...
                    </>
                  ) : (
                    <>
                      <MapPin className="w-3 h-3 mr-1" />
                      Capturar GPS
                    </>
                  )}
                </Button>
              </div>

              {formData.destino_gps ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="w-4 h-4" />
                    GPS capturado
                  </div>
                  <p className="text-gray-700 font-mono text-xs">{formData.destino_gps}</p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Aguardando captura do GPS...</p>
              )}
            </div>
          </div>

          {/* SEÇÃO 3: OBSERVAÇÕES E DESPESAS */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm">3. INFORMAÇÕES ADICIONAIS</h3>
            
            <div>
              <Label>Observações sobre a viagem</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Ex: Trânsito intenso, material entregue com sucesso, etc."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Houve abastecimento?</Label>
                <select
                  value={formData.houve_abastecimento}
                  onChange={(e) => setFormData(prev => ({ ...prev, houve_abastecimento: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 mt-1"
                >
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>

              {formData.houve_abastecimento === 'sim' && (
                <div>
                  <Label>Valor do abastecimento (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valor_abastecimento}
                    onChange={(e) => setFormData(prev => ({ ...prev, valor_abastecimento: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Houve despesas na viagem?</Label>
                <select
                  value={formData.houve_despesas}
                  onChange={(e) => setFormData(prev => ({ ...prev, houve_despesas: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 mt-1"
                >
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>

              {formData.houve_despesas === 'sim' && (
                <div>
                  <Label>Valor das despesas (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valor_despesas}
                    onChange={(e) => setFormData(prev => ({ ...prev, valor_despesas: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              )}
            </div>
          </div>

          {/* BOTÕES */}
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleFinalizar}
              disabled={!camposObrigatoriosOK || finalizarViagemMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {finalizarViagemMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Finalizando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Finalizar Viagem
                </>
              )}
            </Button>
          </div>

          {!camposObrigatoriosOK && (
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex gap-2 text-sm text-yellow-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>Complete foto do painel e GPS para liberar a finalização</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, MapPin, AlertCircle, Check, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function RegistroObrigatorioViagem({ open, onClose, viagem, onSuccess }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const [formData, setFormData] = useState({
    foto_painel_url: null,
    foto_veiculo_url: null,
    origem_gps: null,
    origem_endereco: '',
    destino: '',
    motivo: '',
    latitude_origem: null,
    longitude_origem: null
  });

  const [fotoPainelFile, setFotoPainelFile] = useState(null);
  const [fotoVeiculoFile, setFotoVeiculoFile] = useState(null);

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
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          setFormData(prev => ({
            ...prev,
            latitude_origem: lat,
            longitude_origem: lng,
            origem_gps: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
          }));

          // Buscar endereço via reverse geocoding (OpenStreetMap)
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
            const data = await res.json();
            setFormData(prev => ({
              ...prev,
              origem_endereco: data.display_name || `${lat}, ${lng}`
            }));
          } catch (err) {
            setFormData(prev => ({
              ...prev,
              origem_endereco: `${lat}, ${lng}`
            }));
          }
          
          setGpsLoading(false);
          toast.success('Localização capturada!');
        },
        (error) => {
          setGpsLoading(false);
          toast.error('Não foi possível capturar localização. Ative o GPS.');
        }
      );
    } else {
      setGpsLoading(false);
      toast.error('GPS não disponível neste dispositivo');
    }
  };

  const uploadFoto = async (file, tipo) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      if (tipo === 'painel') {
        setFormData(prev => ({ ...prev, foto_painel_url: file_url }));
        setFotoPainelFile(file);
      } else {
        setFormData(prev => ({ ...prev, foto_veiculo_url: file_url }));
        setFotoVeiculoFile(file);
      }

      toast.success(`Foto ${tipo === 'painel' ? 'do painel' : 'do veículo'} enviada!`);
    } catch (error) {
      toast.error('Erro ao enviar foto');
    }
  };

  const iniciarViagemMutation = useMutation({
    mutationFn: async () => {
      const resultado = await base44.functions.invoke('iniciarViagemComRegistro', {
        viagem_id: viagem.id,
        foto_painel_url: formData.foto_painel_url,
        foto_veiculo_url: formData.foto_veiculo_url,
        origem_endereco: formData.origem_endereco,
        destino: formData.destino,
        motivo: formData.motivo,
        latitude_origem: formData.latitude_origem,
        longitude_origem: formData.longitude_origem
      });
      return resultado.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minhas-viagens'] });
      queryClient.invalidateQueries({ queryKey: ['viagens'] });
      toast.success('Viagem iniciada com sucesso!');
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao iniciar viagem');
    }
  });

  const handleIniciar = () => {
    // Validações
    if (!formData.foto_painel_url) {
      toast.error('Foto do painel é obrigatória!');
      return;
    }
    if (!formData.foto_veiculo_url) {
      toast.error('Foto do veículo é obrigatória!');
      return;
    }
    if (!formData.latitude_origem || !formData.longitude_origem) {
      toast.error('GPS não capturado! Clique em "Capturar GPS"');
      return;
    }
    if (!formData.destino.trim()) {
      toast.error('Destino é obrigatório!');
      return;
    }
    if (!formData.motivo) {
      toast.error('Motivo da viagem é obrigatório!');
      return;
    }

    iniciarViagemMutation.mutate();
  };

  const todosCamposPreenchidos = 
    formData.foto_painel_url && 
    formData.foto_veiculo_url && 
    formData.latitude_origem && 
    formData.destino.trim() &&
    formData.motivo;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            Registro Obrigatório de Saída
          </DialogTitle>
          <DialogDescription>
            Complete todos os campos obrigatórios para iniciar a viagem
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* SEÇÃO 1: FOTOS OBRIGATÓRIAS */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-red-600">1. FOTOS OBRIGATÓRIAS</h3>
            
            {/* Foto Painel */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <Label className="text-sm font-bold mb-2 flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Foto do Painel (KM Atual) *
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
              {formData.foto_painel_url && (
                <div className="mt-2 flex items-center gap-2 text-green-600 text-sm">
                  <Check className="w-4 h-4" />
                  Foto enviada
                </div>
              )}
            </div>

            {/* Foto Veículo */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <Label className="text-sm font-bold mb-2 flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Foto do Veículo (Externa) *
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
              {formData.foto_veiculo_url && (
                <div className="mt-2 flex items-center gap-2 text-green-600 text-sm">
                  <Check className="w-4 h-4" />
                  Foto enviada
                </div>
              )}
            </div>
          </div>

          {/* SEÇÃO 2: LOCALIZAÇÃO GPS */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-red-600">2. LOCALIZAÇÃO (GPS)</h3>
            
            <div className="border rounded-lg p-4 bg-blue-50">
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

              {formData.origem_gps ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="w-4 h-4" />
                    GPS capturado
                  </div>
                  <p className="text-gray-700 font-mono text-xs">{formData.origem_gps}</p>
                  <p className="text-gray-600 text-xs">{formData.origem_endereco}</p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Aguardando captura do GPS...</p>
              )}
            </div>
          </div>

          {/* SEÇÃO 3: DADOS DA VIAGEM */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-red-600">3. DADOS DA VIAGEM</h3>
            
            <div>
              <Label>Origem (detectada via GPS)</Label>
              <Input
                value={formData.origem_endereco}
                disabled
                className="bg-gray-100"
              />
            </div>

            <div>
              <Label>Destino *</Label>
              <Input
                value={formData.destino}
                onChange={(e) => setFormData(prev => ({ ...prev, destino: e.target.value }))}
                placeholder="Ex: Obra Centro, Fornecedor X, etc."
              />
            </div>

            <div>
              <Label>Motivo da Viagem *</Label>
              <Select
                value={formData.motivo}
                onValueChange={(value) => setFormData(prev => ({ ...prev, motivo: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="obra">Obra / Construção</SelectItem>
                  <SelectItem value="frete">Frete / Transporte Material</SelectItem>
                  <SelectItem value="compra">Compra de Material</SelectItem>
                  <SelectItem value="manutencao">Manutenção Veículo</SelectItem>
                  <SelectItem value="abastecimento">Abastecimento</SelectItem>
                  <SelectItem value="servico">Serviço Externo</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* RESUMO */}
          <div className="border-t pt-4">
            <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
              <p className="font-bold">Resumo da Viagem:</p>
              <p><strong>Veículo:</strong> {viagem?.veiculo_id || 'N/A'}</p>
              <p><strong>Motorista:</strong> {viagem?.motorista_user_id || 'N/A'}</p>
              <p><strong>Status:</strong> <span className="text-yellow-600 font-bold">Aguardando confirmação</span></p>
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
              onClick={handleIniciar}
              disabled={!todosCamposPreenchidos || iniciarViagemMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {iniciarViagemMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirmar Saída
                </>
              )}
            </Button>
          </div>

          {!todosCamposPreenchidos && (
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex gap-2 text-sm text-yellow-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>Complete todos os campos obrigatórios para liberar o botão de confirmação</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
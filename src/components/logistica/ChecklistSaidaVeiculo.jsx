import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Upload, CheckCircle, AlertTriangle, Car, Gauge, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ChecklistSaidaVeiculo({ rota, veiculo, onConcluido, onClose }) {
  const [fotoPainel, setFotoPainel] = useState(null);
  const [fotoCarroceria, setFotoCarroceria] = useState(null);
  const [fotoPainelUrl, setFotoPainelUrl] = useState('');
  const [fotoCarroceriaUrl, setFotoCarroceriaUrl] = useState('');
  const [kmSaida, setKmSaida] = useState('');
  const [uploadingPainel, setUploadingPainel] = useState(false);
  const [uploadingCarroceria, setUploadingCarroceria] = useState(false);

  const painelRef = useRef();
  const carroceriaRef = useRef();
  const queryClient = useQueryClient();

  const handleUploadFoto = async (file, tipo) => {
    if (!file) return;
    const setter = tipo === 'painel' ? setUploadingPainel : setUploadingCarroceria;
    setter(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (tipo === 'painel') {
        setFotoPainelUrl(file_url);
        setFotoPainel(file);
      } else {
        setFotoCarroceriaUrl(file_url);
        setFotoCarroceria(file);
      }
      toast.success(tipo === 'painel' ? 'Foto do painel enviada!' : 'Foto da carroceria enviada!');
    } catch (err) {
      toast.error('Erro ao enviar foto: ' + err.message);
    } finally {
      setter(false);
    }
  };

  const concluirMutation = useMutation({
    mutationFn: async () => {
      if (!fotoPainelUrl || !fotoCarroceriaUrl) {
        throw new Error('Ambas as fotos são obrigatórias para iniciar a viagem');
      }
      if (!kmSaida) {
        throw new Error('Informe a quilometragem atual do veículo');
      }
      return base44.entities.RotaMotorista.update(rota.id, {
        checklist_saida_ok: true,
        foto_painel_km_url: fotoPainelUrl,
        foto_carroceria_url: fotoCarroceriaUrl,
        km_saida: parseFloat(kmSaida),
        status: 'em_andamento',
        data_hora_saida: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotas-motorista'] });
      toast.success('Checklist concluído! Boa viagem! ');
      onConcluido?.();
    },
    onError: (err) => {
      toast.error(err.message);
    }
  });

  const tudo_ok = fotoPainelUrl && fotoCarroceriaUrl && kmSaida;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="w-5 h-5" />
            Checklist Obrigatório de Saída
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <p className="text-sm text-orange-800 font-medium">
              Antes de sair com o veículo, é obrigatório registrar:
            </p>
            <ul className="text-sm text-orange-700 mt-1 space-y-1">
              <li>✓ Foto do painel com quilometragem atual</li>
              <li>✓ Foto da carroceria completa do veículo</li>
              <li>✓ Quilometragem atual</li>
            </ul>
          </div>

          {/* Info veículo */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Car className="w-8 h-8 text-blue-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-blue-900">{veiculo?.placa} — {veiculo?.modelo}</p>
              <p className="text-sm text-blue-700">{rota?.nome}</p>
              <p className="text-xs text-blue-600">{rota?.endereco_origem} → {rota?.endereco_destino}</p>
            </div>
          </div>

          {/* KM Saída */}
          <div>
            <label className="block text-sm font-semibold mb-1 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-gray-600" />
              Quilometragem Atual *
            </label>
            <Input
              type="number"
              placeholder="Ex: 123456"
              value={kmSaida}
              onChange={(e) => setKmSaida(e.target.value)}
              className="text-lg font-mono"
            />
          </div>

          {/* Foto Painel */}
          <div>
            <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-orange-600" />
              Foto do Painel (Quilometragem) *
            </label>
            {fotoPainelUrl ? (
              <div className="relative">
                <img src={fotoPainelUrl} alt="Painel" className="w-full h-40 object-cover rounded-lg border-2 border-green-400" />
                <button
                  onClick={() => { setFotoPainelUrl(''); setFotoPainel(null); }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Enviado
                </div>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-orange-300 rounded-lg p-6 text-center cursor-pointer hover:bg-orange-50 transition-colors"
                onClick={() => painelRef.current?.click()}
              >
                {uploadingPainel ? (
                  <div className="flex flex-col items-center gap-2 text-orange-600">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-sm">Enviando...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-orange-600">
                    <Camera className="w-8 h-8" />
                    <span className="text-sm font-medium">Tirar foto do painel</span>
                    <span className="text-xs text-gray-500">Certifique-se que o KM esteja visível</span>
                  </div>
                )}
                <input
                  ref={painelRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleUploadFoto(e.target.files[0], 'painel')}
                />
              </div>
            )}
          </div>

          {/* Foto Carroceria */}
          <div>
            <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
              <Car className="w-4 h-4 text-orange-600" />
              Foto da Carroceria do Veículo *
            </label>
            <p className="text-xs text-gray-500 mb-2">Fotografe todo o veículo mostrando a condição atual da carroceria</p>
            {fotoCarroceriaUrl ? (
              <div className="relative">
                <img src={fotoCarroceriaUrl} alt="Carroceria" className="w-full h-40 object-cover rounded-lg border-2 border-green-400" />
                <button
                  onClick={() => { setFotoCarroceriaUrl(''); setFotoCarroceria(null); }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Enviado
                </div>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-orange-300 rounded-lg p-6 text-center cursor-pointer hover:bg-orange-50 transition-colors"
                onClick={() => carroceriaRef.current?.click()}
              >
                {uploadingCarroceria ? (
                  <div className="flex flex-col items-center gap-2 text-orange-600">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-sm">Enviando...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-orange-600">
                    <Upload className="w-8 h-8" />
                    <span className="text-sm font-medium">Foto da carroceria</span>
                    <span className="text-xs text-gray-500">Foto ou vídeo (toda a extensão do veículo)</span>
                  </div>
                )}
                <input
                  ref={carroceriaRef}
                  type="file"
                  accept="image/*,video/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleUploadFoto(e.target.files[0], 'carroceria')}
                />
              </div>
            )}
          </div>

          {/* Status */}
          <div className={`p-3 rounded-lg border ${tudo_ok ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2">
              {tudo_ok ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-gray-400" />
              )}
              <span className={`text-sm font-medium ${tudo_ok ? 'text-green-700' : 'text-gray-500'}`}>
                {tudo_ok ? 'Checklist completo! Pode iniciar a viagem.' : 'Complete todos os itens obrigatórios'}
              </span>
            </div>
            <div className="mt-2 space-y-1 text-xs text-gray-600">
              <p className={kmSaida ? 'text-green-600' : 'text-gray-400'}>
                {kmSaida ? '✓' : '○'} Quilometragem informada
              </p>
              <p className={fotoPainelUrl ? 'text-green-600' : 'text-gray-400'}>
                {fotoPainelUrl ? '✓' : '○'} Foto do painel
              </p>
              <p className={fotoCarroceriaUrl ? 'text-green-600' : 'text-gray-400'}>
                {fotoCarroceriaUrl ? '✓' : '○'} Foto da carroceria
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={() => concluirMutation.mutate()}
              disabled={!tudo_ok || concluirMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {concluirMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...</>
              ) : (
                <><CheckCircle className="w-4 h-4 mr-2" /> Iniciar Viagem</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
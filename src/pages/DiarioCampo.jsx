import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Camera, Save, X, Check, MapPin, Users as UsersIcon, Clock, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import AssinaturaDigital from '../components/campo/AssinaturaDigital';
import GestorTarefasOffline from '../components/campo/GestorTarefasOffline';
import CapturaGPS from '../components/campo/CapturaGPS';
import CapturaVideo from '../components/campo/CapturaVideo';
import StatusSincronizacao from '../components/campo/StatusSincronizacao';
import SincronizadorOffline from '../components/campo/SincronizadorOffline';
import { FilaSincronizacao } from '../components/campo/FilaSincronizacao';
import NotificacoesTarefasProvider from '../components/campo/NotificacoesTarefas';

export default function DiarioCampo() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    obra_id: '',
    data: new Date().toISOString().split('T')[0],
    clima: 'ensolarado',
    temperatura: '',
    atividades_realizadas: '',
    equipe_presente: '',
    materiais_utilizados: '',
    equipamentos_utilizados: '',
    ocorrencias: '',
    fotos: [],
    videos: [],
    latitude: null,
    longitude: null
  });
  const [fotosPreview, setFotosPreview] = useState([]);
  const [assinatura, setAssinatura] = useState('');
  const [estatisticasFila, setEstatisticasFila] = useState({ pendentes: 0, erros: 0 });
  const fileInputRef = useRef();

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  // Gestão offline - salvar rascunho automaticamente
  useEffect(() => {
    const salvarOffline = () => {
      try {
        const dados = {
          formData,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('diario_campo_rascunho', JSON.stringify(dados));
      } catch (error) {
        console.error('Erro ao salvar offline:', error);
      }
    };

    if (formData.atividades_realizadas || formData.fotos.length > 0) {
      salvarOffline();
    }
  }, [formData]);

  // Recuperar rascunho ao carregar
  useEffect(() => {
    try {
      const rascunho = localStorage.getItem('diario_campo_rascunho');
      if (rascunho) {
        const dados = JSON.parse(rascunho);
        const idade = Date.now() - new Date(dados.timestamp).getTime();
        if (idade < 24 * 60 * 60 * 1000) {
          setFormData(dados.formData);
          toast.info('Rascunho recuperado');
        }
      }
    } catch (error) {
      console.error('Erro ao recuperar rascunho:', error);
    }
  }, []);

  const criarDiarioMutation = useMutation({
    mutationFn: async (data) => {
      const fotosUrls = [];
      for (const foto of data.fotos) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: foto });
        fotosUrls.push(file_url);
      }

      let assinaturaUrl = '';
      if (data.assinatura) {
        const blob = await fetch(data.assinatura).then(r => r.blob());
        const file = new File([blob], 'assinatura.png', { type: 'image/png' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        assinaturaUrl = file_url;
      }

      return base44.entities.DiarioObra.create({
        obra_id: data.obra_id,
        data: data.data,
        clima: data.clima,
        temperatura: parseFloat(data.temperatura) || 25,
        atividades_realizadas: data.atividades_realizadas,
        equipe_presente: data.equipe_presente,
        materiais_utilizados: data.materiais_utilizados,
        equipamentos_utilizados: data.equipamentos_utilizados,
        ocorrencias: data.ocorrencias,
        fotos: fotosUrls,
        videos: data.videos || [],
        latitude: data.latitude,
        longitude: data.longitude,
        responsavel: user?.full_name || user?.email,
        assinatura: assinaturaUrl
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['diarios-obra']);
      toast.success('Diário registrado com sucesso!');
      localStorage.removeItem('diario_campo_rascunho');
      setFormData({
        obra_id: '',
        data: new Date().toISOString().split('T')[0],
        clima: 'ensolarado',
        temperatura: '',
        atividades_realizadas: '',
        equipe_presente: '',
        materiais_utilizados: '',
        equipamentos_utilizados: '',
        ocorrencias: '',
        fotos: [],
        videos: [],
        latitude: null,
        longitude: null
      });
      setFotosPreview([]);
      setAssinatura('');
    },
    onError: (error) => {
      toast.error('Erro ao registrar diário: ' + error.message);
    }
  });

  const handleFotoUpload = (e) => {
    const files = Array.from(e.target.files);
    const newFotos = [...formData.fotos, ...files].slice(0, 10);
    setFormData({ ...formData, fotos: newFotos });

    const previews = [...fotosPreview];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        previews.push(reader.result);
        setFotosPreview([...previews].slice(0, 10));
      };
      reader.readAsDataURL(file);
    });
  };

  const removerFoto = (index) => {
    const newFotos = formData.fotos.filter((_, i) => i !== index);
    const newPreviews = fotosPreview.filter((_, i) => i !== index);
    setFormData({ ...formData, fotos: newFotos });
    setFotosPreview(newPreviews);
  };

  const handleGPSCapturado = (localizacao) => {
    setFormData({
      ...formData,
      latitude: localizacao.latitude,
      longitude: localizacao.longitude
    });
  };

  const handleVideoUploaded = (videoInfo) => {
    setFormData({
      ...formData,
      videos: [...(formData.videos || []), videoInfo.url]
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.obra_id || !formData.atividades_realizadas) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    if (!navigator.onLine) {
      // Modo offline: adicionar à fila
      const dadosCompletos = {
        ...formData,
        assinatura,
        fotos: fotosPreview, // Salvar base64 para upload depois
        responsavel: user?.full_name || user?.email
      };
      
      FilaSincronizacao.adicionar('diario_obra', dadosCompletos);
      toast.info('Salvo offline. Será enviado quando conectar.');
      
      // Limpar formulário
      localStorage.removeItem('diario_campo_rascunho');
      setFormData({
        obra_id: '',
        data: new Date().toISOString().split('T')[0],
        clima: 'ensolarado',
        temperatura: '',
        atividades_realizadas: '',
        equipe_presente: '',
        materiais_utilizados: '',
        equipamentos_utilizados: '',
        ocorrencias: '',
        fotos: [],
        videos: [],
        latitude: null,
        longitude: null
      });
      setFotosPreview([]);
      setAssinatura('');
      setEstatisticasFila(FilaSincronizacao.getEstatisticas());
    } else {
      // Modo online: enviar normalmente
      criarDiarioMutation.mutate({ ...formData, assinatura });
    }
  };

  return (
    <SincronizadorOffline onStatusChange={setEstatisticasFila}>
      <NotificacoesTarefasProvider obraId={formData.obra_id}>
        <div className="min-h-screen bg-gray-950 pb-20">
        <div className="sticky top-0 z-50 bg-gray-900 border-b border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Diário de Campo</h1>
                <p className="text-xs text-gray-500">Registro rápido de atividades</p>
              </div>
            </div>
            <StatusSincronizacao 
              pendentes={estatisticasFila.pendentes} 
              erros={estatisticasFila.erros}
            />
          </div>
        </div>

        <div className="p-4 space-y-4">
          {formData.obra_id && <GestorTarefasOffline obraId={formData.obra_id} />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-500" />
                Local e Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-gray-400 text-xs">Obra *</Label>
                <Select value={formData.obra_id} onValueChange={(v) => setFormData({...formData, obra_id: v})}>
                  <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white h-12">
                    <SelectValue placeholder="Selecione a obra..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {obras.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-400 text-xs">Data</Label>
                  <Input
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData({...formData, data: e.target.value})}
                    className="mt-1.5 bg-gray-800 border-gray-700 text-white h-12"
                  />
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">Temperatura (°C)</Label>
                  <Input
                    type="number"
                    placeholder="25"
                    value={formData.temperatura}
                    onChange={(e) => setFormData({...formData, temperatura: e.target.value})}
                    className="mt-1.5 bg-gray-800 border-gray-700 text-white h-12"
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-400 text-xs">Clima</Label>
                <Select value={formData.clima} onValueChange={(v) => setFormData({...formData, clima: v})}>
                  <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="ensolarado">Ensolarado</SelectItem>
                    <SelectItem value="nublado">Nublado</SelectItem>
                    <SelectItem value="chuvoso">Chuvoso</SelectItem>
                    <SelectItem value="tempestade">Tempestade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <CapturaGPS onCaptured={handleGPSCapturado} />

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Atividades *
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Descreva as atividades realizadas hoje..."
                value={formData.atividades_realizadas}
                onChange={(e) => setFormData({...formData, atividades_realizadas: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white min-h-32 text-base"
              />
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <UsersIcon className="w-4 h-4 text-purple-500" />
                Equipe Presente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Nome dos colaboradores presentes..."
                value={formData.equipe_presente}
                onChange={(e) => setFormData({...formData, equipe_presente: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white min-h-24 text-base"
              />
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="pt-6 space-y-3">
              <div>
                <Label className="text-gray-400 text-xs">Materiais Utilizados</Label>
                <Textarea
                  placeholder="Ex: Cimento, areia, tijolos..."
                  value={formData.materiais_utilizados}
                  onChange={(e) => setFormData({...formData, materiais_utilizados: e.target.value})}
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white min-h-20 text-base"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Equipamentos Utilizados</Label>
                <Textarea
                  placeholder="Ex: Betoneira, guincho, andaimes..."
                  value={formData.equipamentos_utilizados}
                  onChange={(e) => setFormData({...formData, equipamentos_utilizados: e.target.value})}
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white min-h-20 text-base"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm">Ocorrências / Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Registre qualquer ocorrência importante..."
                value={formData.ocorrencias}
                onChange={(e) => setFormData({...formData, ocorrencias: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white min-h-24 text-base"
              />
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-500" />
                Fotos ({fotosPreview.length}/10)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={handleFotoUpload}
                className="hidden"
              />
              
              <div className="grid grid-cols-3 gap-2 mb-3">
                {fotosPreview.map((preview, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-800">
                    <img src={preview} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removerFoto(idx)}
                      className="absolute top-1 right-1 p-1 bg-red-500 rounded-full"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>

              {fotosPreview.length < 10 && (
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full h-12 border-gray-700 text-gray-400 hover:bg-gray-800"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Tirar/Adicionar Foto
                </Button>
              )}
            </CardContent>
          </Card>

          <CapturaVideo onVideoUploaded={handleVideoUploaded} />

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm">Assinatura do Responsável</CardTitle>
            </CardHeader>
            <CardContent>
              <AssinaturaDigital onSave={setAssinatura} />
            </CardContent>
          </Card>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-900 border-t border-gray-800">
            <Button
              type="submit"
              disabled={criarDiarioMutation.isPending}
              className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold text-base"
            >
              {criarDiarioMutation.isPending ? (
                'Enviando...'
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Registrar Diário
                </>
              )}
            </Button>
          </div>
        </form>
        </div>
        </div>
      </NotificacoesTarefasProvider>
    </SincronizadorOffline>
  );
}
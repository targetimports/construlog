import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, AlertCircle, Loader2, MapPin, Mic, Send, AlertTriangle, Clock, Landmark, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function ValidadorEnderecoComIA({ tipo = 'origem', onEnderecoValido, onMapMarker }) {
  const [endereco, setEndereco] = useState('');
  const [validando, setValidando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [gravando, setGravando] = useState(false);
  const [processandoAudio, setProcessandoAudio] = useState(false);
  const [capturandoGPS, setCapturandoGPS] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        await processarAudio();
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setGravando(true);
      toast.success('Gravando áudio...');
    } catch (error) {
      toast.error('Erro ao acessar microfone: ' + error.message);
    }
  };

  const pararGravacao = () => {
    if (mediaRecorderRef.current && gravando) {
      mediaRecorderRef.current.stop();
      setGravando(false);
    }
  };

  const processarAudio = async () => {
    setProcessandoAudio(true);
    try {
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      
      // Upload do áudio
      const response = await base44.integrations.Core.UploadFile({ file: audioBlob });
      const audioUrl = response.file_url;

      // IA interpreta o áudio
      const iaResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um assistente para extrair endereços de áudio. Ouça o áudio e extraia APENAS o endereço ou local mencionado. Responda APENAS com o endereço/local, nada mais. Se for um lugar no interior da Bahia, complemente com "Bahia, Brasil".\n\nExemplo: se disser "tucano", responda "Tucano, Bahia, Brasil"`,
        file_urls: [audioUrl],
        response_json_schema: {
          type: "object",
          properties: {
            endereco_interpretado: { type: "string" }
          }
        }
      });

      const enderecoExtraido = iaResponse.endereco_interpretado;
      if (enderecoExtraido) {
        setEndereco(enderecoExtraido);
        setResultado(null);
        toast.success(`Áudio interpretado: "${enderecoExtraido}"`);
      } else {
        toast.error('Não consegui interpretar o áudio');
      }
    } catch (error) {
      toast.error('Erro ao processar áudio: ' + error.message);
    } finally {
      setProcessandoAudio(false);
    }
  };

  const capturarLocalizacaoGPS = async () => {
    setCapturandoGPS(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000
        });
      });

      const { latitude, longitude } = position.coords;

      // Buscar endereço a partir das coordenadas
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10&addressdetails=1`
      );
      const data = await res.json();

      const enderecoBuscado = data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      setEndereco(enderecoBuscado);
      setResultado(null);
      toast.success('Localização capturada! Validando endereço...');

      // Auto-validar após captura
      setTimeout(() => validarEndereco(), 500);
    } catch (error) {
      toast.error('Erro ao capturar localização: ' + error.message);
    } finally {
      setCapturandoGPS(false);
    }
  };

  const validarEndereco = async () => {
    if (!endereco.trim()) {
      toast.error('Digite um endereço');
      return;
    }

    setValidando(true);
    try {
      const response = await base44.functions.invoke('validarCorrigirEnderecoComIA', {
        endereco: endereco.trim(),
        tipo
      });

      const dados = response.data;
      setResultado(dados);

      if (dados.encontrado_mapa) {
        toast.success(`Endereço validado com ${Math.round(dados.confianca * 100)}% de confiança`);
        
        // Callback com endereço corrigido e coords
        if (onEnderecoValido) {
          onEnderecoValido({
            endereco: dados.endereco_corrigido,
            lat: dados.lat,
            lng: dados.lng
          });
        }

        // Marcar no mapa
        if (onMapMarker) {
          onMapMarker({
            endereco: dados.endereco_corrigido,
            lat: dados.lat,
            lng: dados.lng,
            tipo,
            status: dados.status
          });
        }
      } else {
        toast.warning('Endereço não encontrado no mapa. Verifique a digitação');
      }
    } catch (error) {
      toast.error('Erro ao validar endereço: ' + error.message);
    } finally {
      setValidando(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder={tipo === 'origem' ? 'Digite o endereço de origem' : 'Digite o destino'}
          value={endereco}
          onChange={(e) => {
            setEndereco(e.target.value);
            setResultado(null);
          }}
          onKeyPress={(e) => e.key === 'Enter' && validarEndereco()}
          className="flex-1"
        />
        <Button
          onClick={capturarLocalizacaoGPS}
          disabled={validando || processandoAudio || capturandoGPS}
          variant="outline"
          title="Localização em tempo real"
        >
          {capturandoGPS ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Navigation className="w-4 h-4" />
          )}
        </Button>
        {gravando ? (
          <Button
            onClick={pararGravacao}
            className="bg-red-600 hover:bg-red-700"
            title="Parar gravação"
          >
            <Mic className="w-4 h-4 animate-pulse" />
          </Button>
        ) : (
          <Button
            onClick={iniciarGravacao}
            disabled={validando || processandoAudio || capturandoGPS}
            variant="outline"
            title="Gravar áudio"
          >
            <Mic className="w-4 h-4" />
          </Button>
        )}
        <Button
          onClick={validarEndereco}
          disabled={validando || !endereco.trim() || processandoAudio || capturandoGPS}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {validando ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Validando
            </>
          ) : processandoAudio ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processando
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4 mr-2" />
              Validar
            </>
          )}
        </Button>
      </div>

      {/* Resultado da validação */}
      {resultado && (
        <div className={`p-4 rounded-lg border space-y-3 ${
          resultado.encontrado_mapa 
            ? 'bg-green-50 border-green-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          {/* Cabeçalho com status */}
          <div className="flex items-start gap-3">
            {resultado.encontrado_mapa ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            )}
            
            <div className="text-sm min-w-0 flex-1">
              <p className={`font-semibold ${resultado.encontrado_mapa ? 'text-green-900' : 'text-yellow-900'}`}>
                {resultado.status === 'valido' && 'Endereço válido ✓'}
                {resultado.status === 'corrigido' && 'Endereço corrigido pela IA'}
                {resultado.status === 'nao_encontrado' && 'Endereço não localizado'}
              </p>
              
              <p className={`text-xs mt-1 ${resultado.encontrado_mapa ? 'text-green-700' : 'text-yellow-700'}`}>
                {resultado.endereco_corrigido}
              </p>

              {resultado.encontrado_sistema && (
                <Badge className="mt-2 bg-blue-100 text-blue-800">
                  Histórico do sistema
                </Badge>
              )}

              <p className="text-xs text-gray-600 mt-2">
                Confiança: {Math.round(resultado.confianca * 100)}%
              </p>
            </div>
          </div>

          {/* Informações adicionais da IA */}
          {resultado.encontrado_mapa && (
            <div className="border-t border-green-200 pt-3 space-y-3">
              {/* Tipo de área */}
              {resultado.tipo_area && (
                <div className="flex items-start gap-2">
                  <Landmark className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-green-900">Tipo de Área:</p>
                    <Badge variant="outline" className="mt-1 capitalize">
                      {resultado.tipo_area === 'urbana' && 'Urbana'}
                      {resultado.tipo_area === 'rural' && 'Rural'}
                      {resultado.tipo_area === 'misto' && 'Misto'}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Pontos de referência */}
              {resultado.pontos_referencia && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-green-900">Pontos de Referência:</p>
                    <p className="text-gray-700 mt-1">{resultado.pontos_referencia}</p>
                  </div>
                </div>
              )}

              {/* Avisos de trânsito */}
              {resultado.avisos_transito && resultado.avisos_transito.length > 0 && (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-green-900">Avisos de Trânsito:</p>
                    <ul className="mt-1 space-y-1">
                      {resultado.avisos_transito.map((aviso, i) => (
                        <li key={i} className="text-gray-700 flex gap-2">
                          <span className="text-yellow-600">•</span>
                          <span>{aviso}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Horários de pico */}
              {resultado.horarios_pico && (
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-green-900">Horários de Pico:</p>
                    <p className="text-gray-700 mt-1">{resultado.horarios_pico}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
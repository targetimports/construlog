import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function CapturaGPS({ onCaptured }) {
  const [capturando, setCapturando] = useState(false);
  const [localizacao, setLocalizacao] = useState(null);
  const [erro, setErro] = useState(null);

  const capturarLocalizacao = () => {
    if (!navigator.geolocation) {
      setErro('Geolocalização não suportada pelo navegador');
      toast.error('GPS não disponível');
      return;
    }

    setCapturando(true);
    setErro(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          precisao: position.coords.accuracy,
          timestamp: new Date().toISOString()
        };
        setLocalizacao(loc);
        setCapturando(false);
        toast.success('Localização capturada!');
        
        if (onCaptured) {
          onCaptured(loc);
        }
      },
      (error) => {
        setCapturando(false);
        let mensagem = 'Erro ao capturar localização';
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            mensagem = 'Permissão de localização negada';
            break;
          case error.POSITION_UNAVAILABLE:
            mensagem = 'Localização indisponível';
            break;
          case error.TIMEOUT:
            mensagem = 'Tempo esgotado para obter localização';
            break;
        }
        
        setErro(mensagem);
        toast.error(mensagem);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={capturarLocalizacao}
          disabled={capturando}
          className="bg-blue-500 hover:bg-blue-600"
          size="sm"
        >
          {capturando ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Capturando GPS...
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4 mr-2" />
              Capturar Localização
            </>
          )}
        </Button>

        {localizacao && (
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            GPS Capturado
          </Badge>
        )}

        {erro && (
          <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
            <AlertCircle className="w-3 h-3 mr-1" />
            Erro
          </Badge>
        )}
      </div>

      {localizacao && (
        <div className="p-3 bg-gray-800 rounded-lg text-sm">
          <div className="grid grid-cols-2 gap-2 text-gray-400">
            <div>
              <span className="text-gray-500">Latitude:</span>
              <span className="text-white ml-2">{localizacao.latitude.toFixed(6)}</span>
            </div>
            <div>
              <span className="text-gray-500">Longitude:</span>
              <span className="text-white ml-2">{localizacao.longitude.toFixed(6)}</span>
            </div>
            <div>
              <span className="text-gray-500">Precisão:</span>
              <span className="text-white ml-2">{localizacao.precisao?.toFixed(0)}m</span>
            </div>
            <div>
              <a
                href={`https://www.google.com/maps?q=${localizacao.latitude},${localizacao.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                Ver no Mapa →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
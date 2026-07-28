import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Loader2, Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import BotaoCapturarAudio from './BotaoCapturarAudio';

// Ícones do Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Corrige o render do mapa dentro de modal/dialog: força recálculo de tamanho
// após o container ficar visível (senão os tiles vêm cinza/cortados).
function AjustarTamanho() {
  const map = useMap();
  useEffect(() => {
    const ts = [120, 350, 700].map((ms) => setTimeout(() => map.invalidateSize(), ms));
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => { ts.forEach(clearTimeout); window.removeEventListener('resize', onResize); };
  }, [map]);
  return null;
}

function MapaClick({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });
  return null;
}

export default function MapaLocalizacao({ 
  localizacaoAtual, 
  onLocalizacaoAtualChange, 
  destino, 
  onDestinoChange,
  isLoading 
}) {
  const [loadingMapa, setLoadingMapa] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);

  const capturarLocalizacao = () => {
    setLoadingMapa(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          onLocalizacaoAtualChange({
            lat,
            lng,
            endereco: `${lat.toFixed(4)}, ${lng.toFixed(4)}`
          });

          // Reverse geocoding (via proxy do backend)
          try {
            const resp = await base44.functions.invoke('geocode', { lat, lon: lng });
            const data = resp?.data?.results?.[0] || {};
            onLocalizacaoAtualChange(prev => ({
              ...prev,
              endereco: data.address?.road || data.display_name || prev.endereco
            }));
          } catch (err) {
            console.log('Geocoding error:', err);
          }
          
          setLoadingMapa(false);
          toast.success('Localização capturada com sucesso!');
        },
        (error) => {
          setLoadingMapa(false);
          toast.error('Erro ao capturar localização. Verifique as permissões.');
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    }
  };

  const center = localizacaoAtual?.lat 
    ? [localizacaoAtual.lat, localizacaoAtual.lng]
    : [-15.8267, -47.8822]; // Brasília

  const zoom = destino?.lat ? 16 : localizacaoAtual?.lat ? 16 : 4;

  const geocodificarEndereco = async (endereco) => {
    try {
      const resp = await base44.functions.invoke('geocode', { q: endereco, limit: 1 });
      const data = resp?.data?.results || [];
      if (data.length > 0) {
        const { lat, lon, display_name } = data[0];
        onDestinoChange({
          lat: parseFloat(lat),
          lng: parseFloat(lon),
          endereco: display_name
        });
        toast.success('Destino encontrado no mapa!');
      } else {
        toast.error('Endereço não encontrado');
      }
    } catch (err) {
      console.error('Erro ao geocodificar:', err);
      toast.error('Erro ao buscar endereço');
    }
  };

  // Clique no mapa marca o destino e tenta resolver o endereço (reverse geocoding).
  const selecionarDestinoNoMapa = async (loc) => {
    onDestinoChange(loc);
    try {
      const resp = await base44.functions.invoke('geocode', { lat: loc.lat, lon: loc.lng });
      const data = resp?.data?.results?.[0] || {};
      onDestinoChange({ ...loc, endereco: data.display_name || `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}` });
    } catch {
      onDestinoChange({ ...loc, endereco: `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}` });
    }
    toast.success('Destino marcado no mapa!');
  };

  const mapa = (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={false}
      className="w-full h-full"
    >
        <AjustarTamanho />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Marcador de Origem (Localização Atual) */}
        {localizacaoAtual?.lat && (
          <Marker position={[localizacaoAtual.lat, localizacaoAtual.lng]}>
            <Popup>
              <div className="text-sm">
                <p className="font-bold">Você está aqui</p>
                <p className="text-gray-600">{localizacaoAtual.endereco}</p>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Marcador de Destino */}
        {destino?.lat && (
          <Marker position={[destino.lat, destino.lng]} icon={L.icon({
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41],
            shadowAnchor: [12, 41],
            className: 'grayscale hue-rotate-90'
          })}>
            <Popup>
              <div className="text-sm">
                <p className="font-bold text-red-600">Destino</p>
                <p className="text-gray-600">{destino.endereco}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Click para selecionar destino */}
        <MapaClick onLocationSelect={selecionarDestinoNoMapa} />
      </MapContainer>
  );

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-500" />
          Origem - Localização em Tempo Real
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={localizacaoAtual?.endereco || ''}
            readOnly
            placeholder="Sua localização será exibida aqui"
            className="flex-1 h-11 px-3 border border-gray-300 rounded-lg bg-gray-50 text-sm"
          />
          <BotaoCapturarAudio
            onAudioCapturado={(texto) => {
              onLocalizacaoAtualChange({ ...localizacaoAtual, endereco: texto });
            }}
            label="Origem"
          />
          <Button
            type="button"
            onClick={capturarLocalizacao}
            disabled={loadingMapa || isLoading}
            variant="outline"
            className="h-11 shrink-0"
          >
            {loadingMapa ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Capturando...</>
            ) : (
              <><MapPin className="w-4 h-4 mr-1" /> GPS</>
            )}
          </Button>
          <Button
            type="button"
            onClick={() => setTelaCheia(true)}
            variant="outline"
            className="h-11 w-11 shrink-0"
            title="Expandir mapa para tela cheia"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Mapa Normal */}
      <div className="rounded-lg border border-gray-300 overflow-hidden h-64 relative z-0">
        {mapa}
      </div>

      <p className="text-xs text-gray-500 text-center">
        Clique no mapa para marcar o destino ou use "Minha Localização" para capturar sua posição atual
      </p>

      {/* Dialog Tela Cheia */}
      <Dialog open={telaCheia} onOpenChange={setTelaCheia}>
        <DialogContent className="w-screen h-screen max-w-full max-h-full p-0 rounded-none border-0">
          <div className="absolute top-4 right-4 z-50">
            <Button
              onClick={() => setTelaCheia(false)}
              size="icon"
              variant="outline"
              className="bg-white shadow-lg"
              title="Fechar tela cheia"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="w-full h-full">
            {mapa}
          </div>
        </DialogContent>
      </Dialog>

      {localizacaoAtual?.lat && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm">
          <p className="font-semibold text-blue-900">Localização Atual:</p>
          <p className="text-blue-800">{localizacaoAtual.endereco}</p>
        </div>
      )}

      {destino?.lat && (
         <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
           <p className="font-semibold text-red-900">Destino Selecionado:</p>
           <p className="text-red-800">{destino.endereco}</p>
         </div>
       )}
      </div>
      );
      }
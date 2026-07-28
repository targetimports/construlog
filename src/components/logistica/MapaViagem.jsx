import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PainelNavegacao from './PainelNavegacao';
import AlertasNavegacao from './AlertasNavegacao';
import { useOtimizadorRotaDinamica } from './useOtimizadorRotaDinamica';
import { useMinhaLocalizacao } from './useMinhaLocalizacao';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export default function MapaViagem({ rota }) {
  const [rastreamento, setRastreamento] = useState([]);
  const [melhorRota, setMelhorRota] = useState([]);

  // Localização do dispositivo (GPS preciso no celular, fallback por IP no PC).
  const { localizacao, erro: geoErro, loading, atualizar: atualizarLocalizacao } = useMinhaLocalizacao();

  // Cada nova posição vira um ponto na trilha de rastreamento (breadcrumb).
  useEffect(() => {
    if (localizacao) setRastreamento(prev => [...prev, [localizacao.lat, localizacao.lng]]);
  }, [localizacao]);

  // Hook de otimização dinâmica
  const {
    rotaOtimizada,
    tempoEstimado,
    distanciaRestante,
    desvioDetectado,
    notificacaoAtiva,
    recalcularRota
  } = useOtimizadorRotaDinamica(localizacao, melhorRota, rota, (novosDados) => {
    setMelhorRota(novosDados.rota);
  });

  // Buscar melhor rota entre origem e destino
  useEffect(() => {
    if (!rota?.latitude_origem || !rota?.longitude_origem || !rota?.latitude_destino || !rota?.longitude_destino) {
      return;
    }

    const fetchMelhorRota = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${rota.longitude_origem},${rota.latitude_origem};${rota.longitude_destino},${rota.latitude_destino}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.routes && data.routes[0]) {
          const coords = data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
          setMelhorRota(coords);
        }
      } catch (error) {
        console.error('Erro ao buscar rota:', error);
      }
    };

    fetchMelhorRota();
  }, [rota]);

  useEffect(() => {
    atualizarLocalizacao(false);
    const interval = setInterval(() => atualizarLocalizacao(false), 30000);
    return () => clearInterval(interval);
  }, []);

  const originCoords = rota?.latitude_origem && rota?.longitude_origem
    ? [rota.latitude_origem, rota.longitude_origem]
    : [-15.8267, -47.8822];

  const destCoords = rota?.latitude_destino && rota?.longitude_destino
    ? [rota.latitude_destino, rota.longitude_destino]
    : null;

  const center = localizacao 
    ? [localizacao.lat, localizacao.lng]
    : originCoords;

  return (
    <div className="space-y-4">
      {/* ALERTAS DE NAVEGAÇÃO */}
      <AlertasNavegacao
        desvioDetectado={desvioDetectado}
        notificacaoAtiva={notificacaoAtiva}
        tempoEstimado={tempoEstimado}
        distanciaRestante={distanciaRestante}
      />

      {/* Aviso de localização aproximada (fallback por IP, típico de desktop) */}
      {localizacao?.aprox && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-800 flex items-start gap-2">
          <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Localização <strong>aproximada</strong> (por IP) — o GPS não está disponível neste computador. A navegação passo a passo é imprecisa aqui; no celular a posição é exata.</span>
        </div>
      )}

      {/* PAINEL DE NAVEGAÇÃO COM INSTRUÇÕES */}
      <PainelNavegacao
        rota={rota}
        localizacao={localizacao}
        melhorRota={rotaOtimizada}
        geoErro={geoErro}
      />

      {/* MAPA */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Mapa em Tempo Real
          </h3>
          <Button
            onClick={() => atualizarLocalizacao(true)}
            disabled={loading}
            size="sm"
            variant="outline"
          >
            {loading ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Atualizando...
              </>
            ) : (
              <>
                <MapPin className="w-3 h-3 mr-1" />
                Atualizar
              </>
            )}
          </Button>
        </div>

      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom={false}
        className="w-full h-[500px] rounded-lg border border-blue-300 shadow-md"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Origem */}
        <Marker position={originCoords}>
          <Popup>
            <div className="text-sm">
              <p className="font-bold text-green-600">Origem</p>
              <p>{rota?.endereco_origem || 'Local de partida'}</p>
            </div>
          </Popup>
        </Marker>

        {/* Destino */}
        {destCoords && (
          <Marker position={destCoords}>
            <Popup>
              <div className="text-sm">
                <p className="font-bold text-red-600">Destino</p>
                <p>{rota?.endereco_destino || 'Local de chegada'}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Localização Atual em Tempo Real */}
        {localizacao && (
          <CircleMarker
            center={[localizacao.lat, localizacao.lng]}
            radius={12}
            fillColor="#3b82f6"
            color="#1e40af"
            weight={3}
            opacity={0.8}
            fillOpacity={0.8}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-bold text-blue-600">Você está aqui</p>
                <p className="text-gray-600">
                  {localizacao.lat.toFixed(4)}, {localizacao.lng.toFixed(4)}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Atualizado em {new Date().toLocaleTimeString('pt-BR')}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        )}

        {/* Melhor Rota (via OSRM) - LINHA AZUL PRINCIPAL */}
        {rotaOtimizada.length > 0 && (
          <Polyline
            positions={rotaOtimizada}
            color={desvioDetectado ? '#ef4444' : '#3b82f6'}
            weight={6}
            opacity={0.95}
            lineCap="round"
            lineJoin="round"
            dashArray={desvioDetectado ? '5, 5' : undefined}
          />
        )}

        {/* Rota Reta como fallback */}
        {destCoords && melhorRota.length === 0 && (
          <Polyline
            positions={[originCoords, destCoords]}
            color="#2563eb"
            weight={4}
            opacity={0.5}
            dashArray="5, 5"
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Polyline com histórico de rastreamento */}
        {rastreamento.length > 1 && (
          <Polyline
            positions={rastreamento}
            color="#3b82f6"
            weight={3}
            opacity={0.7}
            dashArray="5, 5"
          />
        )}
      </MapContainer>

      </div>

      {localizacao && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm">
          <p className="font-semibold text-blue-900">
            Posição Atual{localizacao.aprox ? ' (aproximada)' : ''}:
          </p>
          <p className="text-blue-800 font-mono text-xs">
            {localizacao.lat.toFixed(6)}, {localizacao.lng.toFixed(6)}
          </p>
          <p className="text-blue-700 text-xs mt-1">
            {localizacao.aprox
              ? 'Estimada por IP (nível cidade/bairro)'
              : '✓ Atualizado automaticamente a cada 30 segundos'}
          </p>
        </div>
      )}
    </div>
  );
}
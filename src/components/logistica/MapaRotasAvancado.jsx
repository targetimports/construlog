import React, { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Trash2, Copy, ZoomIn, ZoomOut, Navigation, Flag, Crosshair, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useMinhaLocalizacao } from './useMinhaLocalizacao';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Icons customizados para tipos de POI
const createIcon = (tipo, cor) => {
  const colors = {
    fuel: '#fbbf24',      // Amarelo
    maintenance: '#f87171', // Vermelho
    rest: '#60a5fa',       // Azul
    delivery: '#10b981',   // Verde
    custom: '#8b5cf6'      // Roxo
  };
  
  const color = colors[tipo] || cores[tipo] || '#6b7280';
  
  const html = `
    <div style="
      background: ${color};
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 16px;
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    "></div>
  `;
  
  return L.divIcon({
    html,
    iconSize: [32, 32],
    className: 'custom-icon'
  });
};

export default function MapaRotasAvancado({ 
  rota, 
  localizacaoAtual, 
  historicoRastreamento = [], 
  pois = [],
  onAdicionarPOI,
  onRemoverPOI
}) {
  const [mapRef, setMapRef] = useState(null);
  const [selecionandoPOI, setSelecionandoPOI] = useState(false);
  const [poiAtual, setPoiAtual] = useState(null);
  const [poimodoEdicao, setPoimodoEdicao] = useState('view');

  // Localização do DISPOSITIVO de quem está vendo (GPS preciso no celular,
  // fallback aproximado por IP no PC). Distinta da posição vinda da telemetria
  // da rota (localizacaoAtual = onde o veículo reportou estar).
  const { localizacao: minhaLoc, erro: geoErro, loading: geoLoading, atualizar } = useMinhaLocalizacao();
  useEffect(() => { atualizar(false); }, [atualizar]);

  // Centraliza o mapa na minha localização quando ela é obtida manualmente.
  const irParaMinhaLocalizacao = () => {
    atualizar(true);
    if (minhaLoc && mapRef) mapRef.setView([minhaLoc.lat, minhaLoc.lng], 15);
  };

  // Coordenadas principais
  const originCoords = rota?.latitude_origem && rota?.longitude_origem
    ? [rota.latitude_origem, rota.longitude_origem]
    : [-15.8267, -47.8822];

  const destCoords = rota?.latitude_destino && rota?.longitude_destino
    ? [rota.latitude_destino, rota.longitude_destino]
    : null;

  // Posição "atual" preferida: telemetria do veículo > minha localização > origem.
  const currentCoords = localizacaoAtual
    ? [localizacaoAtual.lat, localizacaoAtual.lng]
    : minhaLoc
    ? [minhaLoc.lat, minhaLoc.lng]
    : originCoords;

  const center = currentCoords;

  // Clique no mapa para adicionar POI
  const handleMapClick = (e) => {
    if (!selecionandoPOI) return;
    
    const { lat, lng } = e.latlng;
    setPoiAtual({
      lat,
      lng,
      titulo: '',
      tipo: 'custom',
      descricao: ''
    });
  };

  // Adicionar POI
  const handleSalvarPOI = () => {
    if (!poiAtual?.titulo) {
      toast.error('Digite um título para o POI');
      return;
    }
    
    onAdicionarPOI?.(poiAtual);
    setSelecionandoPOI(false);
    setPoiAtual(null);
    toast.success('POI adicionado ao mapa');
  };

  // Remover POI
  const handleRemoverPOI = (id) => {
    onRemoverPOI?.(id);
    toast.success('POI removido');
  };

  // Fitness bounds para incluir todos os pontos
  const calcularBounds = () => {
    const pontos = [
      originCoords,
      ...(destCoords ? [destCoords] : []),
      ...(localizacaoAtual ? [[localizacaoAtual.lat, localizacaoAtual.lng]] : []),
      ...pois.map(p => [p.lat, p.lng])
    ];
    
    if (pontos.length === 0) return center;
    
    const lats = pontos.map(p => p[0]);
    const lngs = pontos.map(p => p[1]);
    
    return [
      [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2],
      Math.max(...lats) - Math.min(...lats),
      Math.max(...lngs) - Math.min(...lngs)
    ];
  };

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => setSelecionandoPOI(!selecionandoPOI)}
          variant={selecionandoPOI ? 'default' : 'outline'}
          size="sm"
          className={selecionandoPOI ? 'bg-blue-600' : ''}
        >
          <Flag className="w-4 h-4 mr-1.5" />
          {selecionandoPOI ? 'Clique no mapa...' : 'Adicionar POI'}
        </Button>
        
        <Button
          onClick={() => mapRef?.fitBounds([
            [Math.min(...pois.map(p => p.lat), originCoords[0], destCoords?.[0] || 0),
             Math.min(...pois.map(p => p.lng), originCoords[1], destCoords?.[1] || 0)],
            [Math.max(...pois.map(p => p.lat), originCoords[0], destCoords?.[0] || 0),
             Math.max(...pois.map(p => p.lng), originCoords[1], destCoords?.[1] || 0)]
          ])}
          variant="outline"
          size="sm"
        >
          <ZoomIn className="w-4 h-4 mr-1.5" />
          Zoom Tudo
        </Button>

        <Button onClick={irParaMinhaLocalizacao} disabled={geoLoading} variant="outline" size="sm">
          {geoLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Crosshair className="w-4 h-4 mr-1.5" />}
          Minha localização
        </Button>
      </div>

      {/* Aviso de localização aproximada (fallback por IP, típico de desktop) */}
      {minhaLoc?.aprox && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-800 flex items-start gap-2">
          <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Sua localização é <strong>aproximada</strong> (por IP) — o GPS não está disponível neste computador. No celular a posição é exata.</span>
        </div>
      )}

      {/* Erro de localização (permissão/timeout) — só quando não há posição alguma */}
      {!minhaLoc && geoErro && geoErro.tipo !== 'aprox' && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-800 flex items-start gap-2">
          <Crosshair className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{geoErro.msg}</span>
        </div>
      )}

      {/* Mapa */}
      <MapContainer
        ref={setMapRef}
        center={center}
        zoom={15}
        scrollWheelZoom={true}
        className={`w-full h-96 rounded-lg border-2 ${selecionandoPOI ? 'border-blue-500' : 'border-gray-300'} cursor-${selecionandoPOI ? 'crosshair' : 'auto'}`}
        onClick={handleMapClick}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Origem */}
        <Marker position={originCoords}>
          <Tooltip permanent={false} direction="top">
            <div className="text-xs font-semibold">Origem</div>
          </Tooltip>
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
            <Tooltip permanent={false} direction="top">
              <div className="text-xs font-semibold">Destino</div>
            </Tooltip>
            <Popup>
              <div className="text-sm">
                <p className="font-bold text-red-600">Destino</p>
                <p>{rota?.endereco_destino || 'Local de chegada'}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Localização Atual */}
        {localizacaoAtual && (
          <CircleMarker
            center={currentCoords}
            radius={12}
            fillColor="#3b82f6"
            color="#1e40af"
            weight={3}
            opacity={0.8}
            fillOpacity={0.8}
          >
            <Tooltip permanent={true} direction="top" offset={[0, -15]}>
              <div className="text-xs font-bold text-white bg-blue-600 px-2 py-1 rounded">
                Veículo (telemetria)
              </div>
            </Tooltip>
            <Popup>
              <div className="text-sm">
                <p className="font-bold text-blue-600">Posição do veículo (telemetria)</p>
                <p className="text-gray-600 text-xs font-mono">
                  {localizacaoAtual.lat.toFixed(4)}, {localizacaoAtual.lng.toFixed(4)}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        )}

        {/* Minha localização (dispositivo de quem vê) — verde, distinta da telemetria */}
        {minhaLoc && (
          <CircleMarker
            center={[minhaLoc.lat, minhaLoc.lng]}
            radius={minhaLoc.aprox ? 16 : 11}
            fillColor={minhaLoc.aprox ? '#10b981' : '#059669'}
            color="#047857"
            weight={3}
            opacity={0.9}
            fillOpacity={minhaLoc.aprox ? 0.25 : 0.8}
          >
            <Tooltip permanent={false} direction="top" offset={[0, -10]}>
              <div className="text-xs font-semibold">Minha localização{minhaLoc.aprox ? ' (aproximada)' : ''}</div>
            </Tooltip>
            <Popup>
              <div className="text-sm">
                <p className="font-bold text-emerald-700">Minha localização{minhaLoc.aprox ? ' (aproximada)' : ''}</p>
                <p className="text-gray-600 text-xs font-mono">{minhaLoc.lat.toFixed(4)}, {minhaLoc.lng.toFixed(4)}</p>
                {minhaLoc.aprox && <p className="text-gray-500 text-xs mt-1">Estimada por IP (nível cidade/bairro)</p>}
              </div>
            </Popup>
          </CircleMarker>
        )}

        {/* Histórico de Rastreamento */}
        {historicoRastreamento.length > 1 && (
          <Polyline
            positions={historicoRastreamento}
            color="#3b82f6"
            weight={3}
            opacity={0.6}
            dashArray="5, 5"
            lineCap="round"
            lineJoin="round"
          >
            <Tooltip>Histórico de rastreamento</Tooltip>
          </Polyline>
        )}

        {/* Rota Sugerida (origem > destino) */}
        {destCoords && (
          <Polyline
            positions={[originCoords, destCoords]}
            color="#f59e0b"
            weight={4}
            opacity={0.7}
            dashArray="10, 5"
            lineCap="round"
            lineJoin="round"
          >
            <Tooltip>Rota planejada</Tooltip>
          </Polyline>
        )}

        {/* POIs (Pontos de Interesse) */}
        {pois?.map((poi, idx) => (
          <Marker
            key={`${poi.id || idx}`}
            position={[poi.lat, poi.lng]}
            icon={createIcon(poi.tipo)}
          >
            <Popup>
              <div className="text-sm space-y-2">
                <div>
                  <p className="font-bold text-gray-900">{poi.titulo}</p>
                  <p className="text-gray-600 text-xs">{poi.descricao}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    Tipo: {poi.tipo} | {poi.lat.toFixed(4)}, {poi.lng.toFixed(4)}
                  </p>
                </div>
                <Button
                  onClick={() => handleRemoverPOI(poi.id)}
                  size="sm"
                  variant="destructive"
                  className="w-full text-xs"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Remover
                </Button>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* POI sendo criado */}
        {poiAtual && (
          <Marker position={[poiAtual.lat, poiAtual.lng]}>
            <Popup>
              <div className="space-y-2 min-w-48">
                <p className="font-bold text-sm">Novo POI</p>
                <input
                  type="text"
                  placeholder="Título"
                  value={poiAtual.titulo}
                  onChange={(e) => setPoiAtual({...poiAtual, titulo: e.target.value})}
                  className="w-full px-2 py-1 border rounded text-xs"
                />
                <select
                  value={poiAtual.tipo}
                  onChange={(e) => setPoiAtual({...poiAtual, tipo: e.target.value})}
                  className="w-full px-2 py-1 border rounded text-xs"
                >
                  <option value="fuel">Combustível</option>
                  <option value="maintenance">Manutenção</option>
                  <option value="rest">Descanso</option>
                  <option value="delivery">Entrega</option>
                  <option value="custom">Outro</option>
                </select>
                <input
                  type="text"
                  placeholder="Descrição (opcional)"
                  value={poiAtual.descricao}
                  onChange={(e) => setPoiAtual({...poiAtual, descricao: e.target.value})}
                  className="w-full px-2 py-1 border rounded text-xs"
                />
                <div className="flex gap-1">
                  <Button
                    onClick={handleSalvarPOI}
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-xs"
                  >
                    ✓ Salvar
                  </Button>
                  <Button
                    onClick={() => {
                      setPoiAtual(null);
                      setSelecionandoPOI(false);
                    }}
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                  >
                    ✕ Cancelar
                  </Button>
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Info POIs */}
      {pois?.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pontos de Interesse ({pois.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {pois.map((poi, idx) => (
                <div key={`${poi.id || idx}`} className="text-xs flex items-center justify-between bg-white p-2 rounded">
                  <span className="font-medium">{poi.titulo}</span>
                  <span className="text-gray-500">{poi.tipo}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MapPin, Navigation, AlertTriangle, CheckCircle2, Zap, Maximize2, X } from 'lucide-react';
import { toast } from 'sonner';
import ValidadorEnderecoComIA from './ValidadorEnderecoComIA';
import MapaLocalizacao from './MapaLocalizacao';

export default function FormRotaComIA({ onRotaSugerida, veiculo }) {
  const [origem, setOrigem] = useState(null);
  const [destino, setDestino] = useState(null);
  const [dataViagem, setDataViagem] = useState(new Date().toISOString().split('T')[0]);
  const [horaViagem, setHoraViagem] = useState('09:00');
  const [carregando, setCarregando] = useState(false);
  const [sugestao, setSugestao] = useState(null);
  const [dadosReais, setDadosReais] = useState(null);
  const [capturandoOrigem, setCapturandoOrigem] = useState(false);
  const [localizacaoOrigem, setLocalizacaoOrigem] = useState(null);
  const [abrirMapaOrigem, setAbrirMapaOrigem] = useState(false);

  const capturarLocalizacaoOrigem = async () => {
    setCapturandoOrigem(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { 
          enableHighAccuracy: true,
          timeout: 10000
        });
      });

      const { latitude, longitude } = position.coords;
      setLocalizacaoOrigem({ lat: latitude, lng: longitude });

      // Buscar endereço a partir das coordenadas
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10&addressdetails=1`
      );
      const data = await res.json();

      const endereco = data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      setOrigem({
        endereco,
        lat: latitude,
        lng: longitude,
        description: endereco
      });

      toast.success('Localização da origem capturada!');
    } catch (error) {
      toast.error('Erro ao capturar localização: ' + error.message);
    } finally {
      setCapturandoOrigem(false);
    }
  };

  const sugerirRotaOtimizada = async () => {
    if (!origem || !destino) {
      toast.error('Defina origem e destino');
      return;
    }

    setCarregando(true);
    try {
      const response = await base44.functions.invoke('sugerirRotaOtimizadaComIA', {
        origem,
        destino,
        veiculoId: veiculo?.id,
        dataViagem: `${dataViagem}T${horaViagem}`
      });

      const dados = response.data;
      setSugestao(dados.sugestao_ia);
      setDadosReais(dados.dados_reais);

      toast.success('✓ Rota otimizada sugerida pela IA!');

      if (onRotaSugerida) {
        onRotaSugerida(dados);
      }
    } catch (error) {
      toast.error('Erro: ' + error.message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* SEÇÃO ORIGEM */}
      <Card className="border-green-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="w-4 h-4 text-green-600" />
            Endereço de Origem
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ValidadorEnderecoComIA
            tipo="origem"
            onEnderecoValido={(dados) => setOrigem(dados)}
          />
          
          {/* Localização em Tempo Real */}
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-green-900 mb-2 flex items-center gap-2">
              <Navigation className="w-3 h-3" />
              Origem - Localização em Tempo Real
            </p>
            <div className="flex gap-2">
              <Button
                onClick={capturarLocalizacaoOrigem}
                disabled={capturandoOrigem}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                {capturandoOrigem ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    Capturando...
                  </>
                ) : (
                  <>
                    <Navigation className="w-3 h-3 mr-2" />
                    Usar Localização
                  </>
                )}
              </Button>
              {localizacaoOrigem && (
                <Button
                  onClick={() => setAbrirMapaOrigem(true)}
                  variant="outline"
                  size="sm"
                  className="px-2"
                  title="Ver no mapa"
                >
                  <Maximize2 className="w-3 h-3" />
                </Button>
              )}
            </div>
            {localizacaoOrigem && (
              <div className="mt-2 p-2 bg-green-50 rounded border border-green-200 text-xs text-green-700">
                {localizacaoOrigem.lat.toFixed(4)}, {localizacaoOrigem.lng.toFixed(4)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* MODAL MAPA ORIGEM */}
      {abrirMapaOrigem && localizacaoOrigem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2">
          <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Localização Exata da Origem</CardTitle>
              <Button
                onClick={() => setAbrirMapaOrigem(false)}
                variant="ghost"
                size="icon"
                className="h-6 w-6"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <MapaLocalizacao
                localizacaoInicial={localizacaoOrigem}
                onLocalizacao={(loc) => {
                  setLocalizacaoOrigem(loc);
                  setOrigem({
                    endereco: `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`,
                    lat: loc.lat,
                    lng: loc.lng,
                    description: `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`
                  });
                  toast.success('Localização atualizada');
                }}
              />
            </CardContent>
        </CardContent>
      </Card>

      {/* SEÇÃO DESTINO */}
      <Card className="border-red-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="w-4 h-4 text-red-600" />
            Endereço de Destino
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ValidadorEnderecoComIA
            tipo="destino"
            onEnderecoValido={(dados) => setDestino(dados)}
          />
        </CardContent>
      </Card>

      {/* SEÇÃO DATA/HORA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Data e Hora da Viagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            type="date"
            value={dataViagem}
            onChange={(e) => setDataViagem(e.target.value)}
          />
          <Input
            type="time"
            value={horaViagem}
            onChange={(e) => setHoraViagem(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* BOTÃO SUGERIR ROTA */}
      <Button
        onClick={sugerirRotaOtimizada}
        disabled={!origem || !destino || carregando}
        className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6"
      >
        {carregando ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Analisando melhor rota com IA...
          </>
        ) : (
          <>
            <Zap className="w-5 h-5 mr-2" />
            Sugerir Rota Otimizada
          </>
        )}
      </Button>

      {/* RESULTADO - SUGESTÃO DA IA */}
      {sugestao && (
        <Card className="border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              Rota Sugerida pela IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* DADOS REAIS */}
            {dadosReais && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-white p-2 rounded border border-blue-200">
                  <p className="text-xs text-gray-600">Distância</p>
                  <p className="text-lg font-bold text-blue-600">
                    {dadosReais.distancia_km?.toFixed(1)} km
                  </p>
                </div>
                <div className="bg-white p-2 rounded border border-blue-200">
                  <p className="text-xs text-gray-600">Tempo Estimado</p>
                  <p className="text-lg font-bold text-blue-600">
                    {dadosReais.tempo_minutos} min
                  </p>
                </div>
              </div>
            )}

            {/* ROTA PRINCIPAL */}
            <div>
              <p className="text-xs font-semibold text-blue-900 mb-1">ROTA PRINCIPAL:</p>
              <p className="text-sm text-blue-800 bg-white p-2 rounded">
                {sugestao.rota_principal}
              </p>
            </div>

            {/* RISCO DE TRÂNSITO */}
            <div className="flex items-center gap-2 p-2 rounded bg-white border-2"
              style={{
                borderColor: sugestao.risco_transito === 'alto' ? '#ef4444' : 
                           sugestao.risco_transito === 'medio' ? '#f59e0b' : '#10b981'
              }}
            >
              {sugestao.risco_transito === 'alto' && (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              )}
              {sugestao.risco_transito === 'medio' && (
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
              )}
              {sugestao.risco_transito === 'baixo' && (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              )}
              <span className="text-sm font-semibold">
                Risco de Trânsito: {sugestao.risco_transito?.toUpperCase()}
              </span>
            </div>

            {/* PONTOS DE ATENÇÃO */}
            {sugestao.pontos_atencao?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-orange-900 mb-1">PONTOS DE ATENÇÃO:</p>
                <ul className="text-xs space-y-1">
                  {sugestao.pontos_atencao.map((ponto, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-orange-600">•</span>
                      <span className="text-orange-800">{ponto}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ROTA ALTERNATIVA */}
            {sugestao.rota_alternativa && (
              <div>
                <p className="text-xs font-semibold text-purple-900 mb-1">ROTA ALTERNATIVA:</p>
                <p className="text-xs text-purple-800 bg-white p-2 rounded">
                  {sugestao.rota_alternativa}
                </p>
              </div>
            )}

            {/* PARADAS RECOMENDADAS */}
            {sugestao.paradas_recomendadas?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-900 mb-1">PARADAS RECOMENDADAS:</p>
                <ul className="text-xs space-y-1">
                  {sugestao.paradas_recomendadas.map((parada, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-green-600">✓</span>
                      <span className="text-green-800">{parada}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* RECOMENDAÇÕES */}
            {sugestao.recomendacoes?.length > 0 && (
              <div className="bg-white p-2 rounded border border-blue-200">
                <p className="text-xs font-semibold text-blue-900 mb-1">RECOMENDAÇÕES:</p>
                <ul className="text-xs space-y-1">
                  {sugestao.recomendacoes.map((rec, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-blue-600">→</span>
                      <span className="text-blue-800">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
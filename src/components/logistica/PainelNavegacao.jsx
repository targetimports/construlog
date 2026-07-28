import React, { useEffect, useState } from 'react';
import { ArrowUp, MapPin, Navigation, ChevronRight, CornerDownRight, CornerDownLeft } from 'lucide-react';

export default function PainelNavegacao({ rota, localizacao, melhorRota, geoErro }) {
  const [proximos, setProximos] = useState([]);
  const [distanciaProxima, setDistanciaProxima] = useState(null);
  const [instrucao, setInstrucao] = useState(null);

  // Calcular distância entre dois pontos (Haversine)
  const calcularDistancia = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // retorna em metros
  };

  // Gerar pontos de instrução baseado na rota
  const gerarInstrucoes = () => {
    if (!melhorRota || melhorRota.length < 3) return [];

    const instrucoes = [];
    const destino = [rota.latitude_destino, rota.longitude_destino];

    // Dividir rota em segmentos com instruções
    const segmentosInstrucao = [];
    for (let i = 0; i < melhorRota.length - 2; i += Math.ceil(melhorRota.length / 5)) {
      segmentosInstrucao.push(melhorRota[i]);
    }
    segmentosInstrucao.push(destino);

    // Gerar instruções para cada segmento
    for (let i = 0; i < segmentosInstrucao.length - 1; i++) {
      const atual = segmentosInstrucao[i];
      const proximo = segmentosInstrucao[i + 1];
      
      const lat1 = atual[0];
      const lng1 = atual[1];
      const lat2 = proximo[0];
      const lng2 = proximo[1];

      const distancia = calcularDistancia(lat1, lng1, lat2, lng2);

      // Determinar direção
      const dLng = lng2 - lng1;
      let direcao = 'Siga em frente';
      let icone = ArrowUp;

      if (dLng > 0.005) {
        direcao = 'Vire à direita';
        icone = CornerDownRight;
      } else if (dLng < -0.005) {
        direcao = 'Vire à esquerda';
        icone = CornerDownLeft;
      }

      instrucoes.push({
        direcao,
        icone,
        distancia: Math.round(distancia),
        coords: proximo
      });
    }

    return instrucoes;
  };

  // Atualizar instruções próximas
  useEffect(() => {
    if (!localizacao || !melhorRota) return;

    const instrucoes = gerarInstrucoes();
    if (instrucoes.length === 0) return;

    // Encontrar próxima instrução
    let proximaInstrucao = null;
    let menorDistancia = Infinity;

    instrucoes.forEach(instr => {
      const dist = calcularDistancia(
        localizacao.lat,
        localizacao.lng,
        instr.coords[0],
        instr.coords[1]
      );

      if (dist < menorDistancia) {
        menorDistancia = dist;
        proximaInstrucao = { ...instr, distancia: Math.round(dist) };
      }
    });

    setProximos(instrucoes);
    setInstrucao(proximaInstrucao);
    setDistanciaProxima(proximaInstrucao?.distancia || null);
  }, [localizacao, melhorRota, rota]);

  if (!instrucao) {
    // Sem localização ao vivo (GPS) não há navegação passo a passo. Em vez de
    // um "Calculando rota..." infinito, explicamos o ESTADO REAL: se houve erro
    // de GPS (permissão, timeout, contexto inseguro), mostramos o motivo certo;
    // caso contrário, sinalizamos que estamos obtendo a localização.
    if (!localizacao) {
      const motivo = geoErro?.msg
        || 'Obtendo sua localização… Se o navegador pedir permissão de localização, autorize. O destino e o trajeto já aparecem no mapa abaixo.';
      return (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg text-sm text-amber-800 flex items-start gap-3">
          <Navigation className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">
              {geoErro ? 'Navegação ao vivo indisponível' : 'Aguardando localização (GPS)'}
            </p>
            <p className="text-amber-700 mt-0.5">{motivo}</p>
          </div>
        </div>
      );
    }
    return (
      <div className="bg-gray-50 border border-gray-300 p-4 rounded-lg text-center text-gray-500 text-sm">
        Calculando rota...
      </div>
    );
  }

  const IconAtual = instrucao.icone;

  // Formatador de distância
  const formatarDistancia = (metros) => {
    if (metros >= 1000) {
      return `${(metros / 1000).toFixed(1)} km`;
    }
    return `${Math.round(metros)} m`;
  };

  return (
    <div className="space-y-3">
      {/* PAINEL PRINCIPAL - PRÓXIMA INSTRUÇÃO */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-5 rounded-xl shadow-lg">
        <div className="flex items-center gap-4">
          {/* Ícone da Instrução */}
          <div className="bg-white/20 p-3 rounded-full flex-shrink-0">
            <IconAtual className="w-8 h-8" />
          </div>

          {/* Instrução e Distância */}
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold">{instrucao.direcao}</p>
            <p className="text-blue-100 text-sm">
              em {formatarDistancia(instrucao.distancia)}
            </p>
          </div>

          {/* Distância Grande */}
          <div className="text-right flex-shrink-0">
            <p className="text-3xl font-bold">{Math.round(instrucao.distancia / 100) * 100}</p>
            <p className="text-blue-100 text-xs">metros</p>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white transition-all duration-300"
            style={{ width: `${Math.min(100, (100 / (instrucao.distancia / 10)))}%` }}
          />
        </div>
      </div>

      {/* PRÓXIMAS INSTRUÇÕES (Preview) */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-600 px-1">PRÓXIMOS PASSOS</p>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {proximos.slice(0, 5).map((instr, idx) => {
            const Icon = instr.icone;
            const isProxima = idx === 0;
            
            return (
              <div
                key={idx}
                className={`flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                  isProxima
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-gray-50 border border-gray-200 opacity-60'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isProxima ? 'text-blue-600' : 'text-gray-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isProxima ? 'text-blue-900' : 'text-gray-700'}`}>
                    {instr.direcao}
                  </p>
                  <p className={`text-xs ${isProxima ? 'text-blue-700' : 'text-gray-500'}`}>
                    {formatarDistancia(instr.distancia)}
                  </p>
                </div>
                <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isProxima ? 'text-blue-600' : 'text-gray-400'}`} />
              </div>
            );
          })}
        </div>
      </div>

      {/* INFO DESTINO */}
      <div className="bg-green-50 border border-green-200 p-3 rounded-lg flex items-start gap-3">
        <MapPin className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm min-w-0">
          <p className="text-green-900 font-semibold text-xs">DESTINO</p>
          <p className="text-green-800 truncate">{rota?.endereco_destino || 'Destino desconhecido'}</p>
        </div>
      </div>
    </div>
  );
}
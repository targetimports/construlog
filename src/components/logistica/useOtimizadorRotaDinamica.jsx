import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

export const useOtimizadorRotaDinamica = (localizacao, melhorRota, rota, onRotaAtualizada) => {
  const [rotaOtimizada, setRotaOtimizada] = useState(melhorRota);
  const [tempoEstimado, setTempoEstimado] = useState(null);
  const [distanciaRestante, setDistanciaRestante] = useState(null);
  const [desvioDetectado, setDesvioDetectado] = useState(false);
  const [notificacaoAtiva, setNotificacaoAtiva] = useState(false);
  const [alerataTrafegoAtivo, setAlertaTrafegoAtivo] = useState(false);

  // Calcular distância Haversine
  const calcularDistancia = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // metros
  };

  // Detectar desvio da rota
  const detectarDesvio = useCallback(() => {
    if (!localizacao || !melhorRota || melhorRota.length === 0) return;

    let menorDistancia = Infinity;
    for (const ponto of melhorRota) {
      const dist = calcularDistancia(localizacao.lat, localizacao.lng, ponto[0], ponto[1]);
      menorDistancia = Math.min(menorDistancia, dist);
    }

    // Se desvio > 100m, alertar
    if (menorDistancia > 100) {
      setDesvioDetectado(true);
      return true;
    }

    setDesvioDetectado(false);
    return false;
  }, [localizacao, melhorRota]);

  // Recalcular rota via OSRM
  const recalcularRota = useCallback(async (origem, destino) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${origem.lng},${origem.lat};${destino.lng},${destino.lat}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const novaRota = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        const tempoSegundos = route.duration;
        const distanciaMetros = route.distance;

        setRotaOtimizada(novaRota);
        setTempoEstimado(tempoSegundos);
        setDistanciaRestante(distanciaMetros);

        if (onRotaAtualizada) {
          onRotaAtualizada({
            rota: novaRota,
            tempo: tempoSegundos,
            distancia: distanciaMetros
          });
        }

        return { rota: novaRota, tempo: tempoSegundos, distancia: distanciaMetros };
      }
    } catch (error) {
      console.error('Erro ao recalcular rota:', error);
    }
  }, [onRotaAtualizada]);

  // Monitorar desvio e recalcular se necessário
  useEffect(() => {
    if (!localizacao) return;

    const interval = setInterval(async () => {
      const desvio = detectarDesvio();

      if (desvio) {
        setNotificacaoAtiva(true);
        
        // Tocar som de alerta
        reproduzirSomAlerta();
        
        // Toast notificação
        toast.error('Você saiu da rota! Recalculando...', {
          duration: 5000
        });

        // Recalcular rota do ponto atual até o destino
        await recalcularRota(
          { lat: localizacao.lat, lng: localizacao.lng },
          { 
            lat: rota.latitude_destino || parseFloat(rota.endereco_destino.split(',')[0]), 
            lng: rota.longitude_destino || parseFloat(rota.endereco_destino.split(',')[1])
          }
        );

        setTimeout(() => setNotificacaoAtiva(false), 3000);
      }
    }, 15000); // Verificar a cada 15 segundos

    return () => clearInterval(interval);
  }, [localizacao, melhorRota, rota, detectarDesvio, recalcularRota]);

  // Som de alerta
  const reproduzirSomAlerta = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // Hz
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      console.warn('Áudio não disponível');
    }
  };

  // Calcular distância restante até destino
  useEffect(() => {
    if (!localizacao || !rota) return;

    const distancia = calcularDistancia(
      localizacao.lat,
      localizacao.lng,
      rota.latitude_destino,
      rota.longitude_destino
    );

    setDistanciaRestante(distancia);
  }, [localizacao, rota]);

  return {
    rotaOtimizada: rotaOtimizada || melhorRota,
    tempoEstimado,
    distanciaRestante,
    desvioDetectado,
    notificacaoAtiva,
    recalcularRota,
    detectarDesvio
  };
};
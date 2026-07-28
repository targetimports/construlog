import { useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const INTERVALO_ENVIO_MS = 15000; // Envia no máximo a cada 15 segundos

export function useRastreamentoTempoReal(rotaId, isAtiva) {
  const watchIdRef = useRef(null);
  const lastSentRef = useRef(0);
  const lastCoordsRef = useRef(null);

  const enviarLocalizacao = useCallback(async (latitude, longitude) => {
    const agora = Date.now();
    
    // Throttle: não enviar mais que 1x a cada 15s
    if (agora - lastSentRef.current < INTERVALO_ENVIO_MS) return;
    
    // Não enviar se coordenadas são iguais à última enviada
    if (lastCoordsRef.current &&
        Math.abs(lastCoordsRef.current.lat - latitude) < 0.0001 &&
        Math.abs(lastCoordsRef.current.lng - longitude) < 0.0001) {
      return;
    }

    lastSentRef.current = agora;
    lastCoordsRef.current = { lat: latitude, lng: longitude };

    try {
      await base44.functions.invoke('registrarLocalizacaoTempoReal', {
        rota_id: rotaId,
        latitude,
        longitude
      });
    } catch (err) {
      // Silencioso — não logar spam de erros
    }
  }, [rotaId]);

  useEffect(() => {
    if (!isAtiva || !rotaId || !navigator.geolocation) {
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        enviarLocalizacao(latitude, longitude);
      },
      (error) => {
        // Silencioso — GPS pode falhar sem necessidade de toast
        console.warn('GPS indisponível:', error.code);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [rotaId, isAtiva, enviarLocalizacao]);
}
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

// Hook de localização do DISPOSITIVO:
//  - GPS preciso (celular) com retry em baixa precisão quando a alta estoura;
//  - fallback APROXIMADO por IP (resolve desktop sem GPS), sem exigir permissão;
//  - diagnóstico real (permissão do site x bloqueio do Windows/navegador).
// Retorna { localizacao: {lat,lng,aprox?}, erro: {tipo,codigo?,msg}, loading, atualizar }.
export function useMinhaLocalizacao() {
  const [localizacao, setLocalizacao] = useState(null);
  const [erro, setErro] = useState(null);
  const [loading, setLoading] = useState(false);
  const ipFallbackTsRef = useRef(0);
  const temLocalizacaoRef = useRef(false);

  // Fallback p/ desktop sem GPS / sem localização do Windows: posição APROXIMADA
  // por IP (nível cidade/bairro). Throttle de 10 min em ciclos automáticos.
  const tentarPorIP = useCallback(async (manual) => {
    const agora = Date.now();
    if (!manual && agora - ipFallbackTsRef.current < 600000) return false;
    ipFallbackTsRef.current = agora;
    try {
      const resp = await fetch('https://ipwho.is/');
      const d = await resp.json();
      const lat = Number(d?.latitude);
      const lng = Number(d?.longitude);
      if (d?.success !== false && Number.isFinite(lat) && Number.isFinite(lng)) {
        setLocalizacao({ lat, lng, aprox: true });
        temLocalizacaoRef.current = true;
        setErro({ tipo: 'aprox', msg: 'Localização aproximada (por IP), pois o GPS não está disponível neste computador. No celular a posição é exata.' });
        if (manual) toast.success('Localização aproximada (por IP) obtida.');
        return true;
      }
    } catch { /* sem internet ou serviço indisponível */ }
    return false;
  }, []);

  const atualizar = useCallback((manual = false) => {
    // Contexto inseguro (HTTP/IP): o navegador bloqueia o GPS.
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setErro({ tipo: 'inseguro', msg: 'A localização (GPS) só é liberada em HTTPS. Acesse o sistema por https://construlog.com.br.' });
      if (manual) toast.error('GPS exige HTTPS');
      return;
    }
    if (!navigator.geolocation) {
      setErro({ tipo: 'nao_suportado', msg: 'Seu navegador não suporta geolocalização.' });
      return;
    }

    setLoading(true);

    const onOk = (position) => {
      const { latitude: lat, longitude: lng } = position.coords;
      setLocalizacao({ lat, lng });
      temLocalizacaoRef.current = true;
      setErro(null);
      setLoading(false);
      if (manual) toast.success('Localização atualizada!');
    };

    const onErro = async (error, jaTentouBaixaPrecisao) => {
      // Timeout (3) ou indisponível (2): tenta de novo sem alta precisão.
      if ((error.code === 3 || error.code === 2) && !jaTentouBaixaPrecisao) {
        navigator.geolocation.getCurrentPosition(
          onOk,
          (e2) => onErro(e2, true),
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        );
        return;
      }
      setLoading(false);

      // Antes de exibir o erro, tenta posição aproximada por IP (resolve o PC).
      const okIp = await tentarPorIP(manual);
      if (okIp) return;
      // Ciclo automático sem nova posição, mas já temos algo: não troca por erro.
      if (!manual && temLocalizacaoRef.current) return;

      let msg;
      if (error.code === 1) {
        // "Negada" pode ser do SITE ou do SISTEMA OPERACIONAL/navegador.
        let estadoSite = null;
        try {
          const p = await navigator.permissions?.query({ name: 'geolocation' });
          estadoSite = p?.state;
        } catch { /* navegador sem Permissions API */ }

        if (estadoSite === 'granted') {
          msg = 'O site já está autorizado, mas o Windows/navegador está bloqueando o GPS. No Windows: Configurações → Privacidade e segurança → Localização → ligue "Serviços de localização" e permita que os aplicativos (e o navegador) acessem. Depois recarregue e clique em Atualizar.';
        } else {
          msg = 'Permissão de localização negada para o site. Clique no cadeado (🔒) na barra de endereço, defina Localização como "Permitir" e clique em Atualizar.';
        }
      } else if (error.code === 2) {
        msg = 'Não foi possível obter sua localização (sinal/GPS indisponível). Em computador sem GPS isso é comum — no celular costuma funcionar.';
      } else {
        msg = 'Tempo esgotado ao obter a localização. Verifique o GPS/conexão e tente novamente.';
      }

      setErro({ tipo: 'erro', codigo: error.code, msg });
      if (manual) toast.error(msg.length > 90 ? msg.slice(0, 90) + '…' : msg);
    };

    navigator.geolocation.getCurrentPosition(
      onOk,
      (error) => onErro(error, false),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }, [tentarPorIP]);

  return { localizacao, erro, loading, atualizar };
}

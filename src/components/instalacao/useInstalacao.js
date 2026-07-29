import { useCallback, useEffect, useState } from 'react';

// Instalação já configurada? (existe empresa matriz no banco)
//
// Falha de rede responde "configurada" de propósito: mandar uma instalação em
// produção para a tela de configuração inicial por causa de um erro de consulta
// seria muito pior do que não mostrar a tela numa instalação nova.

export function useInstalacao() {
  const [configurado, setConfigurado] = useState(null); // null = ainda checando

  const checar = useCallback(async () => {
    try {
      const r = await fetch('/api/instalacao/status', { cache: 'no-store' });
      if (!r.ok) return setConfigurado(true);
      const d = await r.json();
      setConfigurado(d?.configurado !== false);
    } catch {
      setConfigurado(true);
    }
  }, []);

  useEffect(() => { checar(); }, [checar]);

  return { configurado, recarregar: checar };
}

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const GlobalContext = createContext();

export const GlobalContextProvider = ({ children }) => {
  const [obraAtual, setObraAtual] = useState(null);
  const [clienteAtual, setClienteAtual] = useState(null);
  const [resumoObra, setResumoObra] = useState(null);

  // Carregar contexto ao montar (lazy - apenas sob demanda)
  const { data: contextoData, isLoading: loadingContexto } = useQuery({
    queryKey: ['contexto-global'],
    queryFn: async () => {
      const resp = await base44.functions.invoke('getContextoAtual', {});
      return resp.data;
    },
    staleTime: 1000 * 60 * 10,
    refetchInterval: false,
    retry: 0, // Sem retry para evitar cascata
    enabled: false // Desabilitar carregamento automático
  });

  useEffect(() => {
    if (contextoData?.obra_atual_id) {
      setObraAtual({ id: contextoData.obra_atual_id });
      setClienteAtual(contextoData.cliente_atual_id ? { id: contextoData.cliente_atual_id } : null);
    }
  }, [contextoData]);

  const setContexto = async (obraId, clienteId = null) => {
    try {
      await base44.functions.invoke('setContextoAtual', {
        obra_atual_id: obraId,
        cliente_atual_id: clienteId
      });
      
      // Atualizar estado local imediatamente
      setObraAtual({ id: obraId });
      setClienteAtual(clienteId ? { id: clienteId } : null);
      
      return { obra_atual_id: obraId, cliente_atual_id: clienteId };
    } catch (error) {
      console.error('Erro ao atualizar contexto:', error);
      throw error;
    }
  };

  const publicarResumoFinal = async (obraId, dados) => {
    try {
      const resp = await base44.functions.invoke('publicarResumoFinalDaObra', {
        obra_id: obraId,
        ...dados
      });
      
      // Atualizar estado local
      if (obraAtual?.id === obraId) {
        setResumoObra(resp.data.resumo_obra);
      }
      
      return resp.data.resumo_obra;
    } catch (error) {
      console.error('Erro ao publicar resumo:', error);
      throw error;
    }
  };

  const value = {
    obraAtual,
    clienteAtual,
    resumoObra,
    setContexto,
    publicarResumoFinal,
    isLoading: loadingContexto
  };

  return (
    <GlobalContext.Provider value={value}>
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobalContext = () => {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('useGlobalContext deve ser usado dentro de GlobalContextProvider');
  }
  return context;
};
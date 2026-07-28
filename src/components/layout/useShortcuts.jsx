import { useState, useEffect, useCallback } from 'react';

export const useShortcuts = (userId) => {
  const [shortcuts, setShortcuts] = useState([]);
  const [loading, setLoading] = useState(true);

  const storageKey = userId ? `shortcuts:${userId}` : null;

  // Carregar atalhos do localStorage
  useEffect(() => {
    if (!userId || !storageKey) {
      setShortcuts([]);
      setLoading(false);
      return;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setShortcuts(Array.isArray(parsed) ? parsed : []);
      } else {
        setShortcuts([]);
      }
    } catch (error) {
      console.error('Erro ao carregar atalhos:', error);
      setShortcuts([]);
    } finally {
      setLoading(false);
    }
  }, [userId, storageKey]);

  // Adicionar atalho
  const addShortcut = useCallback((item) => {
    if (!storageKey) return;
    
    setShortcuts((prev) => {
      const exists = prev.some((s) => s.page === item.page);
      if (exists) return prev;

      const shortcutItem = {
        page: item.page,
        name: item.name,
        icon: item.icon
      };
      const newShortcuts = [...prev, shortcutItem];
      
      try {
        localStorage.setItem(storageKey, JSON.stringify(newShortcuts));
      } catch (error) {
        console.error('Erro ao salvar atalho:', error);
      }
      
      return newShortcuts;
    });
  }, [storageKey]);

  // Remover atalho
  const removeShortcut = useCallback((page) => {
    if (!storageKey) return;
    
    setShortcuts((prev) => {
      const newShortcuts = prev.filter((s) => s.page !== page);
      
      try {
        localStorage.setItem(storageKey, JSON.stringify(newShortcuts));
      } catch (error) {
        console.error('Erro ao remover atalho:', error);
      }
      
      return newShortcuts;
    });
  }, [storageKey]);

  // Reordenar atalhos
  const reorderShortcuts = useCallback((newOrder) => {
    if (!storageKey) return;
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(newOrder));
      setShortcuts(newOrder);
    } catch (error) {
      console.error('Erro ao reordenar atalhos:', error);
    }
  }, [storageKey]);

  // Verificar se um item é atalho
  const isShortcut = useCallback((page) => {
    return shortcuts.some((s) => s.page === page);
  }, [shortcuts]);

  return {
    shortcuts,
    loading,
    addShortcut,
    removeShortcut,
    reorderShortcuts,
    isShortcut
  };
};
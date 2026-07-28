import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function DiagnosticoAmbiente() {
  const [isOpen, setIsOpen] = useState(true);
  const [swCount, setSwCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState({});

  useEffect(() => {
    // Carregar informações de debug
    const info = {
      build_id: window.__BUILD_ID__ || `LOCAL-${Date.now()}`,
      is_preview: location.href.includes('/editor/preview') || location.href.includes('?preview'),
      has_text_fragment: location.hash.includes(':~:text='),
      has_hash: location.hash.length > 0,
      hash_content: location.hash.substring(0, 100),
      timestamp: new Date().toISOString(),
      url: location.href.substring(0, 100)
    };
    setDebugInfo(info);

    // Contar Service Workers
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        setSwCount(regs.length);
      });
    }
  }, []);

  const handleClearCache = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      
      // Limpar caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      toast.success('✓ Cache e Session limpos');
      setTimeout(() => location.reload(), 1000);
    } catch (e) {
      toast.error('Erro ao limpar: ' + e.message);
    }
  };

  const handleUnregisterSW = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
        toast.success(`✓ ${registrations.length} Service Worker(s) removido(s)`);
        setTimeout(() => location.reload(), 1000);
      }
    } catch (e) {
      toast.error('Erro ao unregister: ' + e.message);
    }
  };

  const handleCacheBustReload = () => {
    try {
      const cacheBustParam = `v=${Date.now()}`;
      const separator = location.href.includes('?') ? '&' : '?';
      const newUrl = `${location.href}${separator}${cacheBustParam}`.replace(/([&?])v=\d+&/, '$1');
      
      toast.success('✓ Recarregando com cache bust...');
      setTimeout(() => window.location.href = newUrl, 500);
    } catch (e) {
      toast.error('Erro: ' + e.message);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 p-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 shadow-lg"
        title="Abrir diagnóstico"
      >
        <AlertTriangle className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-gray-900 text-white rounded-lg shadow-2xl border border-purple-500 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-purple-300">Diagnóstico</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Info Grid */}
      <div className="space-y-2 text-xs font-mono mb-4 p-3 bg-gray-800 rounded">
        <div>
          <span className="text-gray-400">Build:</span>
          <span className="text-cyan-300 ml-2">{debugInfo.build_id}</span>
        </div>
        <div>
          <span className="text-gray-400">Preview:</span>
          <span className={`ml-2 ${debugInfo.is_preview ? 'text-orange-300' : 'text-green-300'}`}>
            {debugInfo.is_preview ? '✓ YES' : '✗ NO'}
          </span>
        </div>
        <div>
          <span className="text-gray-400">Text Fragment:</span>
          <span className={`ml-2 ${debugInfo.has_text_fragment ? 'text-red-300' : 'text-green-300'}`}>
            {debugInfo.has_text_fragment ? 'YES' : '✓ NO'}
          </span>
        </div>
        {debugInfo.has_hash && (
          <div>
            <span className="text-gray-400">Hash:</span>
            <span className="text-yellow-300 ml-2 break-all">{debugInfo.hash_content}</span>
          </div>
        )}
        <div>
          <span className="text-gray-400">Service Workers:</span>
          <span className={`ml-2 ${swCount > 0 ? 'text-orange-300' : 'text-green-300'}`}>
            {swCount} ativo(s)
          </span>
        </div>
        <div>
          <span className="text-gray-400">Timestamp:</span>
          <span className="text-gray-300 ml-2">{debugInfo.timestamp?.substring(0, 19)}</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="space-y-2">
        <Button
          onClick={handleCacheBustReload}
          size="sm"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Cache Bust Reload
        </Button>
        <Button
          onClick={handleClearCache}
          size="sm"
          variant="outline"
          className="w-full text-xs text-orange-300 border-orange-300 hover:bg-orange-900"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Clear Local Cache
        </Button>
        {swCount > 0 && (
          <Button
            onClick={handleUnregisterSW}
            size="sm"
            variant="outline"
            className="w-full text-xs text-red-300 border-red-300 hover:bg-red-900"
          >
            Unregister {swCount} SW
          </Button>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-500 mt-3 text-center">
        Dev-only • Feche esta janela para continuar
      </p>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Clock, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StatusSincronizacao({ pendentes = 0, erros = 0 }) {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (erros > 0) {
    return (
      <Badge className="bg-red-500/10 text-red-400 border-red-500/20 gap-2">
        <AlertCircle className="w-3 h-3" />
        {erros} {erros === 1 ? 'erro' : 'erros'}
      </Badge>
    );
  }

  if (pendentes > 0 && online) {
    return (
      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 gap-2">
        <RefreshCw className="w-3 h-3 animate-spin" />
        Sincronizando... ({pendentes})
      </Badge>
    );
  }

  if (pendentes > 0 && !online) {
    return (
      <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 gap-2">
        <Clock className="w-3 h-3" />
        {pendentes} {pendentes === 1 ? 'pendente' : 'pendentes'}
      </Badge>
    );
  }

  if (!online) {
    return (
      <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20 gap-2">
        <WifiOff className="w-3 h-3" />
        Offline
      </Badge>
    );
  }

  return (
    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-2">
      <CheckCircle2 className="w-3 h-3" />
      Online
    </Badge>
  );
}
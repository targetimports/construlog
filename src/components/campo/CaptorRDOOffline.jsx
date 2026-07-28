import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MapPin, Camera, Wifi, WifiOff, Upload, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { toast } from 'sonner';

export default function CaptorRDOOffline() {
  const [online, setOnline] = useState(navigator.onLine);
  const [gps, setGps] = useState(null);
  const [rdoPendente, setRdoPendente] = useState(null);

  // GPS
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setGps({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            timestamp: new Date().toISOString()
          });
        },
        error => console.log('GPS não disponível')
      );
    }

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sincronizar
  const sincronizarMutation = useMutation({
    mutationFn: async () => {
      const pendentes = JSON.parse(localStorage.getItem('rdo_offline_pendentes') || '[]');
      
      for (const rdo of pendentes) {
        await base44.entities.DiarioObra.create({
          ...rdo,
          gps_latitude: gps?.latitude,
          gps_longitude: gps?.longitude,
          data_sincronizacao: new Date().toISOString()
        });
      }

      localStorage.removeItem('rdo_offline_pendentes');
      return pendentes.length;
    },
    onSuccess: (quantidade) => {
      toast.success(`${quantidade} RDO(s) sincronizado(s)`);
      setRdoPendente(null);
    }
  });

  useEffect(() => {
    const pendentes = JSON.parse(localStorage.getItem('rdo_offline_pendentes') || '[]');
    setRdoPendente(pendentes.length > 0 ? pendentes.length : null);
  }, []);

  return (
    <Card className={online ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Status Campo</span>
          {online ? (
            <Wifi className="w-4 h-4 text-green-600" />
          ) : (
            <WifiOff className="w-4 h-4 text-yellow-600" />
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Status */}
        <div className="text-xs space-y-1">
          <p className={online ? 'text-green-900' : 'text-yellow-900'}>
            {online ? '✓ Conectado' : 'Modo Offline'}
          </p>
          {gps && (
            <p className="text-gray-700 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {gps.latitude.toFixed(4)}, {gps.longitude.toFixed(4)}
            </p>
          )}
        </div>

        {/* Pendentes */}
        {rdoPendente && rdoPendente > 0 && (
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <div className="ml-2">
              <p className="text-xs text-blue-900">
                {rdoPendente} RDO(s) aguardando sincronização
              </p>
            </div>
          </Alert>
        )}

        {/* Botão sincronizar */}
        {rdoPendente && rdoPendente > 0 && online && (
          <Button
            onClick={() => sincronizarMutation.mutate()}
            disabled={sincronizarMutation.isPending}
            size="sm"
            className="w-full gap-2 bg-blue-600"
          >
            <Upload className="w-4 h-4" />
            Sincronizar Agora
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
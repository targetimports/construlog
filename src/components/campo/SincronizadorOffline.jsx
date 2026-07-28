import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Wifi, WifiOff, RotateCw, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function SincronizadorOffline() {
  const [online, setOnline] = useState(navigator.onLine);
  const [medicacoesPendentes, setMedicacoesPendentes] = useState([]);
  const [resultado, setResultado] = useState(null);

  // Monitorar conexão
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      toast.success('Conectado à internet');
    };
    const handleOffline = () => {
      setOnline(false);
      toast.info('Sem conexão - modo offline ativado');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Carregar medições pendentes do localStorage
  useEffect(() => {
    const pendentes = JSON.parse(localStorage.getItem('medicacoes_pendentes') || '[]');
    setMedicacoesPendentes(pendentes);
  }, []);

  const sincronizarMutation = useMutation({
    mutationFn: async () => {
      if (medicacoesPendentes.length === 0) {
        throw new Error('Nenhuma medição pendente');
      }

      const res = await base44.functions.invoke('sincronizacaoMedicaoOffline', {
        medicacoesPendentes
      });
      return res.data;
    },
    onSuccess: (data) => {
      setResultado(data);
      
      if (data.resultados.sucesso.length > 0) {
        localStorage.removeItem('medicacoes_pendentes');
        setMedicacoesPendentes([]);
        toast.success(`${data.resultados.sucesso.length} medições sincronizadas`);
      }

      if (data.resultados.erros.length > 0) {
        toast.error(`${data.resultados.erros.length} erro(s) na sincronização`);
      }
    },
    onError: (error) => {
      toast.error('Erro ao sincronizar: ' + error.message);
    }
  });

  const handleSincronizar = () => {
    if (!online) {
      toast.error('Sem conexão à internet');
      return;
    }
    sincronizarMutation.mutate();
  };

  return (
    <div className="space-y-4">
      {/* Status de Conexão */}
      <Card className={online ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
        <CardContent className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {online ? (
              <Wifi className="w-5 h-5 text-green-600" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-600" />
            )}
            <span className={online ? 'text-green-900 font-semibold' : 'text-red-900 font-semibold'}>
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
          {!online && <Badge className="bg-orange-100 text-orange-800">Modo Local</Badge>}
        </CardContent>
      </Card>

      {/* Medições Pendentes */}
      {medicacoesPendentes.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              {medicacoesPendentes.length} medição(ões) pendente(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-48 overflow-y-auto">
            {medicacoesPendentes.map((med, idx) => (
              <div key={idx} className="p-2 bg-white rounded-lg text-sm border border-blue-200">
                <div className="font-semibold text-blue-900">{med.numero}</div>
                <div className="text-xs text-blue-700">{med.obra_id}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Botão Sincronizar */}
      <Button
        onClick={handleSincronizar}
        disabled={!online || medicacoesPendentes.length === 0 || sincronizarMutation.isPending}
        className="w-full gap-2"
      >
        <RotateCw className={`w-4 h-4 ${sincronizarMutation.isPending ? 'animate-spin' : ''}`} />
        {sincronizarMutation.isPending ? 'Sincronizando...' : 'Sincronizar Agora'}
      </Button>

      {/* Resultado */}
      {resultado && (
        <Card className={resultado.sucesso ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              {resultado.sucesso ? <Check className="w-5 h-5 text-green-600" /> : <X className="w-5 h-5 text-orange-600" />}
              {resultado.sucesso ? 'Sincronização Bem-sucedida' : 'Sincronização Parcial'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Sucesso:</span>
              <Badge className="bg-green-100 text-green-800">{resultado.resultados.sucesso.length}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Erros:</span>
              <Badge className="bg-red-100 text-red-800">{resultado.resultados.erros.length}</Badge>
            </div>
            {resultado.resultados.erros.map((err, i) => (
              <Alert key={i} className="bg-red-50 border-red-200 text-xs">
                <span className="text-red-900">{err.medicacao}: {err.motivo}</span>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
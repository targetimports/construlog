import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MapPin, Zap, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { toast } from 'sonner';

export default function MedicaoAppEnriquecida({ medicaoId, obraId, orcamentoId }) {
  const [medicao, setMedicao] = useState(null);
  const [gps, setGps] = useState(null);
  const [validacao, setValidacao] = useState(null);
  const [loading, setLoading] = useState(false);

  // Capturar GPS
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGps({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: new Date().toISOString()
          });
        },
        (error) => console.log('GPS não disponível:', error)
      );
    }
  }, []);

  // Validar medição
  const validarMutation = useMutation({
    mutationFn: async (dados) => {
      const res = await base44.functions.invoke('validadorMedicaoApp', {
        medicaoData: dados,
        orcamentoId
      });
      return res.data;
    },
    onSuccess: (data) => {
      setValidacao(data);
      if (!data.valido) {
        toast.error(`${data.erros.length} erro(s) encontrado(s)`);
      }
    }
  });

  const handleValidar = () => {
    if (medicao) {
      validarMutation.mutate(medicao);
    }
  };

  const handleSalvar = async () => {
    if (!validacao?.valido) {
      toast.error('Resolva os erros antes de salvar');
      return;
    }

    try {
      setLoading(true);
      const dados = {
        ...medicao,
        gps_latitude: gps?.latitude,
        gps_longitude: gps?.longitude,
        timestamp_gps: gps?.timestamp
      };

      if (medicaoId) {
        await base44.entities.Medicao.update(medicaoId, dados);
        toast.success('Medição atualizada');
      } else {
        await base44.entities.Medicao.create(dados);
        toast.success('Medição salva');
      }
    } catch (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!medicao) return <p className="p-4">Carregando...</p>;

  return (
    <div className="space-y-4 p-4">
      {/* GPS Info */}
      {gps && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-3 flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span className="text-blue-900">
              {gps.latitude.toFixed(4)}, {gps.longitude.toFixed(4)}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Sugestões de Percentual */}
      {validacao?.sugestoes && Object.keys(validacao.sugestoes).length > 0 && (
        <Alert className="bg-amber-50 border-amber-200">
          <Zap className="h-4 w-4 text-amber-600" />
          <div className="ml-2">
            <p className="font-medium text-amber-900 mb-2">Sugestões de Percentual:</p>
            <div className="space-y-1 text-sm">
              {Object.entries(validacao.sugestoes).map(([itemId, sug]) => (
                <div key={itemId} className="flex justify-between text-amber-800">
                  <span>Item:</span>
                  <Badge className="bg-amber-100 text-amber-900">{sug.percentual_sugerido}%</Badge>
                </div>
              ))}
            </div>
          </div>
        </Alert>
      )}

      {/* Status de Validação */}
      {validacao && (
        <div className="space-y-2">
          {validacao.erros.length > 0 && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <div className="ml-2">
                <p className="font-medium text-red-900">Erros:</p>
                {validacao.erros.map((err, i) => (
                  <p key={i} className="text-sm text-red-700">• {err}</p>
                ))}
              </div>
            </Alert>
          )}

          {validacao.avisos.length > 0 && (
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <div className="ml-2">
                <p className="font-medium text-yellow-900">Avisos:</p>
                {validacao.avisos.map((aviso, i) => (
                  <p key={i} className="text-sm text-yellow-700">• {aviso}</p>
                ))}
              </div>
            </Alert>
          )}

          {validacao.valido && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="ml-2 text-green-900 font-medium">✓ Medição validada com sucesso</p>
            </Alert>
          )}

          {/* Totais */}
          <Card className="bg-gray-50">
            <CardContent className="py-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Medido:</span>
                <span className="font-semibold">R$ {validacao.totais.medido.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Descontos:</span>
                <span className="text-red-600">- R$ {validacao.totais.descontos.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Retenções:</span>
                <span className="text-red-600">- R$ {validacao.totais.retencoes.toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Valor Líquido:</span>
                <span className="text-green-600">R$ {validacao.totais.liquido.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Botões */}
      <div className="flex gap-2">
        <Button
          onClick={handleValidar}
          disabled={validarMutation.isPending}
          className="flex-1"
          variant="outline"
        >
          Validar
        </Button>
        <Button
          onClick={handleSalvar}
          disabled={!validacao?.valido || loading}
          className="flex-1"
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}
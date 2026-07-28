import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { toast } from 'sonner';

export default function SincronizadorMedicaoDiario({ obraId, diarioData }) {
  const [medicoesPendentes, setMedicoesPendentes] = useState([]);
  const [resultado, setResultado] = useState(null);

  // Buscar medições não vinculadas da mesma data
  useEffect(() => {
    const buscarMedicoes = async () => {
      try {
        if (!diarioData?.data) return;

        const medicoes = await base44.entities.Medicao.filter({
          obra_id: obraId,
          periodo_fim: diarioData.data,
          status: 'aprovada'
        });

        const naoVinculadas = medicoes.filter(m => !m.diario_vinculado_id);
        setMedicoesPendentes(naoVinculadas);
      } catch (error) {
        console.log('Sem medições encontradas');
      }
    };

    buscarMedicoes();
  }, [obraId, diarioData?.data]);

  // Sincronizar
  const sincronizarMutation = useMutation({
    mutationFn: async (medicoes) => {
      const atualizacoes = medicoes.map(med => ({
        id: med.id,
        diario_vinculado_id: diarioData.id
      }));

      const resultados = {
        sucesso: [],
        erros: []
      };

      for (const update of atualizacoes) {
        try {
          await base44.entities.Medicao.update(update.id, {
            diario_vinculado_id: update.diario_vinculado_id
          });
          resultados.sucesso.push(update.id);
        } catch (error) {
          resultados.erros.push({ id: update.id, erro: error.message });
        }
      }

      return resultados;
    },
    onSuccess: (data) => {
      setResultado(data);
      if (data.sucesso.length > 0) {
        setMedicoesPendentes([]);
        toast.success(`${data.sucesso.length} medição(ões) vinculada(s)`);
      }
    }
  });

  if (medicoesPendentes.length === 0 && !resultado) {
    return null;
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-blue-600" />
          Sincronizar Medições
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {!resultado ? (
          <>
            <p className="text-sm text-blue-900">
              {medicoesPendentes.length} medição(ões) da mesma data encontrada(s)
            </p>

            <div className="space-y-2 max-h-32 overflow-y-auto">
              {medicoesPendentes.map(med => (
                <div key={med.id} className="text-xs p-2 bg-white rounded-lg border border-blue-200">
                  <p className="font-semibold text-blue-900">Medição #{med.numero}</p>
                  <p className="text-gray-600">{med.itens?.length || 0} itens</p>
                </div>
              ))}
            </div>

            <Button
              onClick={() => sincronizarMutation.mutate(medicoesPendentes)}
              disabled={sincronizarMutation.isPending}
              className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              {sincronizarMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Vincular Medições
            </Button>
          </>
        ) : (
          <>
            <Alert className={resultado.sucesso.length > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
              <CheckCircle className={`h-4 w-4 ${resultado.sucesso.length > 0 ? 'text-green-600' : 'text-red-600'}`} />
              <div className="ml-2">
                <p className={`font-medium ${resultado.sucesso.length > 0 ? 'text-green-900' : 'text-red-900'}`}>
                  {resultado.sucesso.length} vinculada(s) {resultado.erros.length > 0 && `/ ${resultado.erros.length} erro(s)`}
                </p>
              </div>
            </Alert>

            <Button
              onClick={() => {
                setResultado(null);
                setMedicoesPendentes([]);
              }}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Fechar
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
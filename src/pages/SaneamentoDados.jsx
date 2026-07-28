import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ListSkeleton } from '@/components/shared/Skeletons';

export default function SaneamentoDados() {
  const [registrosOrfaos, setRegistrosOrfaos] = useState({});
  const [carregando, setCarregando] = useState(true);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity
  });

  useEffect(() => {
    if (!['admin', 'programador'].includes(user?.role) && user?.acesso_global !== true) {
      setCarregando(false);
      return;
    }

    buscarOrfaos();
  }, [user]);

  const buscarOrfaos = async () => {
    try {
      setCarregando(true);
      const response = await base44.functions.invoke('buscarRegistrosOrfaos');
      setRegistrosOrfaos(response.data?.resultados || []);
    } catch (error) {
      console.error('Erro ao buscar órfãos:', error);
      setRegistrosOrfaos([]);
    } finally {
      setCarregando(false);
    }
  };

  if (!['admin', 'programador'].includes(user?.role) && user?.acesso_global !== true) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Esta página é restrita a administradores.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Saneamento de Dados</h1>
        <Button onClick={buscarOrfaos} disabled={carregando} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          {carregando ? 'Carregando...' : 'Atualizar'}
        </Button>
      </div>

      {carregando ? (
        <ListSkeleton rows={6} />
      ) : registrosOrfaos.length === 0 ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6 flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-green-900">Sistema íntegro</h3>
              <p className="text-sm text-green-800">Nenhum registro órfão encontrado. Todas as operações estão vinculadas a uma obra.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Encontrados {registrosOrfaos.reduce((sum, r) => sum + r.orfaos.length, 0)} registros sem obra vinculada. Corrija manualmente ou entre em contato com o suporte.
            </AlertDescription>
          </Alert>

          {registrosOrfaos.map(categoria => (
            <Card key={categoria.entidade}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  {categoria.entidade}
                  <span className="text-sm font-normal text-gray-600">
                    ({categoria.orfaos.length} órfãos de {categoria.total} registros)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {categoria.orfaos.map(orfao => (
                    <div key={orfao.id} className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900">{orfao.descricao}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            ID: {orfao.id} • Criado: {new Date(orfao.dataCriacao).toLocaleDateString('pt-BR')} por {orfao.criadoPor}
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => console.log(`Editar ${orfao.id}`)}
                          className="ml-4 flex-shrink-0"
                        >
                          Corrigir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
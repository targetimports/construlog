import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function SemPermissao() {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const [perfilInfo, setPerfilInfo] = useState(null);
  const [perfisPermitidos, setPerfisPermitidos] = useState([]);

  useEffect(() => {
    if (user) {
      setPerfilInfo(user.perfil_sistema || user.cargo || 'Sem perfil definido');
      
      // Obter perfis permitidos da página (se disponível na navegação)
      const permitidos = sessionStorage.getItem('perfis_permitidos');
      if (permitidos) {
        setPerfisPermitidos(JSON.parse(permitidos));
      }
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl">Sem Permissão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-gray-600">
            Você não tem permissão para acessar esta página.
          </p>
          
          {perfilInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p className="text-gray-700">
                <strong>Seu perfil:</strong> {perfilInfo}
              </p>
              {perfisPermitidos.length > 0 && (
                <p className="text-gray-700 mt-2">
                  <strong>Perfis permitidos:</strong> {perfisPermitidos.join(', ')}
                </p>
              )}
            </div>
          )}
          
          <p className="text-center text-sm text-gray-500">
            Se você acredita que deveria ter acesso, entre em contato com o administrador do sistema.
          </p>
          <div className="flex flex-col gap-2 pt-4">
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Link to={createPageUrl('Dashboard')} className="w-full">
              <Button className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Ir para Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Home, AlertTriangle, HelpCircle } from 'lucide-react';

export default function SemPermissaoMelhorado({ role, requiredPermission, routePath, availableRoutes }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const firstAllowedRoute = availableRoutes?.[0] || 'dashboard';
  const reason = searchParams.get('reason') || 'Acesso não autorizado para este perfil';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md border-red-200 bg-white shadow-lg">
        <CardHeader className="bg-red-50 border-b border-red-200">
          <div className="flex items-center gap-3">
            <Lock className="h-6 w-6 text-red-600" />
            <CardTitle className="text-red-700">Acesso Negado</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Info Debug */}
          <Alert className="bg-blue-50 border-blue-200">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-700">
              <div className="font-semibold">Informações de Acesso:</div>
              <ul className="text-xs mt-2 space-y-1">
                <li><strong>Seu Perfil:</strong> {role}</li>
                <li><strong>Permissão Necessária:</strong> {requiredPermission}</li>
                <li><strong>Rota Solicitada:</strong> {routePath}</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Motivo */}
          <div className="bg-gray-50 p-4 rounded border border-gray-200">
            <p className="text-sm text-gray-700">
              <strong>Motivo:</strong> {reason}
            </p>
          </div>

          {/* Permissões Disponíveis */}
          {availableRoutes && availableRoutes.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                Você tem acesso a:
              </p>
              <div className="space-y-2">
                {availableRoutes.map(route => (
                  <Button
                    key={route}
                    variant="outline"
                    className="w-full justify-start text-left"
                    onClick={() => navigate(`/${route}`)}
                  >
                    → {formatRouteName(route)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="space-y-3 pt-4 border-t border-gray-200">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => navigate(firstAllowedRoute)}
            >
              <Home className="h-4 w-4 mr-2" />
              Ir para {formatRouteName(firstAllowedRoute)}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/')}
            >
              Voltar ao Dashboard
            </Button>

            {/* TODO: Implementar "Solicitar Acesso" */}
            <Button
              variant="ghost"
              className="w-full text-sm"
              onClick={() => {
                // Criar ticket/notificação para admin
                console.log('Solicitar acesso para:', requiredPermission);
                alert('Sua solicitação será enviada ao administrador');
              }}
            >
              Solicitar Acesso
            </Button>
          </div>

          {/* Footer Debug */}
          <div className="text-xs text-gray-400 border-t pt-4">
            <p>Erro ID: {new Date().getTime()}</p>
            <p>Se o problema persiste, entre em contato com o administrador.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatRouteName(route) {
  return route
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Home, AlertTriangle } from 'lucide-react';

/**
 * Tela "Sem Permissão" - Exibe:
 * - Perfil do usuário
 * - Permissão necessária (exata)
 * - Botão para voltar ao dashboard
 */
export default function SemPermissao({ 
  userRole, 
  requiredPermissionKey, 
  availablePermissions = [],
  debug = {}
}) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
      <Card className="w-full max-w-md border-red-300 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-t">
          <div className="flex items-center gap-3">
            <Lock className="h-6 w-6" />
            <CardTitle>Acesso Negado</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-6">
          {/* Alert com detalhes DEBUG */}
          <Alert className="bg-red-50 border-red-200">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-sm text-red-700">
              <div className="font-semibold mb-3">Você não tem permissão para acessar esta área.</div>
              <ul className="space-y-2 text-xs font-mono">
                <li><strong>Seu Perfil:</strong> <br/><code className="bg-white px-1 py-0.5 rounded border">{userRole}</code></li>
                <li><strong>Permissão Necessária:</strong> <br/><code className="bg-white px-1 py-0.5 rounded border text-red-600 font-bold">{requiredPermissionKey}</code></li>
                <li><strong>RBAC Ready:</strong> <code className="bg-white px-1 py-0.5 rounded border">{debug.rbacReady ? '✓ Sim' : '✗ Não'}</code></li>
                {debug.baseCount !== undefined && (
                  <li><strong>Base Perms:</strong> <code className="bg-white px-1 py-0.5 rounded border">{debug.baseCount}</code></li>
                )}
                {debug.overrideEnabled !== undefined && (
                  <li><strong>Overrides:</strong> <code className="bg-white px-1 py-0.5 rounded border">{debug.overrideEnabled ? `✓ Enabled (${debug.overrideCount})` : '✗ Disabled'}</code></li>
                )}
              </ul>
            </AlertDescription>
          </Alert>

          {/* Permissões disponíveis */}
          {availablePermissions.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-900 mb-2">Permissões Disponíveis:</p>
              <div className="flex flex-wrap gap-1">
                {availablePermissions.slice(0, 5).map(p => (
                  <span key={p} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {p}
                  </span>
                ))}
                {availablePermissions.length > 5 && (
                  <span className="text-xs text-blue-600">+{availablePermissions.length - 5}</span>
                )}
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="space-y-3">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => navigate('/dashboard')}
            >
              <Home className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate(-1)}
            >
              Voltar Anterior
            </Button>
          </div>

          {/* Debug Info */}
          <div className="text-xs text-gray-500 border-t pt-3 space-y-1">
            <p>Se acredita que isso é um erro, entre em contato com o administrador.</p>
            <p className="mt-2"><strong>Debug:</strong> Verifique o console (F12) para logs [RBAC]</p>
            <p className="mt-1 font-mono bg-gray-100 p-1 rounded select-all">
              [RBAC] role={userRole} required={requiredPermissionKey} has=false
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
/**
 * AJUSTES GLOBAIS (ADMIN_CONFIG)
 *
 * Central de administração — apenas admin/programador.
 * Mantém SÓ o que é único (telas órfãs, sem entrada no menu lateral). Tudo que já
 * tem item próprio no menu (Config. Empresa/Sistema, Auditoria, Produção, Snapshots,
 * Saúde do Sistema, Relatórios Agendados, Usuários) foi removido daqui para não duplicar.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import RouteGuardFinalV2 from '../components/auth/RouteGuardFinalV2';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, ChevronRight, UserCheck, ShieldCheck } from 'lucide-react';

// Apenas telas que NÃO estão no menu lateral e não são cobertas por outra tela.
const ITENS = [
  {
    titulo: 'Aprovação & Perfil Padrão de Usuários',
    descricao: 'Aprovar novos cadastros pendentes e definir o perfil padrão aplicado a quem entra (recursos que a tela Usuários do menu não cobre).',
    icon: UserCheck,
    cor: 'blue',
    page: 'GestaoUsuarios',
  },
  {
    titulo: 'Permissões & Menus por Perfil',
    descricao: 'Controlar quais menus e ações cada perfil de acesso enxerga no sistema.',
    icon: ShieldCheck,
    cor: 'violet',
    page: 'PermissoesUsuarioMenus',
  },
];

const COR = {
  blue: 'bg-blue-50 text-blue-600',
  violet: 'bg-violet-50 text-violet-600',
};

export default function AjustesGlobais() {
  return (
    <RouteGuardFinalV2 requiredPermissionKey="ADMIN_CONFIG">
      <AjustesGlobaisContent />
    </RouteGuardFinalV2>
  );
}

function AjustesGlobaisContent() {
  const navigate = useNavigate();
  const ir = (page) => navigate(createPageUrl(page));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ajustes Globais</h1>
        <p className="text-gray-500 mt-1">Ferramentas de administração que não têm entrada própria no menu</p>
      </div>

      {/* Aviso */}
      <Alert className="border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          As ações aqui afetam <strong>todos os usuários</strong> do sistema. Use com cuidado.
        </AlertDescription>
      </Alert>

      {/* Itens únicos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ITENS.map((item) => (
          <Card
            key={item.page}
            role="button"
            tabIndex={0}
            onClick={() => ir(item.page)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(item.page); } }}
            className="group cursor-pointer border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all p-5"
          >
            <div className="flex items-start gap-4">
              <div className={`p-2.5 rounded-xl shrink-0 ${COR[item.cor]}`}>
                <item.icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-900">{item.titulo}</h3>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
                <p className="text-sm text-gray-500 mt-1">{item.descricao}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

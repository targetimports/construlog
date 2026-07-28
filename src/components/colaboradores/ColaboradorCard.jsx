import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, Phone, Building2, Briefcase, LogIn, Edit, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const statusConfig = {
  ativo: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  ferias: { label: 'Férias', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  afastado: { label: 'Afastado', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  desligado: { label: 'Desligado', color: 'bg-red-100 text-red-700 border-red-200' }
};

export default function ColaboradorCard({ colaborador, obras, onEdit, onDelete }) {
  const status = statusConfig[colaborador.status] || statusConfig.ativo;
  const initials = colaborador.nome?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const obraAtual = obras?.find(o => o.id === colaborador.obra_atual);
  const obrasVinculadas = colaborador.obras_vinculadas || [];

  // Buscar equipes do colaborador
  const { data: equipes = [] } = useQuery({
    queryKey: ['equipes'],
    queryFn: () => base44.entities.Equipe.list()
  });

  // Verifica se o colaborador está vinculado a alguma equipe
  const equipesVinculadas = colaborador.equipes_vinculadas || [];
  const equipeDoColaborador = equipesVinculadas.length > 0 
    ? equipes.find(e => equipesVinculadas.includes(e.id))
    : null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600">
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-gray-900">{colaborador.nome}</h3>
            <p className="text-sm text-gray-600">{colaborador.cargo}</p>
          </div>
        </div>
        <Badge className={cn("border", status.color)}>
          {status.label}
        </Badge>
      </div>

      {/* Informações Básicas */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <Building2 className="w-4 h-4" />
          <span>{colaborador.departamento}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Users className="w-4 h-4" />
          {equipeDoColaborador ? (
            <span className="font-medium text-blue-600">{equipeDoColaborador.nome}</span>
          ) : (
            <span className="text-gray-400 italic">Sem equipe definida</span>
          )}
        </div>
        {colaborador.email && (
          <div className="flex items-center gap-2 text-gray-600">
            <Mail className="w-4 h-4" />
            <span className="truncate">{colaborador.email}</span>
          </div>
        )}
        {colaborador.telefone && (
          <div className="flex items-center gap-2 text-gray-600">
            <Phone className="w-4 h-4" />
            <span>{colaborador.telefone}</span>
          </div>
        )}
      </div>

      {/* Acesso ao Sistema */}
      <div className="border-t pt-3">
        {colaborador.user_email ? (
          <div className="flex items-center gap-2 text-xs bg-green-50 rounded p-2 border border-green-200">
            <LogIn className="w-3 h-3 text-green-600" />
            <div className="flex-1">
              <p className="font-medium text-green-900">Com acesso ao sistema</p>
              <p className="text-green-700 text-xs">{colaborador.user_email}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs bg-gray-50 rounded p-2 border border-gray-200">
            <LogIn className="w-3 h-3 text-gray-400" />
            <p className="text-gray-600">Sem acesso ao sistema</p>
          </div>
        )}
      </div>

      {/* Obras Vinculadas */}
      {obrasVinculadas.length > 0 && (
        <div className="border-t pt-3">
          <p className="text-xs font-semibold text-gray-700 mb-2">
            <Briefcase className="w-3 h-3 inline mr-1" />
            {obrasVinculadas.length} obra(s) vinculada(s)
          </p>
          <div className="space-y-1">
            {obrasVinculadas.slice(0, 2).map((obra, idx) => (
              <div key={idx} className="text-xs bg-gray-50 rounded p-1.5">
                <p className="font-medium text-gray-900">{obras?.find(o => o.id === obra.obra_id)?.nome}</p>
                {obra.funcao_na_obra && (
                  <p className="text-gray-600">{obra.funcao_na_obra}</p>
                )}
                <Badge variant="outline" className="text-xs mt-1">
                  {obra.status}
                </Badge>
              </div>
            ))}
            {obrasVinculadas.length > 2 && (
              <p className="text-xs text-gray-500 text-center py-1">+{obrasVinculadas.length - 2} mais</p>
            )}
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-2 pt-3 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(colaborador)}
          className="flex-1"
        >
          <Edit className="w-4 h-4 mr-1" />
          Editar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete(colaborador)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
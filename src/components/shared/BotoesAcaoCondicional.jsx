import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, CheckCircle } from 'lucide-react';
import usePermissoesAcao from '../auth/usePermissoesAcao';

/**
 * Grupo de botões de ação que respeitam permissões
 * Renderiza automaticamente Criar/Solicitar, Editar, Excluir, Aprovar baseado em permissões
 */
export default function BotoesAcaoCondicional({
  modulo,
  textoBase = 'Item',
  onCriar,
  onSolicitar,
  onEditar,
  onExcluir,
  onAprovar,
  itemSelecionado = null,
  className = ''
}) {
  const permissoes = usePermissoesAcao(modulo);

  return (
    <div className={`flex gap-2 flex-wrap ${className}`}>
      {/* Botão Criar/Solicitar */}
      {permissoes.pode_criar && onCriar && (
        <Button onClick={onCriar}>
          <Plus className="h-4 w-4 mr-2" />
          {permissoes.getTextoBotao(textoBase)}
        </Button>
      )}
      
      {permissoes.pode_solicitar && onSolicitar && (
        <Button onClick={onSolicitar} variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Solicitar {textoBase}
        </Button>
      )}

      {/* Botão Editar (apenas se houver item selecionado) */}
      {permissoes.pode_editar && onEditar && itemSelecionado && (
        <Button onClick={onEditar} variant="outline">
          <Edit className="h-4 w-4 mr-2" />
          Editar
        </Button>
      )}

      {/* Botão Excluir (apenas se houver item selecionado) */}
      {permissoes.pode_excluir && onExcluir && itemSelecionado && (
        <Button onClick={onExcluir} variant="destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Excluir
        </Button>
      )}

      {/* Botão Aprovar (apenas se houver item selecionado e estiver pendente) */}
      {permissoes.pode_aprovar && onAprovar && itemSelecionado && (
        <Button 
          onClick={onAprovar} 
          variant="default"
          className="bg-green-600 hover:bg-green-700"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Aprovar
        </Button>
      )}
    </div>
  );
}
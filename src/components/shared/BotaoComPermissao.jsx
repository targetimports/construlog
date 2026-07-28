import React from 'react';
import { Button } from '@/components/ui/button';
import usePermissoesAcao from '../auth/usePermissoesAcao';

/**
 * Botão que respeita permissões do usuário
 * @param {string} modulo - Módulo do sistema
 * @param {string} tipoAcao - Tipo de ação: 'criar', 'editar', 'excluir', 'aprovar'
 * @param {function} onClick - Callback ao clicar
 * @param {string} textoBase - Texto base para o botão (ex: "Requisição")
 * @param {object} props - Outras props do Button
 */
export default function BotaoComPermissao({ 
  modulo, 
  tipoAcao, 
  onClick, 
  textoBase,
  children,
  ...props 
}) {
  const permissoes = usePermissoesAcao(modulo);

  // Verificar permissão por tipo de ação
  const temPermissao = () => {
    switch (tipoAcao) {
      case 'criar':
        return permissoes.pode_criar;
      case 'solicitar':
        return permissoes.pode_solicitar;
      case 'editar':
        return permissoes.pode_editar;
      case 'excluir':
        return permissoes.pode_excluir;
      case 'aprovar':
        return permissoes.pode_aprovar;
      default:
        return false;
    }
  };

  // Se não tem permissão, não renderiza
  if (!temPermissao()) {
    return null;
  }

  // Determinar texto do botão
  const getTexto = () => {
    if (children) return children;
    
    if (tipoAcao === 'criar' && textoBase) {
      return permissoes.getTextoBotao(textoBase);
    }
    
    if (tipoAcao === 'solicitar' && textoBase) {
      return `Solicitar ${textoBase}`;
    }
    
    const textos = {
      criar: 'Criar',
      editar: 'Editar',
      excluir: 'Excluir',
      aprovar: 'Aprovar',
      solicitar: 'Solicitar'
    };
    
    return textos[tipoAcao] || 'Ação';
  };

  return (
    <Button onClick={onClick} {...props}>
      {getTexto()}
    </Button>
  );
}
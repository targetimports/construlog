import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getPermissoesAcao, podeSolicitar, getTextoBotaoAcao } from './permissoesAcao';
import { mapearPerfilPorCargo } from './mapearPerfilPorCargo';

/**
 * Hook para obter permissões de ação do usuário atual
 * @param {string} modulo - Módulo do sistema
 * @returns {object} Permissões e helpers
 */
export default function usePermissoesAcao(modulo) {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  // Determinar perfil
  let perfil = user?.perfil_sistema || user?.role;
  if (!perfil && user?.cargo) {
    perfil = mapearPerfilPorCargo(user.cargo);
  }
  if (!perfil) perfil = 'campo';

  // Obter permissões
  const permissoes = getPermissoesAcao(perfil, modulo);
  
  // Helpers
  const canSolicitar = podeSolicitar(perfil, modulo);
  const getTextoBotao = (textoBase) => getTextoBotaoAcao(perfil, modulo, textoBase);
  
  // Modo de ação (criar direto ou solicitar)
  const modoAcao = permissoes.pode_criar ? 'criar' : canSolicitar ? 'solicitar' : null;

  return {
    perfil,
    user,
    ...permissoes,
    pode_solicitar: canSolicitar,
    modo_acao: modoAcao,
    getTextoBotao,
    // Helpers específicos
    mostrarBotaoCriar: permissoes.pode_criar,
    mostrarBotaoSolicitar: canSolicitar,
    mostrarBotaoEditar: permissoes.pode_editar,
    mostrarBotaoExcluir: permissoes.pode_excluir,
    mostrarBotaoAprovar: permissoes.pode_aprovar
  };
}
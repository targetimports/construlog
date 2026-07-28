/**
 * Mapeamento automático de cargo → perfil do sistema
 * Garante que todo usuário tenha um perfil válido
 */

export const MAPA_CARGO_PERFIL = {
  // Engenharia
  'engenheiro civil': 'engenharia',
  'engenheiro': 'engenharia',
  'arquiteto': 'engenharia',
  'gerente de projetos': 'engenharia',
  'orçamentista': 'engenharia',
  
  // Campo
  'mestre de obras': 'campo',
  'mestre': 'campo',
  'encarregado': 'campo',
  'fiscal de obra': 'campo',
  
  // Compras
  'comprador': 'compras',
  'gestor de compras': 'compras',
  
  // Almoxarifado
  'almoxarife': 'almoxarifado',
  'estoquista': 'almoxarifado',
  
  // Logística
  'motorista': 'motorista',
  'gestor de logística': 'logistica',
  'coordenador de logística': 'logistica',
  
  // Financeiro
  'financeiro': 'financeiro',
  'administrativo': 'financeiro',
  'contador': 'financeiro',
  'analista financeiro': 'financeiro',
  
  // Diretoria
  'diretor': 'diretoria',
  'gerente geral': 'diretoria',
  'executivo': 'diretoria'
};

/**
 * Mapeia cargo para perfil do sistema
 * @param {string} cargo - Cargo do usuário
 * @returns {string} Perfil do sistema
 */
export function mapearPerfilPorCargo(cargo) {
  if (!cargo) return 'campo'; // Default seguro
  
  const cargoNormalizado = cargo.toLowerCase().trim();
  
  // Buscar no mapa
  const perfil = MAPA_CARGO_PERFIL[cargoNormalizado];
  
  // Se não encontrar, tentar por palavra-chave
  if (!perfil) {
    if (cargoNormalizado.includes('engenheiro') || cargoNormalizado.includes('arquiteto')) {
      return 'engenharia';
    }
    if (cargoNormalizado.includes('mestre') || cargoNormalizado.includes('encarregado')) {
      return 'campo';
    }
    if (cargoNormalizado.includes('compra')) {
      return 'compras';
    }
    if (cargoNormalizado.includes('almoxarife') || cargoNormalizado.includes('estoque')) {
      return 'almoxarifado';
    }
    if (cargoNormalizado.includes('motorista')) {
      return 'motorista';
    }
    if (cargoNormalizado.includes('logística') || cargoNormalizado.includes('logistica')) {
      return 'logistica';
    }
    if (cargoNormalizado.includes('financeiro') || cargoNormalizado.includes('contador')) {
      return 'financeiro';
    }
    if (cargoNormalizado.includes('diretor') || cargoNormalizado.includes('gerente')) {
      return 'diretoria';
    }
  }
  
  return perfil || 'campo'; // Fallback para campo
}

/**
 * Retorna perfil formatado para exibição
 */
export function formatarPerfil(perfil) {
  const nomes = {
    admin: 'Administrador',
    engenharia: 'Engenharia',
    compras: 'Compras',
    almoxarifado: 'Almoxarifado',
    logistica: 'Logística',
    financeiro: 'Financeiro',
    diretoria: 'Diretoria',
    campo: 'Campo/Obra'
  };
  
  return nomes[perfil] || perfil;
}
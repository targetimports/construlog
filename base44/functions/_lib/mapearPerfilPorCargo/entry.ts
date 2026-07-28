/**
 * Mapeamento automático de cargo → perfil do sistema
 */

const MAPA_CARGO_PERFIL = {
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
  'motorista': 'logistica',
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

export function mapearPerfilPorCargo(cargo) {
  if (!cargo) return 'campo';
  
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
    if (cargoNormalizado.includes('motorista') || cargoNormalizado.includes('logística')) {
      return 'logistica';
    }
    if (cargoNormalizado.includes('financeiro') || cargoNormalizado.includes('contador')) {
      return 'financeiro';
    }
    if (cargoNormalizado.includes('diretor') || cargoNormalizado.includes('gerente')) {
      return 'diretoria';
    }
  }
  
  return perfil || 'campo';
}
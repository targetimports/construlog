import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
// touch: redeploy 2026-02-26 18:30:00

/**
 * Matriz de permissões (espelhada do frontend)
 */
const MATRIZ_PERMISSOES = {
  admin: {
    obras: { pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    compras: { pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    estoque: { pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    financeiro: { pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    medicoes: { pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    diario: { pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    veiculos: { pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    equipamentos: { pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    rh: { pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true }
  },
  admin_empresa: {
    obras: { pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    compras: { pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    estoque: { pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    financeiro: { pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    medicoes: { pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    diario: { pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    veiculos: { pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    equipamentos: { pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    rh: { pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true }
  },
  diretoria: {
    obras: { pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    compras: { pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    estoque: { pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    financeiro: { pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    medicoes: { pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    diario: { pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    veiculos: { pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    equipamentos: { pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    rh: { pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true }
  },
  financeiro: {
    compras: { pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: true },
    financeiro: { pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    medicoes: { pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: true }
  },
  engenharia: {
    obras: { pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false },
    medicoes: { pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false },
    diario: { pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false }
  },
  compras: {
    compras: { pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false }
  },
  almoxarifado: {
    estoque: { pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false }
  },
  logistica: {
    veiculos: { pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false },
    equipamentos: { pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false }
  },
  campo: {
    diario: { pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false }
  }
};

/**
 * Mapear cargo para perfil
 */
function mapearPerfilPorCargo(cargo) {
  if (!cargo) return 'campo';
  
  const cargoLower = cargo.toLowerCase().trim();
  
  const mapa = {
    'engenheiro': 'engenharia',
    'mestre': 'campo',
    'comprador': 'compras',
    'almoxarife': 'almoxarifado',
    'motorista': 'logistica',
    'financeiro': 'financeiro',
    'diretor': 'diretoria'
  };
  
  for (const [key, perfil] of Object.entries(mapa)) {
    if (cargoLower.includes(key)) {
      return perfil;
    }
  }
  
  return 'campo';
}

/**
 * Validar permissão de ação
 */
function validarPermissao(perfil, modulo, acao) {
  if (!perfil || !modulo || !acao) {
    return false;
  }
  
  const perfilLower = perfil.toLowerCase();
  const moduloLower = modulo.toLowerCase();
  
  const permissoesPerfil = MATRIZ_PERMISSOES[perfilLower];
  if (!permissoesPerfil) {
    return false;
  }
  
  const permissoesModulo = permissoesPerfil[moduloLower];
  if (!permissoesModulo) {
    return false;
  }
  
  return permissoesModulo[acao] === true;
}

/**
 * Endpoint para validar permissão
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }
    
    const { modulo, acao } = await req.json();
    
    if (!modulo || !acao) {
      return Response.json({ error: 'Módulo e ação são obrigatórios' }, { status: 400 });
    }
    
    // Determinar perfil
    let perfil = user.perfil_sistema || user.role;
    if (!perfil && user.cargo) {
      perfil = mapearPerfilPorCargo(user.cargo);
    }
    if (!perfil) perfil = 'campo';
    
    // ✅ ADMIN EMPRESA: acesso total (exceto TI)
    const isAdminEmpresa = perfil === 'admin' || perfil === 'admin_empresa' || user?.cargo === 'admin_empresa' || user?.role === 'admin_empresa';
    
    // Validar
    const permitido = isAdminEmpresa || validarPermissao(perfil, modulo, acao);
    
    return Response.json({
      permitido,
      perfil,
      modulo,
      acao,
      usuario: user.email
    });
    
  } catch (error) {
    console.error('Erro ao validar permissão:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
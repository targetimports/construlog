/**
 * Calcula a alçada de aprovação necessária para uma OC
 * 
 * Baseado em:
 * - Valor da OC
 * - Tipo de compra
 * - Categoria dos materiais
 * - Obra
 * - Centro de custo
 */

export interface CriteriosOC {
  valor_total: number;
  tipo_compra?: string;
  categoria?: string;
  obra_id?: string;
  centro_custo?: string;
}

export interface AlcadaSelecionada {
  alcada_id: string;
  nome: string;
  nivel: number;
  aprovadores: any[];
  requer_todos: boolean;
}

export async function calcularAlcadaNecessaria(
  base44: any,
  criterios: CriteriosOC
): Promise<AlcadaSelecionada | null> {
  try {
    // Buscar todas as alçadas ativas
    const alcadas = await base44.asServiceRole.entities.AlcadaAprovacao.filter({
      ativa: true
    });

    if (!alcadas || alcadas.length === 0) {
      console.warn('[calcularAlcada] Nenhuma alçada configurada no sistema');
      return null;
    }

    // Filtrar alçadas aplicáveis
    const alcadasAplicaveis = alcadas.filter(alcada => {
      const c = alcada.criterios;

      // 1. Validar faixa de valor
      if (criterios.valor_total < c.valor_minimo) {
        return false;
      }
      if (c.valor_maximo && criterios.valor_total > c.valor_maximo) {
        return false;
      }

      // 2. Validar tipo de compra
      if (c.tipos_compra && c.tipos_compra.length > 0) {
        if (!c.tipos_compra.includes(criterios.tipo_compra || 'geral')) {
          return false;
        }
      }

      // 3. Validar categoria
      if (c.categorias && c.categorias.length > 0) {
        if (!c.categorias.includes(criterios.categoria || '')) {
          return false;
        }
      }

      // 4. Validar obra
      if (c.obras_ids && c.obras_ids.length > 0) {
        if (!c.obras_ids.includes(criterios.obra_id || '')) {
          return false;
        }
      }

      // 5. Validar centro de custo
      if (c.centros_custo && c.centros_custo.length > 0) {
        if (!c.centros_custo.includes(criterios.centro_custo || '')) {
          return false;
        }
      }

      return true;
    });

    if (alcadasAplicaveis.length === 0) {
      console.warn('[calcularAlcada] Nenhuma alçada aplicável encontrada para os critérios');
      return null;
    }

    // Retornar a alçada de maior nível (mais restritiva)
    const alcadaSelecionada = alcadasAplicaveis.sort((a, b) => b.nivel - a.nivel)[0];

    return {
      alcada_id: alcadaSelecionada.id,
      nome: alcadaSelecionada.nome,
      nivel: alcadaSelecionada.nivel,
      aprovadores: alcadaSelecionada.aprovadores || [],
      requer_todos: alcadaSelecionada.requer_todos_aprovadores
    };

  } catch (error) {
    console.error('[calcularAlcada] Erro:', error);
    return null;
  }
}

/**
 * Valida se um usuário está autorizado para aprovar em uma alçada
 */
export function validarAprovadorNaAlcada(
  user_email: string,
  alcada: any
): boolean {
  if (!alcada.aprovadores || alcada.aprovadores.length === 0) {
    return false;
  }

  return alcada.aprovadores.some(
    ap => ap.user_email === user_email
  );
}
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Calcula o parent_codigo de um item_codigo.
 * "2.3.1" -> "2.3"
 * "2.3"   -> "2"
 * "2"     -> null
 */
function calcParentCodigo(itemCodigo) {
  const lastDot = itemCodigo.lastIndexOf('.');
  if (lastDot === -1) return null;
  return itemCodigo.substring(0, lastDot);
}

/**
 * Compara dois item_codigo numericamente segmento por segmento.
 * "2.10" > "2.9" (correto)
 * "2.3"  < "2.10" (correto)
 */
function compareItemCodigo(a, b) {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const na = partsA[i] ?? 0;
    const nb = partsB[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contrato_versao_id } = await req.json();
    if (!contrato_versao_id) {
      return Response.json({ error: 'contrato_versao_id é obrigatório' }, { status: 400 });
    }

    // 1. Buscar todos os itens da versão
    const itens = await base44.entities.ContratoItem.filter({ contrato_versao_id });

    if (!itens || itens.length === 0) {
      return Response.json({ updated: 0, message: 'Nenhum item encontrado para esta versão do contrato.' });
    }

    // 2. Ordenar numericamente por item_codigo
    const ordenados = [...itens].sort((a, b) => compareItemCodigo(a.item_codigo, b.item_codigo));

    // 3. Calcular parent_codigo e ordem para cada item
    // Salvar em paralelo apenas os itens que mudaram (evita writes desnecessários)
    const updates = [];
    for (let i = 0; i < ordenados.length; i++) {
      const item = ordenados[i];
      const novoParent = calcParentCodigo(item.item_codigo);
      const novaOrdem = i + 1; // 1-based para exibição

      const parentMudou = item.parent_codigo !== novoParent;
      const ordemMudou = item.ordem !== novaOrdem;

      if (parentMudou || ordemMudou) {
        updates.push(
          base44.entities.ContratoItem.update(item.id, {
            parent_codigo: novoParent,
            ordem: novaOrdem
          })
        );
      }
    }

    // 4. Executar todos os updates em paralelo
    await Promise.all(updates);

    return Response.json({
      success: true,
      contrato_versao_id,
      total_itens: itens.length,
      updated: updates.length,
      message: `Hierarquia reconstruída: ${updates.length} de ${itens.length} itens atualizados.`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
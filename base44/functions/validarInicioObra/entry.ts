import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Valida se uma obra pode ter seu status alterado para "Em Andamento" / "em_andamento"
 * 
 * Regras:
 * 1) Se não existir nenhuma requisição de material criada para a obra → alerta
 * 2) Se o estoque da obra estiver zerado → alerta
 * 3) Modo Flexível: apenas alerta, permite continuar
 *    Modo Rigoroso: bloqueia até existir requisição aprovada ou estoque na obra
 * 
 * Payload esperado:
 *   { obra_id: string }
 * 
 * Retorna:
 *   {
 *     success: boolean,
 *     temRequisicao: boolean,
 *     requisicaoAprovada: boolean,
 *     temEstoque: boolean,
 *     modoRigoroso: boolean,
 *     bloqueado: boolean,
 *     alertas: string[]
 *   }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { obra_id } = await req.json();

    if (!obra_id) {
      return Response.json({ error: 'obra_id é obrigatório' }, { status: 400 });
    }

    // 1) Buscar configuração do sistema: modo_validacao_inicio_obra
    let modoRigoroso = false;
    try {
      const configs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({
        chave: 'modo_validacao_inicio_obra'
      });
      if (configs?.[0]) {
        modoRigoroso = configs[0].valor === 'rigoroso';
      }
    } catch (e) {
      // Se não existir configuração, usa modo flexível
      console.log('[validarInicioObra] Configuração não encontrada, usando modo flexível');
    }

    // 2) Verificar requisições de material da obra
    let temRequisicao = false;
    let requisicaoAprovada = false;
    try {
      // RequisicaoObra é a entidade usada para requisições de material
      const requisicoes = await base44.asServiceRole.entities.RequisicaoObra.filter({ obra_id });
      temRequisicao = requisicoes && requisicoes.length > 0;
      requisicaoAprovada = requisicoes?.some(r => r.status === 'APROVADA') || false;
    } catch (e) {
      console.log('[validarInicioObra] Erro ao buscar requisições:', e.message);
    }

    // Fallback: tentar RequisicaoCompra se RequisicaoObra não retornar nada
    if (!temRequisicao) {
      try {
        const reqCompra = await base44.asServiceRole.entities.RequisicaoCompra.filter({ obra_id });
        temRequisicao = reqCompra && reqCompra.length > 0;
        requisicaoAprovada = reqCompra?.some(r => ['aprovada', 'APROVADA', 'em_compra', 'finalizada'].includes(r.status)) || false;
      } catch (e) {
        // Ignora se não existir
      }
    }

    // 3) Verificar estoque da obra
    let temEstoque = false;
    try {
      // Buscar LocalEstoque da obra
      const locais = await base44.asServiceRole.entities.LocalEstoque.filter({ obra_id, tipo: 'OBRA' });
      const localObraId = locais?.[0]?.id;

      if (localObraId) {
        // Buscar saldos
        const saldos = await base44.asServiceRole.entities.SaldoEstoque.filter({ local_estoque_id: localObraId });
        temEstoque = saldos?.some(s => (s.saldo_atual || 0) > 0) || false;
      }
    } catch (e) {
      console.log('[validarInicioObra] Erro ao buscar estoque:', e.message);
    }

    // Fallback: verificar EstoqueObra se SaldoEstoque não retornar nada
    if (!temEstoque) {
      try {
        const estoqueObra = await base44.asServiceRole.entities.EstoqueObra.filter({ obra_id });
        temEstoque = estoqueObra?.some(e => (e.quantidade_total || e.quantidade_disponivel || 0) > 0) || false;
      } catch (e) {
        // Ignora
      }
    }

    // 4) Determinar se está bloqueado (modo rigoroso)
    const bloqueado = modoRigoroso && (!requisicaoAprovada && !temEstoque);

    // 5) Montar alertas
    const alertas = [];
    if (!temRequisicao) {
      alertas.push('Nenhuma requisição de material foi criada para esta obra.');
    } else if (!requisicaoAprovada && modoRigoroso) {
      alertas.push('Existe requisição, mas nenhuma está aprovada.');
    }
    if (!temEstoque) {
      alertas.push('O estoque da obra está zerado. Não há materiais disponíveis para consumo.');
    }

    // 6) Registrar log da tentativa (se houver alertas)
    if (alertas.length > 0) {
      try {
        await base44.asServiceRole.entities.HistoricoObra.create({
          obra_id,
          usuario: user.email,
          tipo_alteracao: 'tentativa_inicio',
          descricao: `Tentativa de iniciar obra sem pré-requisitos: ${alertas.join('; ')}`,
          data_hora: new Date().toISOString()
        });
      } catch (e) {
        console.log('[validarInicioObra] Erro ao registrar log:', e.message);
      }
    }

    return Response.json({
      success: true,
      temRequisicao,
      requisicaoAprovada,
      temEstoque,
      modoRigoroso,
      bloqueado,
      alertas
    });

  } catch (error) {
    console.error('[validarInicioObra] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
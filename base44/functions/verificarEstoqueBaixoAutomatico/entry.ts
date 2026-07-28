import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { FunctionLogger } from './_shared/logger.js';

/**
 * Verificar Estoque Baixo Automaticamente
 * Quando SaldoEstoque é atualizado, verifica se caiu abaixo do limite configurável
 * e gera alertas
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const logger = new FunctionLogger('verificarEstoqueBaixoAutomatico', base44);

  try {
    const user = await base44.auth.me().catch(() => null);
    const { event, data } = await req.json();

    // Validar evento
    if (event?.type !== 'update' || event?.entity_name !== 'SaldoEstoque') {
      return Response.json({ ok: true, skipped: 'evento_nao_aplicavel' });
    }

    const saldo = data;
    if (!saldo?.material_id || saldo.saldo === undefined) {
      return Response.json({ ok: true, skipped: 'dados_insuficientes' });
    }

    console.log(`[verificarEstoqueBaixoAutomatico] Verificando saldo de ${saldo.material_id}...`);

    // Buscar configuração de limite para este material
    let limiteMinimo = 10; // Default

    try {
      const config = await base44.asServiceRole.entities.PoliticaEstoque?.filter?.({
        material_id: saldo.material_id
      })?.catch(() => []);

      if (config && config.length > 0 && config[0].quantidade_minima) {
        limiteMinimo = config[0].quantidade_minima;
      }
    } catch (err) {
      console.warn('[verificarEstoqueBaixoAutomatico] Erro ao buscar política:', err.message);
    }

    // Se saldo caiu abaixo do limite, gerar alerta
    if (saldo.saldo < limiteMinimo && saldo.saldo >= 0) {
      try {
        // Buscar material para mais informações
        const material = await base44.asServiceRole.entities.Material?.read?.(saldo.material_id)?.catch(() => null);

        // Criar alerta
        await base44.asServiceRole.entities.AlertaDesvio?.create?.({
          tipo: 'ESTOQUE_BAIXO',
          entidade_tipo: 'SaldoEstoque',
          entidade_id: saldo.id,
          severity: saldo.saldo === 0 ? 'CRÍTICO' : 'AVISO',
          mensagem: `${material?.nome || saldo.material_id} com estoque baixo: ${saldo.saldo} unidades (limite: ${limiteMinimo})`,
          descricao: `Saldo em ${saldo.deposito_id}: ${saldo.saldo}/${limiteMinimo}`,
          ativo: true,
          data_criacao: new Date().toISOString()
        }).catch(() => {});

        // Criar notificação se houver sistema de notificações
        await base44.asServiceRole.entities.Notificacao?.create?.({
          destinatario_email: 'admin@empresa.com',
          tipo: 'alerta',
          titulo: `Estoque baixo: ${material?.nome || saldo.material_id}`,
          mensagem: `Saldo em ${saldo.deposito_id}: ${saldo.saldo} unidades (limite: ${limiteMinimo})`,
          lida: false
        }).catch(() => {});

        console.log(`[verificarEstoqueBaixoAutomatico] Alerta de estoque baixo criado para ${saldo.material_id}`);

        await logger.success(user, { material_id: saldo.material_id }, {
          saldo_atual: saldo.saldo,
          limite: limiteMinimo,
          alerta_criado: true
        });

        return Response.json({
          ok: true,
          alerta_criado: true,
          message: `Alerta de estoque baixo criado: ${saldo.saldo}/${limiteMinimo}`
        });
      } catch (err) {
        console.warn('[verificarEstoqueBaixoAutomatico] Erro ao criar alerta:', err.message);
      }
    }

    return Response.json({
      ok: true,
      alerta_criado: false,
      message: `Estoque OK: ${saldo.saldo} unidades`
    });
  } catch (error) {
    const user = await base44.auth.me().catch(() => null);
    await logger.error(user, {}, error, 'AUTOMATION_ERROR');
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { safeJson } from './_utils/safeJson.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    // FIX #1: admin e programador têm acesso irrestrito; outros validam por cargo/role
    const isSuperAdmin = user.role === 'admin' || user.role === 'programador';
    const rolesPermitidos = ['diretor', 'financeiro', 'engenharia', 'admin', 'programador'];
    const cargo = (user.cargo || '').toLowerCase();
    const role = (user.role || '').toLowerCase();
    const temAcesso = isSuperAdmin || rolesPermitidos.includes(cargo) || rolesPermitidos.includes(role);

    // Se sem acesso, retornar lista vazia (não deve quebrar dashboard)
    if (!temAcesso) {
      console.warn('[getAlertasExecutivos] Acesso negado para:', user.email, '|', cargo, '|', role);
      return Response.json({ 
        alertas: [], 
        denied: true,
        message: 'Sem permissão para visualizar alertas'
      }, { status: 200 });
    }

    const { periodo = 15, obra_id = null } = await safeJson(req, {});

    const configs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({});
    const configMap = configs.reduce((acc, cfg) => ({ ...acc, [cfg.chave]: cfg.valor }), {});
    
    const thresholdAlto = parseFloat(configMap['alerta_desvio_alto'] || '15');
    const thresholdCritico = parseFloat(configMap['alerta_desvio_critico'] || '30');
    const diasAtrasoOC = parseInt(configMap['alerta_dias_atraso_oc'] || '7');

    const hoje = new Date();
    const alertas = [];

    // === 1. DESVIO PLANEJADO VS REAL ===
    // FIX #4: Buscar obras por status em vez de filter por id (evita exceção de ID inválido)
    let obras = [];
    if (obra_id) {
      const todasObras = await base44.asServiceRole.entities.Obra.list('-created_date', 200);
      obras = todasObras.filter(o => o.id === obra_id);
    } else {
      obras = await base44.asServiceRole.entities.Obra.filter({ status: 'em_andamento' });
    }

    for (const obra of obras) {
      const [orcamentos, movimentacoes, diarios, contasPagas] = await Promise.all([
        base44.asServiceRole.entities.Orcamento.filter({ obra_id: obra.id, status: 'vigente' }),
        base44.asServiceRole.entities.EstoqueMovimentacao.filter({ obra_id: obra.id, tipo: 'SAIDA' }),
        base44.asServiceRole.entities.DiarioObra.filter({ obra_id: obra.id }),
        base44.asServiceRole.entities.ContaFinanceira.filter({ obra_id: obra.id, tipo: 'pagar' })
      ]);
      
      if (orcamentos.length === 0) continue;
      
      const planejadoTotal = orcamentos.reduce((sum, orc) => sum + (orc.valor_total || 0), 0);
      // EstoqueMovimentacao não tem valor_total oficial; se existir, soma, senão ignora
      const realMateriais = movimentacoes.reduce((sum, mov) => sum + (Number(mov.valor_total || 0)), 0);
      const realMaoObra = diarios.reduce((sum, d) => sum + ((d.qtd_funcionarios || 0) * 150), 0);
      const realFinanceiro = contasPagas
        .filter(c => (c.status === 'pago' || c.status === 'parcial') && c.categoria !== 'material')
        .reduce((sum, c) => sum + (c.valor || 0), 0);

      const realTotal = realMateriais + realMaoObra + realFinanceiro;
      
      if (planejadoTotal > 0) {
        const desvioPercent = ((realTotal - planejadoTotal) / planejadoTotal) * 100;
        const severidade = Math.abs(desvioPercent) >= thresholdCritico ? 'critico' : Math.abs(desvioPercent) >= thresholdAlto ? 'alto' : null;
        
        if (severidade) {
          alertas.push({
            tipo: 'desvio_orcamento',
            severidade,
            titulo: `Desvio ${severidade === 'critico' ? 'crítico' : 'alto'}: ${desvioPercent.toFixed(1)}%`,
            descricao: `Obra "${obra.nome}" com desvio de ${desvioPercent > 0 ? '+' : ''}${desvioPercent.toFixed(1)}% (Planejado: R$${planejadoTotal.toLocaleString('pt-BR')}, Real: R$${realTotal.toLocaleString('pt-BR')})`,
            obra_id: obra.id,
            obra_nome: obra.nome,
            referencia_tipo: 'obra',
            referencia_id: obra.id,
            rota: `/planejado-vs-real?obra_id=${obra.id}`,
            valor_numerico: Math.abs(desvioPercent),
            created_at: new Date().toISOString()
          });
        }
      }
    }

    // === 2. CONTAS A RECEBER VENCENDO/VENCIDAS ===
    const queryReceber = obra_id ? { tipo: 'receber', obra_id, status: 'pendente' } : { tipo: 'receber', status: 'pendente' };
    const contasReceber = await base44.asServiceRole.entities.ContaFinanceira.filter(queryReceber);

    for (const conta of contasReceber) {
      if (!conta.data_vencimento) continue;
      const diasAteVencimento = Math.ceil((new Date(conta.data_vencimento) - hoje) / (1000 * 60 * 60 * 24));
      if (diasAteVencimento < 0) {
        alertas.push({ tipo: 'receber_vencida', severidade: 'critico', titulo: 'Conta a receber vencida', descricao: `"${conta.descricao}" vencida há ${Math.abs(diasAteVencimento)} dias - Valor: R$${(conta.valor || 0).toLocaleString('pt-BR')}`, obra_id: conta.obra_id, referencia_tipo: 'conta_financeira', referencia_id: conta.id, rota: `/ContasReceber?status=pendente&vencidas=true`, valor_numerico: Math.abs(diasAteVencimento), created_at: new Date().toISOString() });
      } else if (diasAteVencimento <= periodo) {
        alertas.push({ tipo: 'receber_vencendo', severidade: diasAteVencimento <= 7 ? 'alto' : 'medio', titulo: `Conta a receber vence em ${diasAteVencimento} dias`, descricao: `"${conta.descricao}" - Valor: R$${(conta.valor || 0).toLocaleString('pt-BR')}`, obra_id: conta.obra_id, referencia_tipo: 'conta_financeira', referencia_id: conta.id, rota: `/ContasReceber?status=pendente`, valor_numerico: diasAteVencimento, created_at: new Date().toISOString() });
      }
    }

    // === 3. CONTAS A PAGAR VENCENDO/VENCIDAS ===
    const queryPagar = obra_id ? { tipo: 'pagar', obra_id, status: 'pendente' } : { tipo: 'pagar', status: 'pendente' };
    const contasPagar = await base44.asServiceRole.entities.ContaFinanceira.filter(queryPagar);

    for (const conta of contasPagar) {
      if (!conta.data_vencimento) continue;
      const diasAteVencimento = Math.ceil((new Date(conta.data_vencimento) - hoje) / (1000 * 60 * 60 * 24));
      if (diasAteVencimento < 0) {
        alertas.push({ tipo: 'pagar_vencida', severidade: 'critico', titulo: 'Conta a pagar vencida', descricao: `"${conta.descricao}" vencida há ${Math.abs(diasAteVencimento)} dias - Valor: R$${(conta.valor || 0).toLocaleString('pt-BR')}`, obra_id: conta.obra_id, referencia_tipo: 'conta_financeira', referencia_id: conta.id, rota: `/ContasPagar?status=pendente&vencidas=true`, valor_numerico: Math.abs(diasAteVencimento), created_at: new Date().toISOString() });
      } else if (diasAteVencimento <= periodo) {
        alertas.push({ tipo: 'pagar_vencendo', severidade: diasAteVencimento <= 7 ? 'alto' : 'medio', titulo: `Conta a pagar vence em ${diasAteVencimento} dias`, descricao: `"${conta.descricao}" - Valor: R$${(conta.valor || 0).toLocaleString('pt-BR')}`, obra_id: conta.obra_id, referencia_tipo: 'conta_financeira', referencia_id: conta.id, rota: `/ContasPagar?status=pendente`, valor_numerico: diasAteVencimento, created_at: new Date().toISOString() });
      }
    }

    // === 4. ESTOQUE CRÍTICO ===
    const saldos = await base44.asServiceRole.entities.SaldoEstoque.filter({}, '-quantidade_disponivel', 200);
    for (const saldo of saldos) {
      const saldoAtual = Number(saldo.quantidade_disponivel ?? 0);
      const insId = saldo.insumo_id;
      const almoxId = saldo.almoxarifado_id;
      const descricao = saldo.descricao_insumo;
      const unidade = saldo.unidade;

      if (saldoAtual < 0) {
        alertas.push({ tipo: 'estoque_negativo', severidade: 'critico', titulo: 'Estoque negativo', descricao: `"${descricao}" com saldo negativo: ${saldoAtual} ${unidade}`, obra_id: null, referencia_tipo: 'saldo_estoque', referencia_id: saldo.id, rota: `/Estoque?filtro=negativo`, valor_numerico: Math.abs(saldoAtual), created_at: new Date().toISOString() });
        continue;
      }

      const politicas = await base44.asServiceRole.entities.PoliticaEstoque.filter({ insumo_id: insId, almoxarifado_id: almoxId, ativo: true });
      if (politicas.length === 0) continue;

      const politica = politicas[0];
      const minimo = Number(politica.minimo ?? 0);
      const pontoReposicao = Number(politica.ponto_reposicao ?? minimo);

      if (minimo > 0 && saldoAtual < minimo) {
        alertas.push({ tipo: 'estoque_abaixo_minimo', severidade: 'alto', titulo: 'Estoque abaixo do mínimo', descricao: `"${descricao}" com ${saldoAtual} ${unidade} | mínimo: ${minimo}`, obra_id: null, referencia_tipo: 'saldo_estoque', referencia_id: saldo.id, rota: `/PoliticasEstoque`, valor_numerico: minimo - saldoAtual, created_at: new Date().toISOString() });
      } else if (pontoReposicao > 0 && saldoAtual <= pontoReposicao) {
        alertas.push({ tipo: 'estoque_em_ponto_reposicao', severidade: 'medio', titulo: 'Estoque no ponto de reposição', descricao: `"${descricao}" com ${saldoAtual} ${unidade} | ponto reposição: ${pontoReposicao}`, obra_id: null, referencia_tipo: 'saldo_estoque', referencia_id: saldo.id, rota: `/PoliticasEstoque`, valor_numerico: pontoReposicao - saldoAtual, created_at: new Date().toISOString() });
      }
    }

    // === 5. ORDENS DE COMPRA SEM RECEBIMENTO ===
    const queryOC = obra_id ? { obra_id, status: 'aprovada' } : { status: 'aprovada' };
    const ordensAprovadas = await base44.asServiceRole.entities.OrdemCompra.filter(queryOC);

    for (const oc of ordensAprovadas) {
      const diasDesdeAprovacao = Math.ceil((hoje - new Date(oc.data_aprovacao || oc.created_date)) / (1000 * 60 * 60 * 24));
      if (diasDesdeAprovacao > diasAtrasoOC && oc.status_entrega === 'nao_recebido') {
        alertas.push({ tipo: 'oc_sem_recebimento', severidade: 'alto', titulo: `OC sem recebimento há ${diasDesdeAprovacao} dias`, descricao: `OC #${oc.numero} aguardando recebimento - Valor: R$${(oc.valor_total || 0).toLocaleString('pt-BR')}`, obra_id: oc.obra_id, referencia_tipo: 'ordem_compra', referencia_id: oc.id, rota: `/Compras?status=aprovada`, valor_numerico: diasDesdeAprovacao, created_at: new Date().toISOString() });
      } else if (oc.status_entrega === 'recebido_parcial' && diasDesdeAprovacao > diasAtrasoOC + 7) {
        alertas.push({ tipo: 'oc_recebimento_parcial', severidade: 'medio', titulo: 'OC com recebimento parcial atrasado', descricao: `OC #${oc.numero} com recebimento parcial há ${diasDesdeAprovacao} dias`, obra_id: oc.obra_id, referencia_tipo: 'ordem_compra', referencia_id: oc.id, rota: `/Compras?status=aprovada`, valor_numerico: diasDesdeAprovacao, created_at: new Date().toISOString() });
      }
    }

    const severidadeOrdem = { critico: 1, alto: 2, medio: 3 };
    alertas.sort((a, b) => {
      if (severidadeOrdem[a.severidade] !== severidadeOrdem[b.severidade]) return severidadeOrdem[a.severidade] - severidadeOrdem[b.severidade];
      return (b.valor_numerico || 0) - (a.valor_numerico || 0);
    });

    return Response.json({
      ok: true,
      alertas,
      total: alertas.length,
      criticos: alertas.filter(a => a.severidade === 'critico').length,
      altos: alertas.filter(a => a.severidade === 'alto').length,
      medios: alertas.filter(a => a.severidade === 'medio').length,
      periodo,
      obra_id
    });

  } catch (error) {
    console.error('[ERROR] getAlertasExecutivos:', error?.message, error?.stack);
    // Retornar 200 com lista vazia para não quebrar o dashboard
    return Response.json({ ok: false, alertas: [], total: 0, criticos: 0, altos: 0, medios: 0, error: error.message }, { status: 200 });
  }
});
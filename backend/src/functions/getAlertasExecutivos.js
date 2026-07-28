import { store } from '../entityStore.js';
import { isSuperAdmin } from '../rbac.js';
import { isGlobal, empresaIdDe } from '../middleware.js';

// Alertas executivos: desvio orçamentário, contas a vencer/vencidas, estoque crítico
// e OCs sem recebimento. Thresholds vêm do ConfiguracaoSistema (catálogo de regras).
export default async function getAlertasExecutivos({ body, user }) {
  if (!user) {
    throw Object.assign(new Error('Não autenticado'), { status: 401 });
  }

  const rolesPermitidos = ['diretor', 'financeiro', 'engenharia', 'admin', 'programador'];
  const cargo = String(user.cargo || '').toLowerCase();
  const role = String(user.role || '').toLowerCase();
  const temAcesso = isSuperAdmin(user) || rolesPermitidos.includes(cargo) || rolesPermitidos.includes(role);
  if (!temAcesso) {
    return { alertas: [], denied: true, message: 'Sem permissão para visualizar alertas' };
  }

  const { periodo = 15, obra_id = null } = body || {};

  const configs = await store.filter('ConfiguracaoSistema', {});
  const configMap = configs.reduce((acc, cfg) => ({ ...acc, [cfg.chave]: cfg.valor }), {});
  const thresholdAlto = parseFloat(configMap['alerta_desvio_alto'] || '15');
  const thresholdCritico = parseFloat(configMap['alerta_desvio_critico'] || '30');
  const diasAtrasoOC = parseInt(configMap['alerta_dias_atraso_oc'] || '7');

  const hoje = new Date();
  const alertas = [];

  // === 1. DESVIO PLANEJADO VS REAL ===
  let obras = [];
  if (obra_id) {
    const todasObras = await store.filter('Obra', {}, '-created_date', 200);
    obras = todasObras.filter((o) => o.id === obra_id);
  } else {
    obras = await store.filter('Obra', { status: 'em_andamento' });
  }
  if (!isGlobal(user)) {
    const eid = empresaIdDe(user);
    obras = obras.filter((o) => o.empresa_id === eid);
  }

  for (const obra of obras) {
    const [orcamentos, movimentacoes, diarios, contasPagas] = await Promise.all([
      store.filter('Orcamento', { obra_id: obra.id, status: 'vigente' }),
      store.filter('EstoqueMovimentacao', { obra_id: obra.id, tipo: 'SAIDA' }),
      store.filter('DiarioObra', { obra_id: obra.id }),
      store.filter('ContaFinanceira', { obra_id: obra.id, tipo: 'pagar' })
    ]);

    if (orcamentos.length === 0) continue;

    const planejadoTotal = orcamentos.reduce((sum, orc) => sum + (orc.valor_total || 0), 0);
    const realMateriais = movimentacoes.reduce((sum, mov) => sum + Number(mov.valor_total || 0), 0);
    const realMaoObra = diarios.reduce((sum, d) => sum + (d.qtd_funcionarios || 0) * 150, 0);
    const realFinanceiro = contasPagas
      .filter((c) => (c.status === 'pago' || c.status === 'parcial') && c.categoria !== 'material')
      .reduce((sum, c) => sum + (c.valor || 0), 0);
    const realTotal = realMateriais + realMaoObra + realFinanceiro;

    if (planejadoTotal > 0) {
      const desvioPercent = ((realTotal - planejadoTotal) / planejadoTotal) * 100;
      const severidade = Math.abs(desvioPercent) >= thresholdCritico ? 'critico' : Math.abs(desvioPercent) >= thresholdAlto ? 'alto' : null;
      if (severidade) {
        alertas.push({
          tipo: 'desvio_orcamento', severidade,
          titulo: `Desvio ${severidade === 'critico' ? 'crítico' : 'alto'}: ${desvioPercent.toFixed(1)}%`,
          descricao: `Obra "${obra.nome}" com desvio de ${desvioPercent > 0 ? '+' : ''}${desvioPercent.toFixed(1)}% (Planejado: R$${planejadoTotal.toLocaleString('pt-BR')}, Real: R$${realTotal.toLocaleString('pt-BR')})`,
          obra_id: obra.id, obra_nome: obra.nome, referencia_tipo: 'obra', referencia_id: obra.id,
          rota: `/PlanejadoVsReal?obra_id=${obra.id}`, valor_numerico: Math.abs(desvioPercent), created_at: hoje.toISOString()
        });
      }
    }
  }

  // === 2. CONTAS A RECEBER ===
  let contasReceber = await store.filter('ContaFinanceira', obra_id ? { tipo: 'receber', obra_id, status: 'pendente' } : { tipo: 'receber', status: 'pendente' });
  if (!isGlobal(user)) {
    const eid = empresaIdDe(user);
    contasReceber = contasReceber.filter((c) => c.empresa_id === eid);
  }
  for (const conta of contasReceber) {
    if (!conta.data_vencimento) continue;
    const dias = Math.ceil((new Date(conta.data_vencimento) - hoje) / 86400000);
    if (dias < 0) {
      alertas.push({ tipo: 'receber_vencida', severidade: 'critico', titulo: 'Conta a receber vencida', descricao: `"${conta.descricao}" vencida há ${Math.abs(dias)} dias - Valor: R$${(conta.valor || 0).toLocaleString('pt-BR')}`, obra_id: conta.obra_id, referencia_tipo: 'conta_financeira', referencia_id: conta.id, rota: `/ContasReceber?status=pendente&vencidas=true`, valor_numerico: Math.abs(dias), created_at: hoje.toISOString() });
    } else if (dias <= periodo) {
      alertas.push({ tipo: 'receber_vencendo', severidade: dias <= 7 ? 'alto' : 'medio', titulo: `Conta a receber vence em ${dias} dias`, descricao: `"${conta.descricao}" - Valor: R$${(conta.valor || 0).toLocaleString('pt-BR')}`, obra_id: conta.obra_id, referencia_tipo: 'conta_financeira', referencia_id: conta.id, rota: `/ContasReceber?status=pendente`, valor_numerico: dias, created_at: hoje.toISOString() });
    }
  }

  // === 3. CONTAS A PAGAR ===
  let contasPagar = await store.filter('ContaFinanceira', obra_id ? { tipo: 'pagar', obra_id, status: 'pendente' } : { tipo: 'pagar', status: 'pendente' });
  if (!isGlobal(user)) {
    const eid = empresaIdDe(user);
    contasPagar = contasPagar.filter((c) => c.empresa_id === eid);
  }
  for (const conta of contasPagar) {
    if (!conta.data_vencimento) continue;
    const dias = Math.ceil((new Date(conta.data_vencimento) - hoje) / 86400000);
    if (dias < 0) {
      alertas.push({ tipo: 'pagar_vencida', severidade: 'critico', titulo: 'Conta a pagar vencida', descricao: `"${conta.descricao}" vencida há ${Math.abs(dias)} dias - Valor: R$${(conta.valor || 0).toLocaleString('pt-BR')}`, obra_id: conta.obra_id, referencia_tipo: 'conta_financeira', referencia_id: conta.id, rota: `/ContasPagar?status=pendente&vencidas=true`, valor_numerico: Math.abs(dias), created_at: hoje.toISOString() });
    } else if (dias <= periodo) {
      alertas.push({ tipo: 'pagar_vencendo', severidade: dias <= 7 ? 'alto' : 'medio', titulo: `Conta a pagar vence em ${dias} dias`, descricao: `"${conta.descricao}" - Valor: R$${(conta.valor || 0).toLocaleString('pt-BR')}`, obra_id: conta.obra_id, referencia_tipo: 'conta_financeira', referencia_id: conta.id, rota: `/ContasPagar?status=pendente`, valor_numerico: dias, created_at: hoje.toISOString() });
    }
  }

  // === 4. ESTOQUE CRÍTICO ===
  let saldos = await store.filter('SaldoEstoque', {}, '-quantidade_disponivel', 200);
  if (!isGlobal(user)) {
    const eid = empresaIdDe(user);
    saldos = saldos.filter((s) => s.empresa_id === eid);
  }
  for (const saldo of saldos) {
    const saldoAtual = Number(saldo.quantidade_disponivel ?? 0);
    if (saldoAtual < 0) {
      alertas.push({ tipo: 'estoque_negativo', severidade: 'critico', titulo: 'Estoque negativo', descricao: `"${saldo.descricao_insumo}" com saldo negativo: ${saldoAtual} ${saldo.unidade}`, obra_id: null, referencia_tipo: 'saldo_estoque', referencia_id: saldo.id, rota: `/Estoque?filtro=negativo`, valor_numerico: Math.abs(saldoAtual), created_at: hoje.toISOString() });
      continue;
    }
    const politicas = await store.filter('PoliticaEstoque', { insumo_id: saldo.insumo_id, almoxarifado_id: saldo.almoxarifado_id, ativo: true });
    if (politicas.length === 0) continue;
    const politica = politicas[0];
    const minimo = Number(politica.minimo ?? 0);
    const pontoReposicao = Number(politica.ponto_reposicao ?? minimo);
    if (minimo > 0 && saldoAtual < minimo) {
      alertas.push({ tipo: 'estoque_abaixo_minimo', severidade: 'alto', titulo: 'Estoque abaixo do mínimo', descricao: `"${saldo.descricao_insumo}" com ${saldoAtual} ${saldo.unidade} | mínimo: ${minimo}`, obra_id: null, referencia_tipo: 'saldo_estoque', referencia_id: saldo.id, rota: `/PoliticasEstoque`, valor_numerico: minimo - saldoAtual, created_at: hoje.toISOString() });
    } else if (pontoReposicao > 0 && saldoAtual <= pontoReposicao) {
      alertas.push({ tipo: 'estoque_em_ponto_reposicao', severidade: 'medio', titulo: 'Estoque no ponto de reposição', descricao: `"${saldo.descricao_insumo}" com ${saldoAtual} ${saldo.unidade} | ponto reposição: ${pontoReposicao}`, obra_id: null, referencia_tipo: 'saldo_estoque', referencia_id: saldo.id, rota: `/PoliticasEstoque`, valor_numerico: pontoReposicao - saldoAtual, created_at: hoje.toISOString() });
    }
  }

  // === 5. ORDENS DE COMPRA SEM RECEBIMENTO ===
  let ordensAprovadas = await store.filter('OrdemCompra', obra_id ? { obra_id, status: 'aprovada' } : { status: 'aprovada' });
  if (!isGlobal(user)) { const eid = empresaIdDe(user); ordensAprovadas = ordensAprovadas.filter((oc) => oc.empresa_id === eid); }
  for (const oc of ordensAprovadas) {
    const dias = Math.ceil((hoje - new Date(oc.data_aprovacao || oc.created_date)) / 86400000);
    if (dias > diasAtrasoOC && oc.status_entrega === 'nao_recebido') {
      alertas.push({ tipo: 'oc_sem_recebimento', severidade: 'alto', titulo: `OC sem recebimento há ${dias} dias`, descricao: `OC #${oc.numero} aguardando recebimento - Valor: R$${(oc.valor_total || 0).toLocaleString('pt-BR')}`, obra_id: oc.obra_id, referencia_tipo: 'ordem_compra', referencia_id: oc.id, rota: `/Compras?status=aprovada`, valor_numerico: dias, created_at: hoje.toISOString() });
    } else if (oc.status_entrega === 'recebido_parcial' && dias > diasAtrasoOC + 7) {
      alertas.push({ tipo: 'oc_recebimento_parcial', severidade: 'medio', titulo: 'OC com recebimento parcial atrasado', descricao: `OC #${oc.numero} com recebimento parcial há ${dias} dias`, obra_id: oc.obra_id, referencia_tipo: 'ordem_compra', referencia_id: oc.id, rota: `/Compras?status=aprovada`, valor_numerico: dias, created_at: hoje.toISOString() });
    }
  }

  const ordem = { critico: 1, alto: 2, medio: 3 };
  alertas.sort((a, b) => (ordem[a.severidade] !== ordem[b.severidade] ? ordem[a.severidade] - ordem[b.severidade] : (b.valor_numerico || 0) - (a.valor_numerico || 0)));

  return {
    ok: true, alertas, total: alertas.length,
    criticos: alertas.filter((a) => a.severidade === 'critico').length,
    altos: alertas.filter((a) => a.severidade === 'alto').length,
    medios: alertas.filter((a) => a.severidade === 'medio').length,
    periodo, obra_id
  };
}

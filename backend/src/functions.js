import { Router } from 'express';
import { requireAuth } from './middleware.js';
import listarApontamentosHora from './functions/listarApontamentosHora.js';
import criarApontamentoHora from './functions/criarApontamentoHora.js';
import editarApontamentoHora from './functions/editarApontamentoHora.js';
import aprovarApontamentoHora from './functions/aprovarApontamentoHora.js';
import rejeitarApontamentoHora from './functions/rejeitarApontamentoHora.js';
import exportarApontamentosHoraCsv from './functions/exportarApontamentosHoraCsv.js';
import importarApontamentosDoDiario from './functions/importarApontamentosDoDiario.js';
import salvarCustoHoraColaborador from './functions/salvarCustoHoraColaborador.js';
import gerarFolhaPagamento from './functions/gerarFolhaPagamento.js';
import getEffectivePermissionsV2 from './functions/getEffectivePermissionsV2.js';
import lerLogSistema from './functions/lerLogSistema.js';
import testarInstanciaCliente from './functions/testarInstanciaCliente.js';
import getMenuForBootstrap from './functions/getMenuForBootstrap.js';
import getPermissoesCatalogo from './functions/getPermissoesCatalogo.js';
import finalizarImportacaoCompleta from './functions/finalizarImportacaoCompleta.js';
import getOrcamentoConsolidacaoStatus from './functions/getOrcamentoConsolidacaoStatus.js';
import diagnosticarObraCampos from './functions/diagnosticarObraCampos.js';
import importarOrcamentoSintetico from './functions/importarOrcamentoSintetico.js';
import importarOrcamentoPDF from './functions/importarOrcamentoPDF.js';
import importarPlanilhaPrecosSINAPI from './functions/importarPlanilhaPrecosSINAPI.js';
import importarCronogramaFisFinan from './functions/importarCronogramaFisFinan.js';
import getObraDetailsData from './functions/getObraDetailsData.js';
import ativarObraAPartirDoOrcamento from './functions/ativarObraAPartirDoOrcamento.js';
import gerarOCDaCotacao from './functions/gerarOCDaCotacao.js';
import processarRecebimentoMaterial from './functions/processarRecebimentoMaterial.js';
import gerarContratoDoOrcamento from './functions/gerarContratoDoOrcamento.js';
import criarBMSemWizard from './functions/criarBMSemWizard.js';
import calcBMv2 from './functions/calcBMv2.js';
import onBMApproveWithFinance from './functions/onBMApproveWithFinance.js';
import retificarBM from './functions/retificarBM.js';
import recalcContratoVersao from './functions/recalcContratoVersao.js';
import processarMovimentacaoEstoque from './functions/processarMovimentacaoEstoque.js';
import atenderRequisicaoObra from './functions/atenderRequisicaoObra.js';
import receberTransferenciaObra from './functions/receberTransferenciaObra.js';
import getDetalheFolhaPagamento from './functions/getDetalheFolhaPagamento.js';
import getTransferenciasDoDia from './functions/getTransferenciasDoDia.js';
import encerrarTransferenciaObra from './functions/encerrarTransferenciaObra.js';
import gerarPagamentosTerceirizados from './functions/gerarPagamentosTerceirizados.js';
import registrarEmpreita from './functions/registrarEmpreita.js';
import calcularResumoMateriaisObra from './functions/calcularResumoMateriaisObra.js';
import listarColaboradoresObra from './functions/listarColaboradoresObra.js';
import adicionarColaboradorAObra from './functions/adicionarColaboradorAObra.js';
import removerColaboradorDaObra from './functions/removerColaboradorDaObra.js';
import validarInicioObra from './functions/validarInicioObra.js';
import simularObra from './functions/simularObra.js';
import simularViabilidadeObra from './functions/simularViabilidadeObra.js';
import calcularDREObra from './functions/calcularDREObra.js';
import aprovarApontamentoMaoObra from './functions/aprovarApontamentoMaoObra.js';
import compararInsumosPlanejados from './functions/compararInsumosPlanejados.js';
import listarPendencias from './functions/listarPendencias.js';
import listarContratos from './functions/listarContratos.js';
import criarContrato from './functions/criarContrato.js';
import editarContrato from './functions/editarContrato.js';
import criarMedicaoContrato from './functions/criarMedicaoContrato.js';
import toggleEdicaoContrato from './functions/toggleEdicaoContrato.js';
import aprovarMedicaoContrato from './functions/aprovarMedicaoContrato.js';
import salvarPedidoCompraConsolidado from './functions/salvarPedidoCompraConsolidado.js';
import repassarVerba from './functions/repassarVerba.js';
import calcularDREGlobalEmpresa from './functions/calcularDREGlobalEmpresa.js';
import consolidarFinanceiroPorObra from './functions/consolidarFinanceiroPorObra.js';
import consolidarResumoFinanceiro from './functions/consolidarResumoFinanceiro.js';
import solicitarEmprestimoAtivo from './functions/solicitarEmprestimoAtivo.js';
import aprovarEmprestimoAtivo from './functions/aprovarEmprestimoAtivo.js';
import registrarVistoriaAtivo from './functions/registrarVistoriaAtivo.js';
import registrarAbastecimentoAtivo from './functions/registrarAbastecimentoAtivo.js';
import iniciarViagemTransferencia from './functions/iniciarViagemTransferencia.js';
import iniciarViagemTransporteAtivo from './functions/iniciarViagemTransporteAtivo.js';
import encerrarUsoAtivoObra from './functions/encerrarUsoAtivoObra.js';
import avancarViagem from './functions/avancarViagem.js';
import getMinhasViagens from './functions/getMinhasViagens.js';
import aprovarAbastecimentoAtivo from './functions/aprovarAbastecimentoAtivo.js';
import getOrdemServicoEmprestimo from './functions/getOrdemServicoEmprestimo.js';
import devolverEmprestimoAtivo from './functions/devolverEmprestimoAtivo.js';
import iniciarManutencaoAtivo from './functions/iniciarManutencaoAtivo.js';
import concluirManutencaoAtivo from './functions/concluirManutencaoAtivo.js';
import converterSolicitacaoEmPedido from './functions/converterSolicitacaoEmPedido.js';
import registrarRecebimentoCompra from './functions/registrarRecebimentoCompra.js';
import gerarViagemDePedidoConsolidado from './functions/gerarViagemDePedidoConsolidado.js';
import notaFiscalCriar from './functions/notaFiscalCriar.js';
import notaFiscalAnalisarIA from './functions/notaFiscalAnalisarIA.js';
import notaFiscalEditar from './functions/notaFiscalEditar.js';
import notaFiscalConfirmar from './functions/notaFiscalConfirmar.js';
import notaFiscalVincular from './functions/notaFiscalVincular.js';
import notaFiscalListar from './functions/notaFiscalListar.js';
import notaFiscalObter from './functions/notaFiscalObter.js';
import getSaldoEstoque from './functions/getSaldoEstoque.js';
import getSaldosEstoque from './functions/getSaldosEstoque.js';
import analisadorObraFinanceira from './functions/analisadorObraFinanceira.js';
import predizirCustosObraIA from './functions/predizirCustosObraIA.js';
import otimizadorCronogramaObraIA from './functions/otimizadorCronogramaObraIA.js';
import analisadorRiscosObraIA from './functions/analisadorRiscosObraIA.js';
import analisadorContratosIA from './functions/analisadorContratosIA.js';
import gerarAlertasViagemIA from './functions/gerarAlertasViagemIA.js';
import parseAssistantCommand from './functions/parseAssistantCommand.js';
import validateActionDraft from './functions/validateActionDraft.js';
import executeAssistantAction from './functions/executeAssistantAction.js';
import logAssistantAction from './functions/logAssistantAction.js';
import assistenteConsulta from './functions/assistenteConsulta.js';
import gerarSugestaoCompraAutomatica from './functions/gerarSugestaoCompraAutomatica.js';
import converterSugestaoCompra from './functions/converterSugestaoCompra.js';
import pagarContaPagar from './functions/pagarContaPagar.js';
import solicitarAprovacaoPagamento from './functions/solicitarAprovacaoPagamento.js';
import exportarContasReceber from './functions/exportarContasReceber.js';
import boletoPagar from './functions/boletoPagar.js';
import getFinanceAdvancedKPIs from './functions/getFinanceAdvancedKPIs.js';
import getAlertasExecutivos from './functions/getAlertasExecutivos.js';
import criarOrdemCompra from './functions/criarOrdemCompra.js';
import aprovarRequisicao from './functions/aprovarRequisicao.js';
import aprovarOrdemCompra from './functions/aprovarOrdemCompra.js';
import confirmarRecebimentoMaterial from './functions/confirmarRecebimentoMaterial.js';
import processarNotaFiscal from './functions/processarNotaFiscal.js';
import conciliarNFComOC from './functions/conciliarNFComOC.js';
import lancarNotaFiscalNoFinanceiro from './functions/lancarNotaFiscalNoFinanceiro.js';
import criarMedicaoObra from './functions/criarMedicaoObra.js';
import calcBM from './functions/calcBM.js';
import calcMedicao from './functions/calcMedicao.js';
import updateBMPeriodQuantities from './functions/updateBMPeriodQuantities.js';
import vincularMedicaoFinanceiro from './functions/vincularMedicaoFinanceiro.js';
import sincronizarMedicaoFinanceiro from './functions/sincronizarMedicaoFinanceiro.js';
import aprovarMedicaoObra from './functions/aprovarMedicaoObra.js';
import faturarMedicaoObra from './functions/faturarMedicaoObra.js';
import emitirNFeFocusNFe from './functions/emitirNFeFocusNFe.js';
import criarEntradaEstoqueNF from './functions/criarEntradaEstoqueNF.js';
import listarAgenda from './functions/listarAgenda.js';
import concluirEventoAgenda from './functions/concluirEventoAgenda.js';
import criarEventoAgenda from './functions/criarEventoAgenda.js';
import editarEventoAgenda from './functions/editarEventoAgenda.js';
import enviarEmailNovoEvento from './functions/enviarEmailNovoEvento.js';
import searchGlobal from './functions/searchGlobal.js';
import getTimelineObra from './functions/getTimelineObra.js';
import duplicarComposicao from './functions/duplicarComposicao.js';
import tesourariaMovimentar from './functions/tesourariaMovimentar.js';
import preverFluxoCaixaIA from './functions/preverFluxoCaixaIA.js';
import getDreObra from './functions/getDreObra.js';
import exportarDreObraCsv from './functions/exportarDreObraCsv.js';
import exportarRelatorioAvancado from './functions/exportarRelatorioAvancado.js';
import criarContaReceber from './functions/criarContaReceber.js';
import editarContaReceber from './functions/editarContaReceber.js';
import darBaixaRecebimento from './functions/darBaixaRecebimento.js';
import getConciliacaoFinanceira from './functions/getConciliacaoFinanceira.js';
import conciliarContaFinanceira from './functions/conciliarContaFinanceira.js';
import consolidarFinanceiroCompleto from './functions/consolidarFinanceiroCompleto.js';
import importarClientesOrcaFacil from './functions/importarClientesOrcaFacil.js';
import processarImportacaoPlanilha from './functions/processarImportacaoPlanilha.js';
import agendarRelatorioObra from './functions/agendarRelatorioObra.js';
import enviarRelatorioPorEmail from './functions/enviarRelatorioPorEmail.js';
import getCurvaSObra from './functions/getCurvaSObra.js';
import getFluxoCaixaObra from './functions/getFluxoCaixaObra.js';
import registrarUsoEquipamento from './functions/registrarUsoEquipamento.js';
import aprovarSolicitacaoEquipamento from './functions/aprovarSolicitacaoEquipamento.js';
import criarSolicitacaoVeiculoComContexto from './functions/criarSolicitacaoVeiculoComContexto.js';
import enviarSolicitacaoVeiculo from './functions/enviarSolicitacaoVeiculo.js';
import aprovarSolicitacaoVeiculo from './functions/aprovarSolicitacaoVeiculo.js';
import rejeitarSolicitacaoVeiculo from './functions/rejeitarSolicitacaoVeiculo.js';
import criarSolicitacaoMaquina from './functions/criarSolicitacaoMaquina.js';
import aprovarSolicitacaoMaquina from './functions/aprovarSolicitacaoMaquina.js';
import notificarSolicitacaoMaquina from './functions/notificarSolicitacaoMaquina.js';
import iniciarViagemComRastreamento from './functions/iniciarViagemComRastreamento.js';
import registrarLocalizacaoTempoReal from './functions/registrarLocalizacaoTempoReal.js';
import geocode from './functions/geocode.js';
import iniciarViagem from './functions/iniciarViagem.js';
import finalizarViagem from './functions/finalizarViagem.js';
import syncOfflineInspections from './functions/syncOfflineInspections.js';
import sincronizacaoMedicaoOffline from './functions/sincronizacaoMedicaoOffline.js';
import removerUsoEquipamento from './functions/removerUsoEquipamento.js';
import criarAtivoDeVeiculo from './functions/criarAtivoDeVeiculo.js';
import excluirVeiculoComAtivo from './functions/excluirVeiculoComAtivo.js';
import getHealthStatus from './functions/getHealthStatus.js';
import getSystemConfig from './functions/getSystemConfig.js';
import setSystemConfig from './functions/setSystemConfig.js';
import listarRuntimeErrors from './functions/listarRuntimeErrors.js';
import arquivarRuntimeErrors from './functions/arquivarRuntimeErrors.js';
import testRuntimeHealthBatch from './functions/testRuntimeHealthBatch.js';
import testarIntegridadeSistema from './functions/testarIntegridadeSistema.js';
import testarEntidadesCore from './functions/testarEntidadesCore.js';

// Registro das functions portadas do base44 (Deno → Node).
// A migração das 675 functions é incremental: cada uma vira uma entrada aqui.
// Assinatura de cada handler: async (ctx) => resultado
//   ctx = { body, user, req, res }
// O resultado é devolvido como { data: resultado } para casar com
// base44.functions.invoke, que resolve em { data, status }.
//
// Para portar uma function nova, importe-a aqui e registre no objeto `handlers`.
// Ex.:
//   import calcBM from './functions/calcBM.js';
//   const handlers = { calcBM };

export const handlers = {
  lerLogSistema,
  testarInstanciaCliente,
  finalizarImportacaoCompleta,
  getOrcamentoConsolidacaoStatus,
  diagnosticarObraCampos,
  importarOrcamentoSintetico,
  importarOrcamentoPDF,
  importarPlanilhaPrecosSINAPI,
  importarCronogramaFisFinan,
  getObraDetailsData,
  ativarObraAPartirDoOrcamento,
  gerarOCDaCotacao,
  processarRecebimentoMaterial,
  gerarContratoDoOrcamento,
  criarBMSemWizard,
  calcBMv2,
  onBMApproveWithFinance,
  retificarBM,
  recalcContratoVersao,
  processarMovimentacaoEstoque,
  atenderRequisicaoObra,
  receberTransferenciaObra,
  getDetalheFolhaPagamento,
  getTransferenciasDoDia,
  encerrarTransferenciaObra,
  gerarPagamentosTerceirizados,
  registrarEmpreita,
  calcularResumoMateriaisObra,
  listarColaboradoresObra,
  adicionarColaboradorAObra,
  removerColaboradorDaObra,
  validarInicioObra,
  simularObra,
  simularViabilidadeObra,
  calcularDREObra,
  aprovarApontamentoMaoObra,
  compararInsumosPlanejados,
  listarPendencias,
  listarContratos,
  criarContrato,
  editarContrato,
  criarMedicaoContrato,
  toggleEdicaoContrato,
  aprovarMedicaoContrato,
  salvarPedidoCompraConsolidado,
  converterSolicitacaoEmPedido,
  registrarRecebimentoCompra,
  gerarViagemDePedidoConsolidado,
  notaFiscalCriar,
  notaFiscalAnalisarIA,
  notaFiscalEditar,
  notaFiscalConfirmar,
  notaFiscalVincular,
  notaFiscalListar,
  notaFiscalObter,
  getSaldoEstoque,
  getSaldosEstoque,
  listarApontamentosHora,
  criarApontamentoHora,
  editarApontamentoHora,
  aprovarApontamentoHora,
  rejeitarApontamentoHora,
  exportarApontamentosHoraCsv,
  importarApontamentosDoDiario,
  salvarCustoHoraColaborador,
  gerarFolhaPagamento,
  getEffectivePermissionsV2,
  getMenuForBootstrap,
  getPermissoesCatalogo,
  analisadorObraFinanceira,
  predizirCustosObraIA,
  otimizadorCronogramaObraIA,
  analisadorRiscosObraIA,
  analisadorContratosIA,
  gerarAlertasViagemIA,
  parseAssistantCommand,
  validateActionDraft,
  executeAssistantAction,
  logAssistantAction,
  assistenteConsulta,
  gerarSugestaoCompraAutomatica,
  converterSugestaoCompra,
  pagarContaPagar,
  repassarVerba,
  calcularDREGlobalEmpresa,
  consolidarFinanceiroPorObra,
  consolidarResumoFinanceiro,
  solicitarEmprestimoAtivo,
  aprovarEmprestimoAtivo,
  registrarVistoriaAtivo,
  registrarAbastecimentoAtivo,
  iniciarViagemTransferencia,
  iniciarViagemTransporteAtivo,
  encerrarUsoAtivoObra,
  avancarViagem,
  getMinhasViagens,
  aprovarAbastecimentoAtivo,
  getOrdemServicoEmprestimo,
  devolverEmprestimoAtivo,
  iniciarManutencaoAtivo,
  concluirManutencaoAtivo,
  solicitarAprovacaoPagamento,
  exportarContasReceber,
  boletoPagar,
  getFinanceAdvancedKPIs,
  getAlertasExecutivos,
  criarOrdemCompra,
  aprovarRequisicao,
  aprovarOrdemCompra,
  confirmarRecebimentoMaterial,
  processarNotaFiscal,
  conciliarNFComOC,
  lancarNotaFiscalNoFinanceiro,
  criarMedicaoObra,
  calcBM,
  calcMedicao,
  updateBMPeriodQuantities,
  vincularMedicaoFinanceiro,
  sincronizarMedicaoFinanceiro,
  aprovarMedicaoObra,
  faturarMedicaoObra,
  emitirNFeFocusNFe,
  criarEntradaEstoqueNF,
  listarAgenda,
  concluirEventoAgenda,
  criarEventoAgenda,
  editarEventoAgenda,
  enviarEmailNovoEvento,
  searchGlobal,
  getTimelineObra,
  duplicarComposicao,
  tesourariaMovimentar,
  preverFluxoCaixaIA,
  getDreObra,
  exportarDreObraCsv,
  exportarRelatorioAvancado,
  criarContaReceber,
  editarContaReceber,
  darBaixaRecebimento,
  getConciliacaoFinanceira,
  conciliarContaFinanceira,
  consolidarFinanceiroCompleto,
  importarClientesOrcaFacil,
  processarImportacaoPlanilha,
  agendarRelatorioObra,
  enviarRelatorioPorEmail,
  getCurvaSObra,
  getFluxoCaixaObra,
  registrarUsoEquipamento,
  aprovarSolicitacaoEquipamento,
  criarSolicitacaoVeiculoComContexto,
  enviarSolicitacaoVeiculo,
  aprovarSolicitacaoVeiculo,
  rejeitarSolicitacaoVeiculo,
  criarSolicitacaoMaquina,
  aprovarSolicitacaoMaquina,
  notificarSolicitacaoMaquina,
  iniciarViagemComRastreamento,
  registrarLocalizacaoTempoReal,
  geocode,
  iniciarViagem,
  finalizarViagem,
  syncOfflineInspections,
  sincronizacaoMedicaoOffline,
  removerUsoEquipamento,
  criarAtivoDeVeiculo,
  excluirVeiculoComAtivo,
  getHealthStatus,
  getSystemConfig,
  setSystemConfig,
  listarRuntimeErrors,
  arquivarRuntimeErrors,
  testRuntimeHealthBatch,
  testarIntegridadeSistema,
  testarEntidadesCore,
};

const router = Router();
router.use(requireAuth);

router.post('/:name', async (req, res, next) => {
  const { name } = req.params;
  const fn = handlers[name];
  if (!fn) {
    // 404 (não 501) de propósito: o frontend foi desenhado para tratar
    // "função inexistente" com fallback gracioso (ex.: RBAC, menu, snapshots).
    // Retornar 501 quebraria esses fallbacks.
    return res.status(404).json({
      error: 'function_not_implemented',
      name,
      message: `A function "${name}" ainda não foi portada do base44.`,
    });
  }
  try {
    const data = await fn({ body: req.body || {}, user: req.user, req, res });
    if (!res.headersSent) res.json({ data });
  } catch (err) { next(err); }
});

// Diagnóstico: quais functions já estão portadas
router.get('/', requireAuth, (_req, res) => {
  res.json({ implemented: Object.keys(handlers).sort() });
});

export default router;

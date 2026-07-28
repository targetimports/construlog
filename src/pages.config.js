/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AcidenteDetalhes from './pages/AcidenteDetalhes';
import Agenda from './pages/Agenda';
import Ajuda from './pages/Ajuda';
import Ajustes from './pages/Ajustes';
import AjustesAdministracaoDados from './pages/AjustesAdministracaoDados';
import AjustesGlobais from './pages/AjustesGlobais';
import AjustesPessoais from './pages/AjustesPessoais';
import AlertasCompletos from './pages/AlertasCompletos';
import AlertasGerenciais from './pages/AlertasGerenciais';
import AlertasIA from './pages/AlertasIA';
import AlimentacaoForm from './pages/AlimentacaoForm';
import Almoxarifados from './pages/Almoxarifados';
import AluguelForm from './pages/AluguelForm';
import ApontamentoHoras from './pages/ApontamentoHoras';
import ApontamentoMateriaisSemanal from './pages/ApontamentoMateriaisSemanal';
import ApontamentosObrigatorios from './pages/ApontamentosObrigatorios';
import AprovacaoCompras from './pages/AprovacaoCompras';
import AprovacaoMaquinas from './pages/AprovacaoMaquinas';
import AprovacaoUsuarios from './pages/AprovacaoUsuarios';
import Aprovacoes from './pages/Aprovacoes';
import AprovarCompras from './pages/AprovarCompras';
import AssistenteObra from './pages/AssistenteObra';
import AssistenteOperacionalIA from './pages/AssistenteOperacionalIA';
import Ativos from './pages/Ativos';
import AtualizarPrecos from './pages/AtualizarPrecos';
import Auditoria from './pages/Auditoria';
import AuditoriaDoSistema from './pages/AuditoriaDoSistema';
import AuditoriaLogs from './pages/AuditoriaLogs';
import BI from './pages/BI';
import BMDetalhes from './pages/BMDetalhes';
import BMPlanilha from './pages/BMPlanilha';
import CalculoMedicao from './pages/CalculoMedicao';
import Calendario from './pages/Calendario';
import CategoriasConfig from './pages/CategoriasConfig';
import CategoriasFinanceiras from './pages/CategoriasFinanceiras';
import CentrosCusto from './pages/CentrosCusto';
import ChecklistQualidadeDetalhes from './pages/ChecklistQualidadeDetalhes';
import ChecklistQualidadeForm from './pages/ChecklistQualidadeForm';
import Clientes from './pages/Clientes';
import ColaboradorDetalhes from './pages/ColaboradorDetalhes';
import Colaboradores from './pages/Colaboradores';
import ColaboradoresObraGuidado from './pages/ColaboradoresObraGuidado';
import ComposicaoDetalhes from './pages/ComposicaoDetalhes';
import Composicoes from './pages/Composicoes';
import CompraDetalhes from './pages/CompraDetalhes';
import Compras from './pages/Compras';
import ComprasForm from './pages/ComprasForm';
import Concertador from './pages/Concertador';
import Conciliacao from './pages/Conciliacao';
import ConciliacaoInsumos from './pages/ConciliacaoInsumos';
import Configuracao from './pages/Configuracao';
import ConfiguracaoApontamentos from './pages/ConfiguracaoApontamentos';
import ConfiguracaoBeneficios from './pages/ConfiguracaoBeneficios';
import ConfiguracaoFluxoAprovacao from './pages/ConfiguracaoFluxoAprovacao';
import ConfiguracaoMedicoes from './pages/ConfiguracaoMedicoes';
import ConfiguracaoMenu from './pages/ConfiguracaoMenu';
import Configuracoes from './pages/Configuracoes';
import ConfiguracoesEmpresa from './pages/ConfiguracoesEmpresa';
import ConfiguracoesSistema from './pages/ConfiguracoesSistema';
import ConfirmarRecebimentoTransferencia from './pages/ConfirmarRecebimentoTransferencia';
import ConsolidadoFinanceiroV2 from './pages/ConsolidadoFinanceiroV2';
import Consultas from './pages/Consultas';
import ContasPagar from './pages/ContasPagar';
import ContasReceber from './pages/ContasReceber';
import ContratoDetalhes from './pages/ContratoDetalhes';
import ContratoForm from './pages/ContratoForm';
import ContratoVersao from './pages/ContratoVersao';
import Contratos from './pages/Contratos';
import ControleHorasAtivos from './pages/ControleHorasAtivos';
import ContratosAvancado from './pages/ContratosAvancado';
import ControleAcessoObras from './pages/ControleAcessoObras';
import ControleEPIs from './pages/ControleEPIs';
import CotacaoDetalhes from './pages/CotacaoDetalhes';
import CurvaSFluxoCaixa from './pages/CurvaSFluxoCaixa';
import CustoHoraColaboradores from './pages/CustoHoraColaboradores';
import Dashboard from './pages/Dashboard';
import DashboardAlmoxarifado from './pages/DashboardAlmoxarifado';
import DashboardCampo from './pages/DashboardCampo';
import DashboardCompras from './pages/DashboardCompras';
import DashboardEngenharia from './pages/DashboardEngenharia';
import DashboardEquipamentos from './pages/DashboardEquipamentos';
import DashboardLogistica from './pages/DashboardLogistica';
import Depositos from './pages/Depositos';
import DiarioCampo from './pages/DiarioCampo';
import DiarioObra from './pages/DiarioObra';
import DreObra from './pages/DreObra';
import EmDesenvolvimento from './pages/EmDesenvolvimento';
import Empresas from './pages/Empresas';
import Engenharia from './pages/Engenharia';
import EngenhariaeQualidade from './pages/EngenhariaeQualidade';
import Equipamentos from './pages/Equipamentos';
import Equipes from './pages/Equipes';
import EstadiasForm from './pages/EstadiasForm';
import Estoque from './pages/Estoque';
import EstoqueProfissional from './pages/EstoqueProfissional';
import EstruturaTrabajosObra from './pages/EstruturaTrabajosObra';
import ExpedientePorObra from './pages/ExpedientePorObra';
import FerramentasAdmin from './pages/FerramentasAdmin';
import Financeiro from './pages/Financeiro';
import FinanceiroAvancado from './pages/FinanceiroAvancado';
import FinanceiroEstrategico from './pages/FinanceiroEstrategico';
import FinanceiroObraAvancado from './pages/FinanceiroObraAvancado';
import FluxoCaixaProjetado from './pages/FluxoCaixaProjetado';
import FolhasPagamento from './pages/FolhasPagamento';
import Fornecedores from './pages/Fornecedores';
import FreteForm from './pages/FreteForm';
import Frota from './pages/Frota';
import FrotaVistoria from './pages/FrotaVistoria';
import FrotaVistorias from './pages/FrotaVistorias';
import GerenciadorAtalhos from './pages/GerenciadorAtalhos';
import GerenciarArquivos from './pages/GerenciarArquivos';
import GerenciarPermissoes from './pages/GerenciarPermissoes';
import GerenciarPessoasTemporarias from './pages/GerenciarPessoasTemporarias';
import GestaoDocumentos from './pages/GestaoDocumentos';
import GestaoMaoDeObra from './pages/GestaoMaoDeObra';
import GestaoObraDetalhada from './pages/GestaoObraDetalhada';
import GestaoObras from './pages/GestaoObras';
import GestaoObrasAvancada from './pages/GestaoObrasAvancada';
import GestaoUsuarios from './pages/GestaoUsuarios';
import GestorCustosViagens from './pages/GestorCustosViagens';
import Governanca from './pages/Governanca';
import GruposInsumos from './pages/GruposInsumos';
import IAMedicoes from './pages/IAMedicoes';
import IAPreditiva from './pages/IAPreditiva';
import Implementacoes from './pages/Implementacoes';
import ImportarNotaFiscal from './pages/ImportarNotaFiscal';
import ImportarOrcaFacil from './pages/ImportarOrcaFacil';
import ImportarPlanilhaFinanceira from './pages/ImportarPlanilhaFinanceira';
import ImportarSINAPI from './pages/ImportarSINAPI';
import ImpostosForm from './pages/ImpostosForm';
import InsumoForm from './pages/InsumoForm';
import Insumos from './pages/Insumos';
import Integracoes from './pages/Integracoes';
import LancamentosFinanceiros from './pages/LancamentosFinanceiros';
import LicitacaoDetalhes from './pages/LicitacaoDetalhes';
import LicitacaoForm from './pages/LicitacaoForm';
import Licitacoes from './pages/Licitacoes';
import Logistica from './pages/Logistica';
import LogisticaAvancada from './pages/LogisticaAvancada';
import Manutencoes from './pages/Manutencoes';
import MaoDeObraForm from './pages/MaoDeObraForm';
import MapaMedicoes from './pages/MapaMedicoes';
import MaterialForm from './pages/MaterialForm';
import MedicaoComOrcamento from './pages/MedicaoComOrcamento';
import MedicaoContratos from './pages/MedicaoContratos';
import MedicaoForm from './pages/MedicaoForm';
import MedicaoObraAnalitica from './pages/MedicaoObraAnalitica';
import MedicaoObraFase1 from './pages/MedicaoObraFase1';
import Medicoes from './pages/Medicoes';
import MedicoesAnalytics from './pages/MedicoesAnalytics';
import MedicoesObra from './pages/MedicoesObra';
import MinhasNotificacoes from './pages/MinhasNotificacoes';
import MinhasViagens from './pages/MinhasViagens';
import ViagensEntregas from './pages/ViagensEntregas';
import MonitoramentoViagens from './pages/MonitoramentoViagens';
import Motoristas from './pages/Motoristas';
import MovimentacoesEstoque from './pages/MovimentacoesEstoque';
import NaoConformidadeDetalhes from './pages/NaoConformidadeDetalhes';
import NaoConformidadeForm from './pages/NaoConformidadeForm';
import NotaFiscalForm from './pages/NotaFiscalForm';
import NotasFiscais from './pages/NotasFiscais';
import NovaNotaFiscal from './pages/NovaNotaFiscal';
import OCForm from './pages/OCForm';
import ObraAlimentacao from './pages/ObraAlimentacao';
import ObraAlimentacaoWrapper from './pages/ObraAlimentacaoWrapper';
import ObraAluguelCombustivel from './pages/ObraAluguelCombustivel';
import ObraAluguelCombustivelWrapper from './pages/ObraAluguelCombustivelWrapper';
import ObraBICompras from './pages/ObraBICompras';
import ObraBIComprasWrapper from './pages/ObraBIComprasWrapper';
import ObraDetalhes from './pages/ObraDetalhes';
import ObraEstadias from './pages/ObraEstadias';
import ObraEstadiasWrapper from './pages/ObraEstadiasWrapper';
import ObraForm from './pages/ObraForm';
import ObraFretes from './pages/ObraFretes';
import ObraFretesWrapper from './pages/ObraFretesWrapper';
import ObraImpostos from './pages/ObraImpostos';
import ObraImpostosWrapper from './pages/ObraImpostosWrapper';
import ObraMaoDeObra from './pages/ObraMaoDeObra';
import ObraMaoDeObraWrapper from './pages/ObraMaoDeObraWrapper';
import ObraMaterial from './pages/ObraMaterial';
import ObraMaterialWrapper from './pages/ObraMaterialWrapper';
import ObraNotasFiscais from './pages/ObraNotasFiscais';
import ObraNotasFiscaisWrapper from './pages/ObraNotasFiscaisWrapper';
import ObraPessoas from './pages/ObraPessoas';
import ObraPessoasWrapper from './pages/ObraPessoasWrapper';
import ObraResumo from './pages/ObraResumo';
import ObraResumoWrapper from './pages/ObraResumoWrapper';
import ObraRetiradas from './pages/ObraRetiradas';
import ObraRetiradasWrapper from './pages/ObraRetiradasWrapper';
import ObraWorkspace from './pages/ObraWorkspace';
import Obras from './pages/Obras';
import OpsAprovacoes from './pages/OpsAprovacoes';
import OpsCertificacao from './pages/OpsCertificacao';
import OpsConsole from './pages/OpsConsole';
import OpsMudancas from './pages/OpsMudancas';
import OpsRunbook from './pages/OpsRunbook';
import OrcamentoAnalitico from './pages/OrcamentoAnalitico';
import OrcamentoDetalhes from './pages/OrcamentoDetalhes';
import OrcamentoForm from './pages/OrcamentoForm';
import OrcamentoMedicaoGuidado from './pages/OrcamentoMedicaoGuidado';
import OrcamentoSintetico from './pages/OrcamentoSintetico';
import Orcamentos from './pages/Orcamentos';
import OrdensCompra from './pages/OrdensCompra';
import Perfis from './pages/Perfis';
import PerfisAcesso from './pages/PerfisAcesso';
import PermissoesUsuario from './pages/PermissoesUsuario';
import PermissoesUsuarioMenus from './pages/PermissoesUsuarioMenus';
import Pessoas from './pages/Pessoas';
import PoliticasEstoque from './pages/PoliticasEstoque';
import Producao from './pages/Producao';
import ProfissionaisTerceirizados from './pages/ProfissionaisTerceirizados';
import ProjetoTecnicoDetalhes from './pages/ProjetoTecnicoDetalhes';
import ProjetoTecnicoForm from './pages/ProjetoTecnicoForm';
import QaConsole from './pages/QaConsole';
import RankingMargensObra from './pages/RankingMargensObra';
import RastreamentoGPS from './pages/RastreamentoGPS';
import RateioAdministrativo from './pages/RateioAdministrativo';
import RecebimentoAlmoxarifado from './pages/RecebimentoAlmoxarifado';
import RecebimentoForm from './pages/RecebimentoForm';
import RecursosHumanos from './pages/RecursosHumanos';
import RegrasMedicao from './pages/RegrasMedicao';
import RelatorioDesempenhoProfissional from './pages/RelatorioDesempenhoProfissional';
import RelatorioRateioMaoObra from './pages/RelatorioRateioMaoObra';
import Relatorios from './pages/Relatorios';
import RelatoriosAgendados from './pages/RelatoriosAgendados';
import RelatoriosAtivos from './pages/RelatoriosAtivos';
import RelatoriosAutomaticos from './pages/RelatoriosAutomaticos';
import RelatoriosAvancados from './pages/RelatoriosAvancados';
import RelatoriosDiarioObra from './pages/RelatoriosDiarioObra';
import RelatoriosEstoqueAvancado from './pages/RelatoriosEstoqueAvancado';
import RelatoriosGerenciais from './pages/RelatoriosGerenciais';
import RelatoriosObra from './pages/RelatoriosObra';
import RelatoriosObras from './pages/RelatoriosObras';
import Resumo from './pages/Resumo';
import ResumoSistema from './pages/ResumoSistema';
import RetificarBM from './pages/RetificarBM';
import RetiradaForm from './pages/RetiradaForm';
import RevisarNotaFiscal from './pages/RevisarNotaFiscal';
import Rollbacks from './pages/Rollbacks';
import RotasMotorista from './pages/RotasMotorista';
import SST from './pages/SST';
import SaldoEstoque from './pages/SaldoEstoque';
import SaneamentoDados from './pages/SaneamentoDados';
import SaudeSistema from './pages/SaudeSistema';
import LogsSistema from './pages/LogsSistema';
import ScannerConteudoIndevido from './pages/ScannerConteudoIndevido';
import SemPermissao from './pages/SemPermissao';
import SolicitacaoDetalhes from './pages/SolicitacaoDetalhes';
import SolicitacaoDetalhesTransporte from './pages/SolicitacaoDetalhesTransporte';
import SolicitacaoEquipamentos from './pages/SolicitacaoEquipamentos';
import SolicitacaoForm from './pages/SolicitacaoForm';
import Solicitacoes from './pages/Solicitacoes';
import SolicitacoesMaquinas from './pages/SolicitacoesMaquinas';
import SolicitacoesVeiculos from './pages/SolicitacoesVeiculos';
import SolicitarCompra from './pages/SolicitarCompra';
import StatusSistema from './pages/StatusSistema';
import SugestaoCompra from './pages/SugestaoCompra';
import SupervisorOperacional from './pages/SupervisorOperacional';
import SuprimentosAvancado from './pages/SuprimentosAvancado';
import SuprimentosDashboard from './pages/SuprimentosDashboard';
import SuprimentosEntregas from './pages/SuprimentosEntregas';
import SuprimentosEstoque from './pages/SuprimentosEstoque';
import SuprimentosFornecedores from './pages/SuprimentosFornecedores';
import SuprimentosMateriais from './pages/SuprimentosMateriais';
import SuprimentosPedidos from './pages/SuprimentosPedidos';
import SuprimentosRecebimentos from './pages/SuprimentosRecebimentos';
import SuprimentosRelatorios from './pages/SuprimentosRelatorios';
import SuprimentosRequisicoes from './pages/SuprimentosRequisicoes';
import SuprimentosSolicitacoes from './pages/SuprimentosSolicitacoes';
import SuprimentosTransferencias from './pages/SuprimentosTransferencias';
import TabelaSILI from './pages/TabelaSILI';
import TabelaSINAPI from './pages/TabelaSINAPI';
import Telemetria from './pages/Telemetria';
import TelemetriaVeiculo from './pages/TelemetriaVeiculo';
import Tesouraria from './pages/Tesouraria';
import TimelineObra from './pages/TimelineObra';
import TransferenciaEstoqueObra from './pages/TransferenciaEstoqueObra';
import EmprestimosAtivos from './pages/EmprestimosAtivos';
import ManutencaoAtivos from './pages/ManutencaoAtivos';
import UsoMateriaisObra from './pages/UsoMateriaisObra';
import Usuarios from './pages/Usuarios';
import VeiculoDetalhes from './pages/VeiculoDetalhes';
import ViagensAbastecimentos from './pages/ViagensAbastecimentos';
import ViagensPorAbastecer from './pages/ViagensPorAbastecer';
import VisualizadorRotasAvancado from './pages/VisualizadorRotasAvancado';
import Volumetria from './pages/Volumetria';
import Workflows from './pages/Workflows';
import WorkflowsAvancado from './pages/WorkflowsAvancado';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AcidenteDetalhes": AcidenteDetalhes,
    "Agenda": Agenda,
    "Ajuda": Ajuda,
    "Ajustes": Ajustes,
    "AjustesAdministracaoDados": AjustesAdministracaoDados,
    "AjustesGlobais": AjustesGlobais,
    "AjustesPessoais": AjustesPessoais,
    "AlertasCompletos": AlertasCompletos,
    "AlertasGerenciais": AlertasGerenciais,
    "AlertasIA": AlertasIA,
    "AlimentacaoForm": AlimentacaoForm,
    "Almoxarifados": Almoxarifados,
    "AluguelForm": AluguelForm,
    "ApontamentoHoras": ApontamentoHoras,
    "ApontamentoMateriaisSemanal": ApontamentoMateriaisSemanal,
    "ApontamentosObrigatorios": ApontamentosObrigatorios,
    "AprovacaoCompras": AprovacaoCompras,
    "AprovacaoMaquinas": AprovacaoMaquinas,
    "AprovacaoUsuarios": AprovacaoUsuarios,
    "Aprovacoes": Aprovacoes,
    "AprovarCompras": AprovarCompras,
    "AssistenteObra": AssistenteObra,
    "AssistenteOperacionalIA": AssistenteOperacionalIA,
    "Ativos": Ativos,
    "AtualizarPrecos": AtualizarPrecos,
    "Auditoria": Auditoria,
    "AuditoriaDoSistema": AuditoriaDoSistema,
    "AuditoriaLogs": AuditoriaLogs,
    "BI": BI,
    "BMDetalhes": BMDetalhes,
    "BMPlanilha": BMPlanilha,
    "CalculoMedicao": CalculoMedicao,
    "Calendario": Calendario,
    "CategoriasConfig": CategoriasConfig,
    "CategoriasFinanceiras": CategoriasFinanceiras,
    "CentrosCusto": CentrosCusto,
    "ChecklistQualidadeDetalhes": ChecklistQualidadeDetalhes,
    "ChecklistQualidadeForm": ChecklistQualidadeForm,
    "Clientes": Clientes,
    "ColaboradorDetalhes": ColaboradorDetalhes,
    "Colaboradores": Colaboradores,
    "ColaboradoresObraGuidado": ColaboradoresObraGuidado,
    "ComposicaoDetalhes": ComposicaoDetalhes,
    "Composicoes": Composicoes,
    "CompraDetalhes": CompraDetalhes,
    "Compras": Compras,
    "ComprasForm": ComprasForm,
    "Concertador": Concertador,
    "Conciliacao": Conciliacao,
    "ConciliacaoInsumos": ConciliacaoInsumos,
    "Configuracao": Configuracao,
    "ConfiguracaoApontamentos": ConfiguracaoApontamentos,
    "ConfiguracaoBeneficios": ConfiguracaoBeneficios,
    "ConfiguracaoFluxoAprovacao": ConfiguracaoFluxoAprovacao,
    "ConfiguracaoMedicoes": ConfiguracaoMedicoes,
    "ConfiguracaoMenu": ConfiguracaoMenu,
    "Configuracoes": Configuracoes,
    "ConfiguracoesEmpresa": ConfiguracoesEmpresa,
    "ConfiguracoesSistema": ConfiguracoesSistema,
    "ConfirmarRecebimentoTransferencia": ConfirmarRecebimentoTransferencia,
    "ConsolidadoFinanceiroV2": ConsolidadoFinanceiroV2,
    "Consultas": Consultas,
    "ContasPagar": ContasPagar,
    "ContasReceber": ContasReceber,
    "ContratoDetalhes": ContratoDetalhes,
    "ContratoForm": ContratoForm,
    "ContratoVersao": ContratoVersao,
    "Contratos": Contratos,
    "ControleHorasAtivos": ControleHorasAtivos,
    "ContratosAvancado": ContratosAvancado,
    "ControleAcessoObras": ControleAcessoObras,
    "ControleEPIs": ControleEPIs,
    "CotacaoDetalhes": CotacaoDetalhes,
    "CurvaSFluxoCaixa": CurvaSFluxoCaixa,
    "CustoHoraColaboradores": CustoHoraColaboradores,
    "Dashboard": Dashboard,
    "DashboardAlmoxarifado": DashboardAlmoxarifado,
    "DashboardCampo": DashboardCampo,
    "DashboardCompras": DashboardCompras,
    "DashboardEngenharia": DashboardEngenharia,
    "DashboardEquipamentos": DashboardEquipamentos,
    "DashboardLogistica": DashboardLogistica,
    "Depositos": Depositos,
    "DiarioCampo": DiarioCampo,
    "DiarioObra": DiarioObra,
    "DreObra": DreObra,
    "EmDesenvolvimento": EmDesenvolvimento,
    "Empresas": Empresas,
    "Engenharia": Engenharia,
    "EngenhariaeQualidade": EngenhariaeQualidade,
    "Equipamentos": Equipamentos,
    "Equipes": Equipes,
    "EstadiasForm": EstadiasForm,
    "Estoque": Estoque,
    "EstoqueProfissional": EstoqueProfissional,
    "EstruturaTrabajosObra": EstruturaTrabajosObra,
    "ExpedientePorObra": ExpedientePorObra,
    "FerramentasAdmin": FerramentasAdmin,
    "Financeiro": Financeiro,
    "FinanceiroAvancado": FinanceiroAvancado,
    "FinanceiroEstrategico": FinanceiroEstrategico,
    "FinanceiroObraAvancado": FinanceiroObraAvancado,
    "FluxoCaixaProjetado": FluxoCaixaProjetado,
    "FolhasPagamento": FolhasPagamento,
    "Fornecedores": Fornecedores,
    "FreteForm": FreteForm,
    "Frota": Frota,
    "FrotaVistoria": FrotaVistoria,
    "FrotaVistorias": FrotaVistorias,
    "GerenciadorAtalhos": GerenciadorAtalhos,
    "GerenciarArquivos": GerenciarArquivos,
    "GerenciarPermissoes": GerenciarPermissoes,
    "GerenciarPessoasTemporarias": GerenciarPessoasTemporarias,
    "GestaoDocumentos": GestaoDocumentos,
    "GestaoMaoDeObra": GestaoMaoDeObra,
    "GestaoObraDetalhada": GestaoObraDetalhada,
    "GestaoObras": GestaoObras,
    "GestaoObrasAvancada": GestaoObrasAvancada,
    "GestaoUsuarios": GestaoUsuarios,
    "GestorCustosViagens": GestorCustosViagens,
    "Governanca": Governanca,
    "GruposInsumos": GruposInsumos,
    "IAMedicoes": IAMedicoes,
    "IAPreditiva": IAPreditiva,
    "Implementacoes": Implementacoes,
    "ImportarNotaFiscal": ImportarNotaFiscal,
    "ImportarOrcaFacil": ImportarOrcaFacil,
    "ImportarPlanilhaFinanceira": ImportarPlanilhaFinanceira,
    "ImportarSINAPI": ImportarSINAPI,
    "ImpostosForm": ImpostosForm,
    "InsumoForm": InsumoForm,
    "Insumos": Insumos,
    "Integracoes": Integracoes,
    "LancamentosFinanceiros": LancamentosFinanceiros,
    "LicitacaoDetalhes": LicitacaoDetalhes,
    "LicitacaoForm": LicitacaoForm,
    "Licitacoes": Licitacoes,
    "Logistica": Logistica,
    "LogisticaAvancada": LogisticaAvancada,
    "Manutencoes": Manutencoes,
    "MaoDeObraForm": MaoDeObraForm,
    "MapaMedicoes": MapaMedicoes,
    "MaterialForm": MaterialForm,
    "MedicaoComOrcamento": MedicaoComOrcamento,
    "MedicaoContratos": MedicaoContratos,
    "MedicaoForm": MedicaoForm,
    "MedicaoObraAnalitica": MedicaoObraAnalitica,
    "MedicaoObraFase1": MedicaoObraFase1,
    "Medicoes": Medicoes,
    "MedicoesAnalytics": MedicoesAnalytics,
    "MedicoesObra": MedicoesObra,
    "MinhasNotificacoes": MinhasNotificacoes,
    "MinhasViagens": MinhasViagens,
    "ViagensEntregas": ViagensEntregas,
    "MonitoramentoViagens": MonitoramentoViagens,
    "Motoristas": Motoristas,
    "MovimentacoesEstoque": MovimentacoesEstoque,
    "NaoConformidadeDetalhes": NaoConformidadeDetalhes,
    "NaoConformidadeForm": NaoConformidadeForm,
    "NotaFiscalForm": NotaFiscalForm,
    "NotasFiscais": NotasFiscais,
    "NovaNotaFiscal": NovaNotaFiscal,
    "OCForm": OCForm,
    "ObraAlimentacao": ObraAlimentacao,
    "ObraAlimentacaoWrapper": ObraAlimentacaoWrapper,
    "ObraAluguelCombustivel": ObraAluguelCombustivel,
    "ObraAluguelCombustivelWrapper": ObraAluguelCombustivelWrapper,
    "ObraBICompras": ObraBICompras,
    "ObraBIComprasWrapper": ObraBIComprasWrapper,
    "ObraDetalhes": ObraDetalhes,
    "ObraEstadias": ObraEstadias,
    "ObraEstadiasWrapper": ObraEstadiasWrapper,
    "ObraForm": ObraForm,
    "ObraFretes": ObraFretes,
    "ObraFretesWrapper": ObraFretesWrapper,
    "ObraImpostos": ObraImpostos,
    "ObraImpostosWrapper": ObraImpostosWrapper,
    "ObraMaoDeObra": ObraMaoDeObra,
    "ObraMaoDeObraWrapper": ObraMaoDeObraWrapper,
    "ObraMaterial": ObraMaterial,
    "ObraMaterialWrapper": ObraMaterialWrapper,
    "ObraNotasFiscais": ObraNotasFiscais,
    "ObraNotasFiscaisWrapper": ObraNotasFiscaisWrapper,
    "ObraPessoas": ObraPessoas,
    "ObraPessoasWrapper": ObraPessoasWrapper,
    "ObraResumo": ObraResumo,
    "ObraResumoWrapper": ObraResumoWrapper,
    "ObraRetiradas": ObraRetiradas,
    "ObraRetiradasWrapper": ObraRetiradasWrapper,
    "ObraWorkspace": ObraWorkspace,
    "Obras": Obras,
    "OpsAprovacoes": OpsAprovacoes,
    "OpsCertificacao": OpsCertificacao,
    "OpsConsole": OpsConsole,
    "OpsMudancas": OpsMudancas,
    "OpsRunbook": OpsRunbook,
    "OrcamentoAnalitico": OrcamentoAnalitico,
    "OrcamentoDetalhes": OrcamentoDetalhes,
    "OrcamentoForm": OrcamentoForm,
    "OrcamentoMedicaoGuidado": OrcamentoMedicaoGuidado,
    "OrcamentoSintetico": OrcamentoSintetico,
    "Orcamentos": Orcamentos,
    "OrdensCompra": OrdensCompra,
    "Perfis": Perfis,
    "PerfisAcesso": PerfisAcesso,
    "PermissoesUsuario": PermissoesUsuario,
    "PermissoesUsuarioMenus": PermissoesUsuarioMenus,
    "Pessoas": Pessoas,
    "PoliticasEstoque": PoliticasEstoque,
    "Producao": Producao,
    "ProfissionaisTerceirizados": ProfissionaisTerceirizados,
    "ProjetoTecnicoDetalhes": ProjetoTecnicoDetalhes,
    "ProjetoTecnicoForm": ProjetoTecnicoForm,
    "QaConsole": QaConsole,
    "RankingMargensObra": RankingMargensObra,
    "RastreamentoGPS": RastreamentoGPS,
    "RateioAdministrativo": RateioAdministrativo,
    "RecebimentoAlmoxarifado": RecebimentoAlmoxarifado,
    "RecebimentoForm": RecebimentoForm,
    "RecursosHumanos": RecursosHumanos,
    "RegrasMedicao": RegrasMedicao,
    "RelatorioDesempenhoProfissional": RelatorioDesempenhoProfissional,
    "RelatorioRateioMaoObra": RelatorioRateioMaoObra,
    "Relatorios": Relatorios,
    "RelatoriosAgendados": RelatoriosAgendados,
    "RelatoriosAtivos": RelatoriosAtivos,
    "RelatoriosAutomaticos": RelatoriosAutomaticos,
    "RelatoriosAvancados": RelatoriosAvancados,
    "RelatoriosDiarioObra": RelatoriosDiarioObra,
    "RelatoriosEstoqueAvancado": RelatoriosEstoqueAvancado,
    "RelatoriosGerenciais": RelatoriosGerenciais,
    "RelatoriosObra": RelatoriosObra,
    "RelatoriosObras": RelatoriosObras,
    "Resumo": Resumo,
    "ResumoSistema": ResumoSistema,
    "RetificarBM": RetificarBM,
    "RetiradaForm": RetiradaForm,
    "RevisarNotaFiscal": RevisarNotaFiscal,
    "Rollbacks": Rollbacks,
    "RotasMotorista": RotasMotorista,
    "SST": SST,
    "SaldoEstoque": SaldoEstoque,
    "SaneamentoDados": SaneamentoDados,
    "SaudeSistema": SaudeSistema,
    "LogsSistema": LogsSistema,
    "ScannerConteudoIndevido": ScannerConteudoIndevido,
    "SemPermissao": SemPermissao,
    "SolicitacaoDetalhes": SolicitacaoDetalhes,
    "SolicitacaoDetalhesTransporte": SolicitacaoDetalhesTransporte,
    "SolicitacaoEquipamentos": SolicitacaoEquipamentos,
    "SolicitacaoForm": SolicitacaoForm,
    "Solicitacoes": Solicitacoes,
    "SolicitacoesMaquinas": SolicitacoesMaquinas,
    "SolicitacoesVeiculos": SolicitacoesVeiculos,
    "SolicitarCompra": SolicitarCompra,
    "StatusSistema": StatusSistema,
    "SugestaoCompra": SugestaoCompra,
    "SupervisorOperacional": SupervisorOperacional,
    "SuprimentosAvancado": SuprimentosAvancado,
    "SuprimentosDashboard": SuprimentosDashboard,
    "SuprimentosEntregas": SuprimentosEntregas,
    "SuprimentosEstoque": SuprimentosEstoque,
    "SuprimentosFornecedores": SuprimentosFornecedores,
    "SuprimentosMateriais": SuprimentosMateriais,
    "SuprimentosPedidos": SuprimentosPedidos,
    "SuprimentosRecebimentos": SuprimentosRecebimentos,
    "SuprimentosRelatorios": SuprimentosRelatorios,
    "SuprimentosRequisicoes": SuprimentosRequisicoes,
    "SuprimentosSolicitacoes": SuprimentosSolicitacoes,
    "SuprimentosTransferencias": SuprimentosTransferencias,
    "TabelaSILI": TabelaSILI,
    "TabelaSINAPI": TabelaSINAPI,
    "Telemetria": Telemetria,
    "TelemetriaVeiculo": TelemetriaVeiculo,
    "Tesouraria": Tesouraria,
    "TimelineObra": TimelineObra,
    "TransferenciaEstoqueObra": TransferenciaEstoqueObra,
    "EmprestimosAtivos": EmprestimosAtivos,
    "ManutencaoAtivos": ManutencaoAtivos,
    "UsoMateriaisObra": UsoMateriaisObra,
    "Usuarios": Usuarios,
    "VeiculoDetalhes": VeiculoDetalhes,
    "ViagensAbastecimentos": ViagensAbastecimentos,
    "ViagensPorAbastecer": ViagensPorAbastecer,
    "VisualizadorRotasAvancado": VisualizadorRotasAvancado,
    "Volumetria": Volumetria,
    "Workflows": Workflows,
    "WorkflowsAvancado": WorkflowsAvancado,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};

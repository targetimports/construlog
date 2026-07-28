import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import { 
  ArrowLeft, 
  Save, 
  Building2,
  User,
  MapPin,
  Calendar,
  DollarSign,
  Eye,
  Settings,
  Package,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { useEmpresa } from '@/components/shared/useEmpresaContext';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { garantirAcessoColaborador } from '@/components/shared/acessoColaborador';
import { useEmpresaAtiva } from '@/components/shared/useEmpresaAtiva';
import GarantiaSection from '@/components/obra/GarantiaSection';
import ValidacaoInicioObraDialog from '@/components/obra/ValidacaoInicioObraDialog';
import { TableSkeleton } from '@/components/shared/Skeletons';

export default function ObraForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const obraId = urlParams.get('id');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [etapaAtual, setEtapaAtual] = useState(0);
  // Erros por campo (aviso inline + borda vermelha nos campos obrigatórios).
  const [errors, setErrors] = useState({});
  const { enderecoCompleto } = useEmpresaAtiva();

  // Etapas: índices 0-6
  const etapas = [
    { titulo: 'Dados da Obra',        icone: Building2 },  // 0
    { titulo: 'Cliente / Contratante', icone: User },       // 1
    { titulo: 'Responsáveis',          icone: User },       // 2
    { titulo: 'Materiais',             icone: Package },    // 3
    { titulo: 'Localização',           icone: MapPin },     // 4
    { titulo: 'Cronograma e Valores',  icone: DollarSign }, // 5
  ];

  const [formData, setFormData] = useState({
    codigo: '',
    nome: '',
    empresa_id: '',
    tipo: 'privada',
    tipo_obra: '',
    status: 'orcamento',
    cliente: '',
    orgao_publico: '',
    contrato_numero: '',
    art: '',
    cei_cno: '',
    area_total: '',
    // Localização — campos separados
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    responsavel_tecnico: [],
    responsavel_obra: [],
    responsavel_administrativo: [],
    responsavel_financeiro: [],
    equipes_vinculadas: [],
    colaborador_ids: [],
    materiais: [],
    centro_custo: '',
    data_inicio: '',
    data_prevista_fim: '',
    valor_contrato: '',
    valor_orcado: '',
    descricao: '',
    observacoes: '',
    visivel_para: [],
    garantia_tipo: 'anos',
    garantia_valor: 5,
    exibir_em: {
      lancamentos: true,
      faturamentos: true,
      compras: true
    }
  });

  // Multi-empresa: matriz escolhe a empresa dona da obra; membro fica fixo na sua.
  const { membros: empresasMembro, acessoGlobal: ehMatriz, empresaId: minhaEmpresaId } = useEmpresa();
  useEffect(() => {
    if (!ehMatriz && minhaEmpresaId) {
      setFormData((f) => (f.empresa_id ? f : { ...f, empresa_id: minhaEmpresaId }));
    }
  }, [ehMatriz, minhaEmpresaId]);

  // Itens do orçamento para etapa Materiais
  const [itensOrcamento, setItensOrcamento] = useState([]);
  const [itensOrcamentoLoading, setItensOrcamentoLoading] = useState(false);
  const [itensOrcamentoErro, setItensOrcamentoErro] = useState(null);
  const [orcamentoId, setOrcamentoId] = useState(null);

  const [tipoOrcamento, setTipoOrcamento] = useState(null); // 'sintetico' | 'analitico' | null

  // Importação de orçamento (planilha) — guardado até salvar a obra (precisa do obra_id)
  const fileInputRef = useRef(null);
  const orcamentoImportadoRef = useRef(null);
  const [orcamentoImportado, setOrcamentoImportado] = useState(false);
  const [pagMateriais, setPagMateriais] = useState(1);
  const POR_PAGINA_MAT = 15;

  // Validação de início de obra
  const [validacaoInicioOpen, setValidacaoInicioOpen] = useState(false);
  const [validacaoResultado, setValidacaoResultado] = useState(null);
  const [validacaoLoading, setValidacaoLoading] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState(null);

  useEffect(() => {
    if (etapaAtual !== 3 || !obraId) return;
    const carregar = async () => {
      setItensOrcamentoLoading(true);
      setItensOrcamentoErro(null);
      setTipoOrcamento(null);
      try {
        // 1) Buscar orçamento vinculado à obra (por obra_id)
        const orcamentos = await base44.entities.Orcamento.filter({ obra_id: obraId });
        const orc = orcamentos?.[0] || null;
        setOrcamentoId(orc?.id || null);

        if (!orc) {
          // Sem orçamento nenhum
          setItensOrcamento([]);
          setTipoOrcamento(null);
          return;
        }

        // 2) Buscar itens do orçamento pela obra_id (fonte de verdade)
        const itens = await base44.entities.ItemOrcamento.filter({ obra_id: obraId });
        setItensOrcamento(itens || []);

        // 3) Determinar tipo: se tem composições de insumos = analítico, senão = sintético
        const composicoes = await base44.entities.ComposicaoInsumo.filter({ orcamento_id: orc.id }).catch(() => []);
        setTipoOrcamento(composicoes.length > 0 ? 'analitico' : 'sintetico');
      } catch (err) {
        console.error('[ObraForm] Erro ao carregar itens do orçamento:', { obraId, err });
        setItensOrcamentoErro('Não foi possível carregar os materiais desta obra.');
      } finally {
        setItensOrcamentoLoading(false);
      }
    };
    carregar();
  }, [etapaAtual, obraId]);

  const { data: obra, isLoading } = useQuery({
    queryKey: ['obra', obraId],
    queryFn: () => base44.entities.Obra.filter({ id: obraId }),
    enabled: !!obraId
  });

  // Gerar código único automático para nova obra
  useEffect(() => {
    if (obraId) return;
    const ano = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-5);
    const codigoGerado = `OBR-${ano}-${timestamp}`;
    setFormData(prev => ({ ...prev, codigo: codigoGerado }));
  }, [obraId]);

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list()
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list()
  });

  // Ao EDITAR: carrega a equipe já vinculada (ObraColaborador ativos) para os chips.
  const { data: obraColaboradores = [] } = useQuery({
    queryKey: ['obra-colaboradores', obraId],
    queryFn: () => base44.entities.ObraColaborador.filter({ obra_id: obraId }),
    enabled: !!obraId,
  });
  useEffect(() => {
    if (!obraId) return;
    const ativos = (obraColaboradores || []).filter((oc) => oc.status !== 'inativo' && oc.colaborador_id);
    setFormData((f) => ({ ...f, colaborador_ids: ativos.map((oc) => `colab_${oc.colaborador_id}`) }));
  }, [obraId, obraColaboradores]);

  const { data: permissoes = [] } = useQuery({
    queryKey: ['permissoes-usuarios'],
    queryFn: () => base44.entities.PermissaoUsuario.list()
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list()
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ['materiais'],
    queryFn: () => base44.entities.Material.list()
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ['equipes'],
    queryFn: () => base44.entities.Equipe.list()
  });

  const [novoCliente, setNovoCliente] = useState(false);
  const [criarNovoColaborador, setCriarNovoColaborador] = useState(false);
  const [novoColaboradorData, setNovoColaboradorData] = useState({
    nome: '',
    cpf: '',
    cargo: 'administrativo',
    email: '',
    telefone: ''
  });

  const obterFuncaoUsuario = (usuario) => {
    if (usuario.role === 'admin') return 'Administrador';
    const permissao = permissoes.find(p => p.user_email === usuario.email);
    if (!permissao) return 'Usuário';
    const funcoes = [];
    if (permissao.engenheiro) funcoes.push('Engenheiro');
    if (permissao.mestre_obras) funcoes.push('Mestre de Obras');
    if (permissao.administrativo) funcoes.push('Administrativo');
    if (permissao.financeiro) funcoes.push('Financeiro');
    if (permissao.compras) funcoes.push('Compras');
    if (permissao.motorista) funcoes.push('Motorista');
    if (permissao.estoquista) funcoes.push('Estoquista');
    if (permissao.almoxarife) funcoes.push('Almoxarife');
    return funcoes.length > 0 ? funcoes.join(', ') : 'Usuário';
  };

  // Normaliza cargo/função (texto livre) para uma chave canônica de papel.
  const normalizeRole = (s) => {
    const v = String(s || '').toLowerCase();
    if (v.includes('mestre')) return 'mestre_obras';
    if (v.includes('financ')) return 'financeiro';
    if (v.includes('administrativ')) return 'administrativo';
    if (v.includes('engenh')) return 'engenheiro';
    if (v.includes('compra')) return 'compras';
    if (v.includes('encarregad')) return 'encarregado';
    if (v.includes('rh') || v.includes('pessoal')) return 'rh';
    if (v === 'admin' || v.includes('administrador') || v === 'programador' || v === 'ti') return 'admin';
    return v;
  };

  // Papéis de um usuário: permissões marcadas + a ROLE de login (RBAC). Antes só
  // olhava as permissões (que estão zeradas no cadastro), então usuário nenhum
  // casava com os filtros de responsável — e os campos ficavam vazios.
  const rolesDoUsuario = (u) => {
    const permissao = permissoes.find(p => p.user_email === u.email);
    const roles = [];
    if (permissao) {
      if (permissao.engenheiro) roles.push('engenheiro');
      if (permissao.mestre_obras) roles.push('mestre_obras');
      if (permissao.administrativo) roles.push('administrativo');
      if (permissao.financeiro) roles.push('financeiro');
      if (permissao.compras) roles.push('compras');
    }
    if (u.role) roles.push(normalizeRole(u.role)); // role do RBAC (admin, financeiro, rh...)
    if (u.cargo) roles.push(normalizeRole(u.cargo));
    return [...new Set(roles)];
  };

  const pessoasCadastradas = [
    ...usuarios.map(u => ({
      value: u.full_name,
      label: `${u.full_name} (${obterFuncaoUsuario(u)})`,
      type: 'usuario',
      roles: rolesDoUsuario(u),
    })),
    ...colaboradores.map(c => ({
      value: c.nome,
      label: `${c.nome} (${c.cargo})`,
      type: 'colaborador',
      roles: [normalizeRole(c.cargo)],
    }))
  ];

  const handleCriarColaborador = async () => {
    if (!novoColaboradorData.nome || !novoColaboradorData.cargo) {
      toast.error('Nome e cargo são obrigatórios');
      return;
    }
    try {
      const novo = await base44.entities.Colaborador.create(novoColaboradorData);
      // Regra-mãe: tornar o colaborador um usuário do sistema (se tiver e-mail + CPF)
      const acesso = await garantirAcessoColaborador({ ...novoColaboradorData, id: novo?.id });
      queryClient.invalidateQueries({ queryKey: ['colaboradores'] });
      if (acesso.status === 'criado') {
        queryClient.invalidateQueries({ queryKey: ['usuarios'] });
        toast.success('Colaborador e acesso de usuário criados (senha inicial = CPF).');
      } else {
        toast.success('Colaborador criado com sucesso!');
      }
      setCriarNovoColaborador(false);
      setNovoColaboradorData({ nome: '', cpf: '', cargo: 'administrativo', email: '', telefone: '' });
    } catch (error) {
      toast.error('Erro ao criar colaborador: ' + error.message);
    }
  };

  const adicionarResponsavel = (campo, pessoa) => {
    const listaAtual = Array.isArray(formData[campo]) ? formData[campo] : [];
    if (!listaAtual.includes(pessoa)) {
      handleChange(campo, [...listaAtual, pessoa]);
    }
  };

  const removerResponsavel = (campo, pessoa) => {
    const listaAtual = Array.isArray(formData[campo]) ? formData[campo] : [];
    handleChange(campo, listaAtual.filter(p => p !== pessoa));
  };

  // Prefill ao carregar obra para edição
  useEffect(() => {
    if (obra && obra.length > 0) {
      const d = obra[0];

      // Resolver endereço: pode estar em d.endereco (string) ou campos separados
      const resolveEndereco = () => {
        // Preferir campo direto 'endereco'; fallback para campos compostos
        return d.endereco || d.endereco_rua || d.logradouro || d.rua || enderecoCompleto || '';
      };
      const resolveCep = () => d.cep || d.zip || d.endereco_cep || '';
      const resolveCidade = () => d.cidade || d.endereco_cidade || '';
      const resolveEstado = () => d.estado || d.endereco_estado || '';

      setFormData({
        codigo: d.codigo || '',
        nome: d.nome || '',
        empresa_id: d.empresa_id || '',
        tipo: d.tipo || 'privada',
        tipo_obra: d.tipo_obra || '',
        status: d.status || 'orcamento',
        cliente: d.cliente || '',
        orgao_publico: d.orgao_publico || '',
        contrato_numero: d.contrato_numero || '',
        art: d.art || '',
        cei_cno: d.cei_cno || '',
        area_total: d.area_total || '',
        endereco: resolveEndereco(),
        cidade: resolveCidade(),
        estado: resolveEstado(),
        cep: resolveCep(),
        responsavel_tecnico: Array.isArray(d.responsavel_tecnico) ? d.responsavel_tecnico : (d.responsavel_tecnico ? [d.responsavel_tecnico] : []),
        responsavel_obra: Array.isArray(d.responsavel_obra) ? d.responsavel_obra : (d.responsavel_obra ? [d.responsavel_obra] : []),
        responsavel_administrativo: Array.isArray(d.responsavel_administrativo) ? d.responsavel_administrativo : (d.responsavel_administrativo ? [d.responsavel_administrativo] : []),
        responsavel_financeiro: Array.isArray(d.responsavel_financeiro) ? d.responsavel_financeiro : (d.responsavel_financeiro ? [d.responsavel_financeiro] : []),
        equipes_vinculadas: d.equipes_vinculadas || [],
        colaborador_ids: [], // preenchido pela query de ObraColaborador (efeito abaixo)
        materiais: d.materiais || [],
        centro_custo: d.centro_custo || '',
        data_inicio: d.data_inicio || '',
        data_prevista_fim: d.data_prevista_fim || '',
        valor_contrato: d.valor_contrato || '',
        valor_orcado: d.valor_orcado || '',
        descricao: d.descricao || '',
        observacoes: d.observacoes || '',
        visivel_para: d.visivel_para || [],
        garantia_tipo: d.garantia_tipo || 'anos',
        garantia_valor: d.garantia_valor || 5,
        exibir_em: d.exibir_em || { lancamentos: true, faturamentos: true, compras: true }
      });
      // Não avançar automaticamente para a última etapa
      setEtapaAtual(0);
    }
  }, [obra]);

  // Converte "1.234,56" / "1234.56" / "R$ 1.234,56" em número.
  const parseNumero = (v) => {
    if (typeof v === 'number') return v;
    let s = String(v ?? '').replace(/[^\d.,-]/g, '').trim();
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); // pt-BR
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };

  // Importa uma planilha de orçamento (.xlsx/.xls/.csv) e guarda os itens para
  // serem persistidos ao salvar a obra.
  const handleImportarOrcamento = async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const linhas = XLSX.utils.sheet_to_json(ws, { defval: '' });

      // Ignora linhas de assinatura/identificação da empresa (CNPJ, CREA, sócio...)
      // que aparecem no rodapé da planilha e não são itens do orçamento.
      const ehLinhaNaoItem = (desc) => {
        const d = String(desc || '');
        if (d.replace(/[_\-.\s]/g, '').length < 3) return true;
        return /\bCNPJ\b|\bC\.?P\.?F\b|\bCREA\b|\bSSP\b|\bRG\s*\d|S[ÓO]CIO|ADMINISTRADOR|ENGENHEIRO\s+CIVIL|RESPONS[ÁA]VEL\s+T[ÉE]CNICO|ASSINATURA/i.test(d);
      };
      const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
      const pegar = (row, ...chaves) => {
        for (const k of Object.keys(row)) {
          const nk = norm(k);
          if (chaves.some((c) => nk.includes(c))) return row[k];
        }
        return '';
      };

      const itens = linhas.map((row) => ({
        codigo: String(pegar(row, 'codigo', 'cod') || '').trim(),
        descricao: String(pegar(row, 'descri', 'servico', 'serviço', 'especifica', 'item') || '').trim(),
        unidade: String(pegar(row, 'unid', 'und', 'unidade', 'un') || '').trim(),
        quantidade: parseNumero(pegar(row, 'quant', 'qtd', 'qtde')),
        custo_unitario: parseNumero(pegar(row, 'valor unit', 'custo unit', 'preco unit', 'preço unit', 'vlr unit', 'unitario', 'unitário', 'valor', 'custo', 'preco', 'preço')),
      }))
        .filter((i) => i.descricao && !ehLinhaNaoItem(i.descricao))
        // Mantém os dois padrões de nome de campo usados no sistema
        // (etapa 4 lê custo_unitario; OrçaFascio/relatórios leem valor_unitario/valor_total).
        .map((i) => ({ ...i, valor_unitario: i.custo_unitario, valor_total: (i.quantidade || 0) * (i.custo_unitario || 0) }));

      if (itens.length === 0) {
        toast.error('Não encontrei itens na planilha. Verifique se há colunas de descrição, unidade, quantidade e valor unitário.');
        return;
      }

      const valorTotal = itens.reduce((acc, i) => acc + (i.quantidade || 0) * (i.custo_unitario || 0), 0);
      orcamentoImportadoRef.current = {
        nome: file.name.replace(/\.[^.]+$/, ''),
        valor_total: valorTotal,
        itens,
      };
      // Mostra os itens na tabela (preview) — serão salvos ao concluir.
      setItensOrcamento(itens);
      setTipoOrcamento('sintetico');
      setOrcamentoImportado(true);
      setItensOrcamentoErro(null);
      toast.success(`${itens.length} itens importados. Serão salvos ao concluir a obra.`);
    } catch (err) {
      console.error('[ObraForm] erro ao importar planilha:', err);
      toast.error('Falha ao ler a planilha. Use um arquivo .xlsx, .xls ou .csv válido.');
    }
  };

  // Cria o Orcamento + ItemOrcamento vinculados à obra (após ter o obra_id).
  const persistirOrcamentoImportado = async (obraIdAlvo) => {
    const imp = orcamentoImportadoRef.current;
    if (!imp || !imp.itens?.length || !obraIdAlvo) return;
    const orc = await base44.entities.Orcamento.create({
      obra_id: obraIdAlvo,
      nome: imp.nome || `Orçamento - ${formData.nome || 'Obra'}`,
      valor_total: imp.valor_total || 0,
      total_orcamento: imp.valor_total || 0,
      total_final_orcamento: imp.valor_total || 0,
      tipo: 'sintetico',
      status: 'ativo',
      origem: 'importacao_planilha',
    });
    const itens = imp.itens.map((it) => ({ ...it, obra_id: obraIdAlvo, orcamento_id: orc.id }));
    for (let i = 0; i < itens.length; i += 200) {
      await base44.entities.ItemOrcamento.bulkCreate(itens.slice(i, i + 200));
    }
    orcamentoImportadoRef.current = null;
  };

  // Vincula a equipe (colaborador_ids) à obra como ObraColaborador — é o que faz o
  // colaborador aparecer no Ponto/Equipe. Adiciona os novos (dedup no backend) e,
  // na edição, inativa os que foram removidos dos chips.
  const sincronizarEquipeObra = async (obraIdAlvo, data) => {
    const idsFinais = (data.colaborador_ids || []).map((id) => String(id).replace(/^colab_/, '')).filter(Boolean);
    for (const cid of idsFinais) {
      await base44.functions.invoke('adicionarColaboradorAObra', { obra_id: obraIdAlvo, colaborador_id: cid }).catch(() => {});
    }
    // Remoções só valem na edição (na criação não há vínculo anterior).
    const atuais = (obraColaboradores || []).filter((oc) => oc.status !== 'inativo' && oc.colaborador_id);
    for (const oc of atuais) {
      if (!idsFinais.includes(String(oc.colaborador_id))) {
        await base44.entities.ObraColaborador.update(oc.id, { status: 'inativo' }).catch(() => {});
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      const novaObra = await base44.entities.Obra.create(data);
      await persistirOrcamentoImportado(novaObra.id);
      await sincronizarEquipeObra(novaObra.id, data);
      await base44.entities.HistoricoObra.create({
        obra_id: novaObra.id,
        usuario: user.email,
        tipo_alteracao: 'criacao',
        descricao: `Obra "${data.nome}" criada`,
        data_hora: new Date().toISOString()
      });

      // Criar eventos no calendário para datas da obra
      if (data.data_inicio) {
        await base44.entities.CalendarEvent.create({
          title: `[INÍCIO] ${data.nome}`,
          description: `Início da obra: ${data.nome}`,
          start_date: new Date(data.data_inicio).toISOString(),
          end_date: new Date(data.data_inicio).toISOString(),
          obra_id: novaObra.id,
          event_type: 'obra_inicio',
          color: '#3B82F6'
        });
      }

      if (data.data_prevista_fim) {
        await base44.entities.CalendarEvent.create({
          title: `[TÉRMINO] ${data.nome}`,
          description: `Previsão de término da obra: ${data.nome}`,
          start_date: new Date(data.data_prevista_fim).toISOString(),
          end_date: new Date(data.data_prevista_fim).toISOString(),
          obra_id: novaObra.id,
          event_type: 'obra_fim',
          color: '#10B981'
        });
      }

      return novaObra;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obras'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success('Obra criada com sucesso!');
      navigate(createPageUrl('Obras'));
    },
    onError: (error) => {
      toast.error('Erro ao criar obra: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      const obraAtual = obra[0];
      const obraAtualizada = await base44.entities.Obra.update(obraId, data);
      await persistirOrcamentoImportado(obraId);
      await sincronizarEquipeObra(obraId, data);
      const alteracoes = [];
      if (obraAtual.status !== data.status) {
        alteracoes.push({ campo_alterado: 'status', valor_anterior: obraAtual.status, valor_novo: data.status, tipo_alteracao: 'status' });
      }
      if (obraAtual.valor_orcado !== data.valor_orcado) {
        alteracoes.push({ campo_alterado: 'valor_orcado', valor_anterior: String(obraAtual.valor_orcado || 0), valor_novo: String(data.valor_orcado || 0), tipo_alteracao: 'orcamento' });
      }
      for (const alteracao of alteracoes) {
        await base44.entities.HistoricoObra.create({
          obra_id: obraId,
          usuario: user.email,
          ...alteracao,
          descricao: `${alteracao.campo_alterado} alterado de "${alteracao.valor_anterior}" para "${alteracao.valor_novo}"`,
          data_hora: new Date().toISOString()
        });
      }

      // Atualizar eventos no calendário se datas mudarem
      if (data.data_inicio !== obraAtual.data_inicio || data.data_prevista_fim !== obraAtual.data_prevista_fim) {
        const eventos = await base44.entities.CalendarEvent.filter({ obra_id: obraId });

        if (data.data_inicio && eventos.find(e => e.event_type === 'obra_inicio')) {
          const eventoInicio = eventos.find(e => e.event_type === 'obra_inicio');
          await base44.entities.CalendarEvent.update(eventoInicio.id, {
            start_date: new Date(data.data_inicio).toISOString(),
            end_date: new Date(data.data_inicio).toISOString()
          });
        }

        if (data.data_prevista_fim && eventos.find(e => e.event_type === 'obra_fim')) {
          const eventoFim = eventos.find(e => e.event_type === 'obra_fim');
          await base44.entities.CalendarEvent.update(eventoFim.id, {
            start_date: new Date(data.data_prevista_fim).toISOString(),
            end_date: new Date(data.data_prevista_fim).toISOString()
          });
        }
      }

      return obraAtualizada;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obras'] });
      queryClient.invalidateQueries({ queryKey: ['obra', obraId] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success('Obra atualizada com sucesso!');
      navigate(createPageUrl('Obras'));
    },
    onError: (error) => {
      toast.error('Erro ao atualizar obra: ' + error.message);
    }
  });

  // Verifica se status está mudando para "em_andamento"
  const verificarMudancaStatusParaExecucao = (novoStatus, statusAnterior) => {
    const statusExecucao = ['em_andamento', 'EM_ANDAMENTO'];
    const statusNaoExecucao = ['orcamento', 'a_iniciar', 'planejamento'];
    return statusExecucao.includes(novoStatus) && statusNaoExecucao.includes(statusAnterior);
  };

  const executarSubmit = async (dataToSubmit) => {
    if (obraId) {
      updateMutation.mutate(dataToSubmit);
    } else {
      createMutation.mutate(dataToSubmit);
    }
  };

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    // Dá para salvar de QUALQUER etapa (não só da última). Se faltar campo
    // obrigatório, leva o usuário até a etapa dele em vez de só reclamar — senão
    // ele fica com um erro na tela sem saber onde está o campo.
    // Valida TODAS as etapas com campos obrigatórios; para na primeira inválida,
    // destaca os campos e leva o usuário até ela.
    for (const etapa of [0, 1, 2, 4, 5]) {
      const e = validarEtapa(etapa);
      if (Object.keys(e).length) {
        setErrors(e);
        setEtapaAtual(etapa);
        toast.error(`Verifique os campos destacados na etapa "${etapas[etapa]?.titulo || ''}".`);
        return;
      }
    }

    const dataToSubmit = {
      ...formData,
      cliente_nome: formData.cliente,
      valor_contrato: formData.valor_contrato ? Number(formData.valor_contrato) : 0,
      valor_orcado: formData.valor_orcado ? Number(formData.valor_orcado) : 0,
      area_total: formData.area_total ? Number(formData.area_total) : 0,
      responsavel_tecnico: Array.isArray(formData.responsavel_tecnico) ? formData.responsavel_tecnico.join(', ') : (formData.responsavel_tecnico || ''),
      responsavel_obra: Array.isArray(formData.responsavel_obra) ? formData.responsavel_obra.join(', ') : (formData.responsavel_obra || ''),
      responsavel_administrativo: Array.isArray(formData.responsavel_administrativo) ? formData.responsavel_administrativo.join(', ') : (formData.responsavel_administrativo || ''),
      responsavel_financeiro: Array.isArray(formData.responsavel_financeiro) ? formData.responsavel_financeiro.join(', ') : (formData.responsavel_financeiro || ''),
      equipes_vinculadas: formData.equipes_vinculadas || [],
      visivel_para: formData.visivel_para || [],
      exibir_em: formData.exibir_em || { lancamentos: true, faturamentos: true, compras: true }
    };

    // Se é edição e status está mudando para "em_andamento", validar
    if (obraId && obra?.[0]) {
      const statusAnterior = obra[0].status;
      if (verificarMudancaStatusParaExecucao(formData.status, statusAnterior)) {
        // Abrir dialog de validação
        setValidacaoLoading(true);
        setPendingSubmitData(dataToSubmit);
        try {
          const resp = await base44.functions.invoke('validarInicioObra', { obra_id: obraId });
          setValidacaoResultado(resp.data);
          setValidacaoInicioOpen(true);
        } catch (err) {
          console.error('[ObraForm] Erro ao validar início:', err);
          toast.error('Erro ao validar pré-requisitos: ' + err.message);
          // Em caso de erro na validação, permite continuar (modo flexível)
          executarSubmit(dataToSubmit);
        } finally {
          setValidacaoLoading(false);
        }
        return;
      }
    }

    executarSubmit(dataToSubmit);
  };

  const handleConfirmarInicioObra = () => {
    if (pendingSubmitData) {
      executarSubmit(pendingSubmitData);
    }
    setValidacaoInicioOpen(false);
    setPendingSubmitData(null);
    setValidacaoResultado(null);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // O aviso do campo some assim que o usuário começa a corrigir.
    setErrors(prev => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  // Borda vermelha quando o campo tem erro.
  const clsErro = (campo) => (errors[campo] ? 'border-red-400 focus-visible:ring-red-400' : '');

  // Campos obrigatórios de cada etapa (usado tanto pelo "Próximo" quanto pelo Salvar).
  const validarEtapa = (etapa) => {
    const e = {};
    if (etapa === 0) {
      if (!formData.nome?.trim()) e.nome = 'Informe o nome da obra.';
      if (!formData.empresa_id) e.empresa_id = 'Selecione a empresa responsável.';
    }
    if (etapa === 1) {
      if (!formData.cliente) e.cliente = 'Selecione ou informe o cliente / contratante.';
      else if (/^[a-f0-9]{24}$/i.test(formData.cliente)) e.cliente = 'Selecione um cliente válido (não pode ser um ID interno).';
    }
    if (etapa === 2) {
      const vazio = (c) => !(Array.isArray(formData[c]) && formData[c].length);
      if (vazio('responsavel_tecnico')) e.responsavel_tecnico = 'Selecione o responsável técnico.';
      if (vazio('responsavel_obra')) e.responsavel_obra = 'Selecione o responsável da obra (mestre de obras).';
      if (vazio('responsavel_administrativo')) e.responsavel_administrativo = 'Selecione o responsável administrativo.';
      if (vazio('responsavel_financeiro')) e.responsavel_financeiro = 'Selecione o responsável financeiro.';
      if (vazio('colaborador_ids')) e.colaborador_ids = 'Adicione ao menos um colaborador à equipe.';
    }
    if (etapa === 4) {
      if (!formData.endereco?.trim()) e.endereco = 'Informe o endereço da obra.';
      if (!formData.cidade?.trim()) e.cidade = 'Informe a cidade.';
      if (!formData.estado) e.estado = 'Selecione o estado (UF).';
      const cepDigitos = String(formData.cep || '').replace(/\D/g, '');
      if (!cepDigitos) e.cep = 'Informe o CEP.';
      else if (cepDigitos.length !== 8) e.cep = 'CEP inválido (use 8 dígitos, ex.: 00000-000).';
    }
    if (etapa === 5) {
      if (!formData.data_inicio) e.data_inicio = 'Informe a data de início.';
      if (!formData.data_prevista_fim) e.data_prevista_fim = 'Informe a previsão de término.';
      else if (formData.data_inicio && formData.data_prevista_fim < formData.data_inicio) {
        e.data_prevista_fim = 'O término não pode ser anterior ao início.';
      }
    }
    return e;
  };

  // "Próximo" só avança se a etapa atual estiver válida — senão destaca os campos.
  const avancarEtapa = () => {
    const e = validarEtapa(etapaAtual);
    if (Object.keys(e).length) {
      setErrors(e);
      toast.error('Preencha os campos obrigatórios desta etapa.');
      return;
    }
    setErrors({});
    setEtapaAtual(etapaAtual + 1);
  };

  // Evita envio automático do formulário ao pressionar Enter em inputs (exceto textarea)
  const handleFormKeyDown = (e) => {
    if (e.key === 'Enter') {
      const tag = e.target?.tagName?.toLowerCase();
      const type = e.target?.getAttribute?.('type');
      const isTextarea = tag === 'textarea';
      const isButtonOrSubmit = tag === 'button' || type === 'submit';
      const usingShortcut = e.ctrlKey || e.metaKey;
      if (!isTextarea && !isButtonOrSubmit && !usingShortcut) {
        e.preventDefault();
      }
    }
  };

  const estados = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  const obterConteudoEtapa = () => {
    switch (etapaAtual) {

      // ── 0: DADOS DA OBRA ────────────────────────────────────────────────────
      case 0:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-gray-700 font-medium">Código</Label>
                <Input value={formData.codigo} onChange={(e) => handleChange('codigo', e.target.value)} placeholder="Ex: OBR-001" className="mt-1.5 bg-white border-gray-300 text-gray-900 h-11" />
              </div>
              <div>
                <Label className="text-gray-700 font-medium">Nome da Obra *</Label>
                <Input value={formData.nome} onChange={(e) => handleChange('nome', e.target.value)} placeholder="Nome da obra" required className={`mt-1.5 bg-white border-gray-300 text-gray-900 h-11 ${clsErro('nome')}`} />
                {errors.nome && <p className="text-xs text-red-600 mt-1">{errors.nome}</p>}
              </div>
              <div>
                <Label className="text-gray-700 font-medium">Empresa Responsável *</Label>
                {ehMatriz ? (
                  <Select value={formData.empresa_id || ''} onValueChange={(v) => handleChange('empresa_id', v)}>
                    <SelectTrigger className={`mt-1.5 bg-white border-gray-300 text-gray-900 h-11 ${clsErro('empresa_id')}`}><SelectValue placeholder="Selecione a empresa do grupo" /></SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      {empresasMembro.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={empresasMembro.find((e) => e.id === formData.empresa_id)?.nome || '—'} readOnly className="mt-1.5 bg-gray-50 border-gray-300 text-gray-700 h-11" />
                )}
                {errors.empresa_id
                  ? <p className="text-xs text-red-600 mt-1">{errors.empresa_id}</p>
                  : <p className="text-xs text-gray-500 mt-1">Empresa do grupo dona desta obra.</p>}
              </div>
              <div>
                <Label className="text-gray-700 font-medium">Tipo *</Label>
                <Select value={formData.tipo} onValueChange={(v) => handleChange('tipo', v)}>
                  <SelectTrigger className="mt-1.5 bg-white border-gray-300 text-gray-900 h-11"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="publica">Pública</SelectItem>
                    <SelectItem value="privada">Privada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-700 font-medium">Status</Label>
                <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
                  <SelectTrigger className="mt-1.5 bg-white border-gray-300 text-gray-900 h-11"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="orcamento">Em Orçamento</SelectItem>
                    <SelectItem value="a_iniciar">A Iniciar</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="pausada">Paralisada</SelectItem>
                    <SelectItem value="concluida">Finalizada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                    <SelectItem value="manutencao_corretiva">Manutenção Corretiva</SelectItem>
                    <SelectItem value="manutencao_preventiva">Manutenção Preventiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-700 font-medium">Tipo da Obra</Label>
                <Select value={formData.tipo_obra} onValueChange={(v) => handleChange('tipo_obra', v)}>
                  <SelectTrigger className="mt-1.5 bg-white border-gray-300 text-gray-900 h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="edificacao">Edificação</SelectItem>
                    <SelectItem value="infraestrutura">Infraestrutura</SelectItem>
                    <SelectItem value="reforma">Reforma</SelectItem>
                    <SelectItem value="obra_farm">Obra Farm</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-700 font-medium">Área Total (m²)</Label>
                <Input type="number" step="0.01" value={formData.area_total} onChange={(e) => handleChange('area_total', e.target.value)} placeholder="0,00" className="mt-1.5 bg-white border-gray-300 text-gray-900 h-11" />
              </div>
              <div>
                <Label className="text-gray-700 font-medium">ART</Label>
                <Input value={formData.art} onChange={(e) => handleChange('art', e.target.value)} placeholder="Número da ART" className="mt-1.5 bg-white border-gray-300 text-gray-900 h-11" />
              </div>
              <div>
                <Label className="text-gray-700 font-medium">CEI/CNO</Label>
                <Input value={formData.cei_cno} onChange={(e) => handleChange('cei_cno', e.target.value)} placeholder="CEI ou CNO" className="mt-1.5 bg-white border-gray-300 text-gray-900 h-11" />
              </div>
              <div>
                <Label className="text-gray-700 font-medium">Centro de Custo</Label>
                <Input value={formData.centro_custo} onChange={(e) => handleChange('centro_custo', e.target.value)} placeholder="Ex: CC-001" className="mt-1.5 bg-white border-gray-300 text-gray-900 h-11" />
              </div>
              <div>
                <Label className="text-gray-700 font-medium">Número do Contrato</Label>
                <Input value={formData.contrato_numero} onChange={(e) => handleChange('contrato_numero', e.target.value)} placeholder="Ex: CT-2026-001" className="mt-1.5 bg-white border-gray-300 text-gray-900 h-11" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-gray-700 font-medium">Descrição</Label>
                <Textarea value={formData.descricao} onChange={(e) => handleChange('descricao', e.target.value)} placeholder="Descrição detalhada da obra" className="mt-1.5 bg-white border-gray-300 text-gray-900 min-h-24" />
              </div>
            </div>
          </div>
        );

      // ── 1: CLIENTE ───────────────────────────────────────────────────────────
      case 1:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div>
                <div className="flex items-center justify-between mb-1.5 h-5">
                  <Label className="text-gray-700 font-medium">Cliente *</Label>
                  <button type="button" onClick={() => setNovoCliente(!novoCliente)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                    {novoCliente ? 'Selecionar existente' : 'Novo cliente'}
                  </button>
                </div>
                {novoCliente ? (
                  <Input value={formData.cliente} onChange={(e) => handleChange('cliente', e.target.value)} placeholder="Nome do novo cliente" required className={`bg-white border-gray-300 text-gray-900 h-11 ${clsErro('cliente')}`} />
                ) : (
                  <ComboboxBusca
                    value={formData.cliente}
                    options={clientes.map(c => ({ value: c.nome || c.id, label: c.nome }))}
                    onSelect={(v) => handleChange('cliente', v)}
                    placeholder="Selecione um cliente"
                    searchPlaceholder="Buscar cliente..."
                    emptyMessage="Nenhum cliente encontrado."
                    className={clsErro('cliente')}
                  />
                )}
                {errors.cliente && <p className="text-xs text-red-600 mt-1">{errors.cliente}</p>}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5 h-5">
                  <Label className="text-gray-700 font-medium">Órgão Público (se aplicável)</Label>
                </div>
                <Select value={formData.orgao_publico} onValueChange={(v) => handleChange('orgao_publico', v)}>
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900 h-11"><SelectValue placeholder="Selecione o órgão" /></SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value={null}>Não se aplica</SelectItem>
                    <SelectItem value="prefeitura_municipal">Prefeitura Municipal</SelectItem>
                    <SelectItem value="governo_estadual">Governo Estadual</SelectItem>
                    <SelectItem value="governo_federal">Governo Federal</SelectItem>
                    <SelectItem value="camara_municipal">Câmara Municipal</SelectItem>
                    <SelectItem value="assembleia_legislativa">Assembleia Legislativa</SelectItem>
                    <SelectItem value="tribunal_justica">Tribunal de Justiça</SelectItem>
                    <SelectItem value="ministerio_publico">Ministério Público</SelectItem>
                    <SelectItem value="defensoria_publica">Defensoria Pública</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      // ── 2: RESPONSÁVEIS ──────────────────────────────────────────────────────
      case 2: {
        const renderCampoResponsavel = (campo, titulo, cor, descricao, roleFilter = null) => {
          // roleFilter pode ser um papel único ou uma lista de papéis aceitos.
          const aceitos = roleFilter ? (Array.isArray(roleFilter) ? roleFilter : [roleFilter]) : null;
          const opcoes = (aceitos
            ? pessoasCadastradas.filter(p => (p.roles || []).some(r => aceitos.includes(r)))
            : pessoasCadastradas
          // TI / Admin / Programador NUNCA são responsáveis de obra (todos normalizam
          // para 'admin'). Exclusão dura, vale para todos os campos desta etapa.
          ).filter(p => !(p.roles || []).includes('admin'));
          const listaAtual = Array.isArray(formData[campo]) ? formData[campo] : [];
          const disponiveis = opcoes.filter(p => !listaAtual.includes(p.value));
          return (
            <div className="space-y-3">
              <Label className="text-gray-700 font-medium flex items-center gap-2">
                <span className={`text-${cor}-600`}>●</span>{titulo} *
              </Label>
              <ComboboxBusca
                options={disponiveis}
                onSelect={(v) => adicionarResponsavel(campo, v)}
                placeholder={`Adicionar ${titulo.toLowerCase()}`}
                searchPlaceholder="Buscar funcionário..."
                emptyMessage="Nenhum usuário com este cargo."
                className={clsErro(campo)}
              />
              {errors[campo] && <p className="text-xs text-red-600">{errors[campo]}</p>}
              {listaAtual.length > 0 && (
                <div className="space-y-2">
                  {listaAtual.map(r => (
                    <div key={r} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <span className="text-sm text-gray-900">{r}</span>
                      <button type="button" onClick={() => removerResponsavel(campo, r)} className="text-red-600 hover:text-red-700 text-sm font-medium">Remover</button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500">{descricao}</p>
            </div>
          );
        };

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderCampoResponsavel('responsavel_tecnico', 'Responsável Técnico', 'blue', 'Engenheiro responsável pela obra', ['engenheiro'])}
              {renderCampoResponsavel('responsavel_obra', 'Responsável da Obra (Mestre de Obras)', 'green', 'Selecione um mestre de obras para comandar a obra', ['mestre_obras', 'encarregado'])}
              {renderCampoResponsavel('responsavel_administrativo', 'Responsável Administrativo', 'purple', 'Responsável por documentação e processos', ['administrativo', 'rh', 'encarregado', 'financeiro'])}
              {renderCampoResponsavel('responsavel_financeiro', 'Responsável Financeiro', 'amber', 'Responsável por controle financeiro', ['financeiro'])}
            </div>
            {/* Equipe da obra — colaborador a colaborador (mesmo padrão do OrçaFácil).
                Só COLABORADOR entra aqui (é quem bate ponto e vira ObraColaborador);
                quem responde pela obra vai nos campos de responsável acima. */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <Label className="text-gray-700 font-medium flex items-center gap-2 mb-4">
                <span className="text-cyan-600">◉</span>Equipe da Obra *
              </Label>
              {(() => {
                const todos = colaboradores
                  .map((c) => ({ id: `colab_${c.id}`, nome: c.nome || c.full_name, cargo: c.cargo || 'Colaborador' }))
                  .filter((f) => f.nome);
                const disponiveis = todos.filter((f) => !formData.colaborador_ids.includes(f.id));
                return (
                  <>
                    <ComboboxBusca
                      buscarParaListar
                      value=""
                      options={disponiveis.map((f) => ({ value: f.id, label: `${f.nome} — ${f.cargo}` }))}
                      onSelect={(id) => {
                        if (!id || formData.colaborador_ids.includes(id)) return;
                        handleChange('colaborador_ids', [...formData.colaborador_ids, id]);
                      }}
                      placeholder="Adicionar colaborador..."
                      searchPlaceholder="Digite o nome ou cargo..."
                      dicaBusca="Digite para buscar colaboradores..."
                      emptyMessage="Nenhum colaborador encontrado."
                      className={clsErro('colaborador_ids')}
                    />
                    {errors.colaborador_ids && <p className="text-xs text-red-600 mt-2">{errors.colaborador_ids}</p>}
                    {formData.colaborador_ids.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {formData.colaborador_ids.map((fId) => {
                          const f = todos.find((x) => x.id === fId)
                            || (() => { const c = colaboradores.find((c) => `colab_${c.id}` === fId || c.id === fId); return c ? { nome: c.nome || c.full_name } : null; })();
                          return (
                            <span key={fId} className="inline-flex items-center gap-1.5 bg-cyan-50 border border-cyan-200 text-cyan-900 pl-3 pr-2 py-1.5 rounded-full text-sm">
                              {f?.nome || '...'}
                              <button type="button" onClick={() => handleChange('colaborador_ids', formData.colaborador_ids.filter((id) => id !== fId))} className="text-cyan-500 hover:text-red-600 font-bold leading-none">✕</button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-3">Adicione os colaboradores que trabalharão nesta obra, um a um.</p>
                  </>
                );
              })()}
            </div>
          </div>
        );
      }

      // ── 3: MATERIAIS (itens do orçamento) ────────────────────────────────────
      case 3: {
        const totalMat = itensOrcamento.length;
        const totalPagMat = Math.max(1, Math.ceil(totalMat / POR_PAGINA_MAT));
        const pagAtualMat = Math.min(pagMateriais, totalPagMat);
        const itensPaginaMat = itensOrcamento.slice((pagAtualMat - 1) * POR_PAGINA_MAT, pagAtualMat * POR_PAGINA_MAT);
        return (
          <div className="space-y-4">
            {/* Importar orçamento (planilha) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg p-3">
              <div>
                <p className="text-sm font-medium text-gray-800">Importar orçamento</p>
                <p className="text-xs text-gray-500">Planilha .xlsx, .xls ou .csv com colunas de descrição, unidade, quantidade e valor unitário.</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportarOrcamento} />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Package className="w-4 h-4 mr-1" /> Importar planilha
                </Button>
              </div>
            </div>
            {orcamentoImportado && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
                Orçamento importado ({itensOrcamento.length} {itensOrcamento.length === 1 ? 'item' : 'itens'}) — será salvo ao concluir a obra.
              </div>
            )}
            {itensOrcamentoLoading && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <TableSkeleton bare rows={6} cols={4} />
              </div>
            )}
            {!itensOrcamentoLoading && itensOrcamentoErro && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                {itensOrcamentoErro}
              </div>
            )}
            {!itensOrcamentoLoading && !itensOrcamentoErro && itensOrcamento.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50 border border-dashed border-gray-300 rounded-xl">
                <Package className="w-10 h-10 text-gray-300 mb-3" />
                {!orcamentoId && (
                  <>
                    <p className="text-gray-600 font-medium mb-1">Esta obra ainda não possui orçamento vinculado.</p>
                    <p className="text-xs text-gray-400">Importe ou crie um orçamento para esta obra.</p>
                  </>
                )}
                {orcamentoId && tipoOrcamento === 'sintetico' && (
                  <>
                    <p className="text-gray-600 font-medium mb-1">Esta obra possui orçamento sintético.</p>
                    <p className="text-xs text-gray-400 max-w-md">
                      Para gerar materiais automaticamente é necessário um orçamento analítico com composição de insumos.
                    </p>
                  </>
                )}
                {orcamentoId && tipoOrcamento === 'analitico' && (
                  <>
                    <p className="text-gray-600 font-medium mb-1">Nenhum material planejado gerado ainda.</p>
                    <p className="text-xs text-gray-400">O orçamento analítico está vinculado. Gere o planejamento de materiais a partir das composições.</p>
                  </>
                )}
                {orcamentoId && !tipoOrcamento && (
                  <>
                    <p className="text-gray-600 font-medium mb-1">O orçamento vinculado não possui itens cadastrados.</p>
                    <p className="text-xs text-gray-400">Verifique se o orçamento foi importado corretamente.</p>
                  </>
                )}
              </div>
            )}
            {!itensOrcamentoLoading && !itensOrcamentoErro && itensOrcamento.length > 0 && (
              <div className="space-y-2">
                {tipoOrcamento === 'sintetico' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                    <p className="text-xs text-amber-700">
                      <strong>Orçamento Sintético</strong> — Estes são os itens do orçamento. Para gerar planejamento de materiais detalhado, é necessário orçamento analítico.
                    </p>
                  </div>
                )}
                <p className="text-sm text-gray-500 font-medium mb-2">
                  {itensOrcamento.length} {itensOrcamento.length === 1 ? 'item' : 'itens'} do orçamento
                </p>
                {/* overflow-x-auto (não overflow-hidden): no celular a tabela
                    rola na horizontal em vez de ser cortada. */}
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase">Descrição</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase">Unid.</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase">Qtd.</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase">Valor Unit.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {itensPaginaMat.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-900">{item.descricao || '—'}</td>
                          <td className="px-3 py-2.5 text-center text-gray-600">{item.unidade || '—'}</td>
                          <td className="px-3 py-2.5 text-right text-gray-700">{(item.quantidade ?? 0).toLocaleString('pt-BR')}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">
                            {item.custo_unitario != null
                              ? item.custo_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Paginação */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-t border-gray-200 bg-white">
                    <span className="text-xs text-gray-500">
                      Mostrando {(pagAtualMat - 1) * POR_PAGINA_MAT + 1}–{Math.min(pagAtualMat * POR_PAGINA_MAT, totalMat)} de {totalMat}
                    </span>
                    <div className="flex items-center justify-between sm:justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setPagMateriais(p => Math.max(1, p - 1))} disabled={pagAtualMat <= 1} className="h-8 gap-1 border-gray-300 text-gray-700">
                        <ChevronLeft className="w-4 h-4" /> Anterior
                      </Button>
                      <span className="text-xs text-gray-600">Página {pagAtualMat} de {totalPagMat}</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => setPagMateriais(p => Math.min(totalPagMat, p + 1))} disabled={pagAtualMat >= totalPagMat} className="h-8 gap-1 border-gray-300 text-gray-700">
                        Próxima <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }

      // ── 4: LOCALIZAÇÃO ───────────────────────────────────────────────────────
      case 4:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-3">
                <Label className="text-gray-700 font-medium">Endereço (Rua, número, bairro) *</Label>
                <Input
                  value={formData.endereco}
                  onChange={(e) => handleChange('endereco', e.target.value)}
                  placeholder="Ex: Rua das Flores, 123, Jardim Central"
                  className={`mt-1.5 bg-white border-gray-300 text-gray-900 h-11 ${clsErro('endereco')}`}
                />
                {errors.endereco && <p className="text-xs text-red-600 mt-1">{errors.endereco}</p>}
              </div>
              <div className="md:col-span-2">
                <Label className="text-gray-700 font-medium">Cidade *</Label>
                <Input
                  value={formData.cidade}
                  onChange={(e) => handleChange('cidade', e.target.value)}
                  placeholder="Cidade"
                  className={`mt-1.5 bg-white border-gray-300 text-gray-900 h-11 ${clsErro('cidade')}`}
                />
                {errors.cidade && <p className="text-xs text-red-600 mt-1">{errors.cidade}</p>}
              </div>
              <div>
                <Label className="text-gray-700 font-medium">Estado *</Label>
                <Select value={formData.estado} onValueChange={(v) => handleChange('estado', v)}>
                  <SelectTrigger className={`mt-1.5 bg-white border-gray-300 text-gray-900 h-11 ${clsErro('estado')}`}>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 max-h-60">
                    {estados.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.estado && <p className="text-xs text-red-600 mt-1">{errors.estado}</p>}
              </div>
              <div className="md:col-span-3">
                <Label className="text-gray-700 font-medium">CEP *</Label>
                <Input
                  mask="cep"
                  value={formData.cep}
                  onChange={(e) => handleChange('cep', e.target.value)}
                  placeholder="00000-000"
                  className={`mt-1.5 bg-white border-gray-300 text-gray-900 h-11 ${clsErro('cep')}`}
                />
                {errors.cep && <p className="text-xs text-red-600 mt-1">{errors.cep}</p>}
              </div>
            </div>
          </div>
        );

      // ── 5: CRONOGRAMA E VALORES ──────────────────────────────────────────────
      case 5: {
        const obraBase = obra && obra[0];
        const totalOrcamento = obraBase?.total_orcamento || obraBase?.total_final_orcamento || 0;
        const bdiPercent = obraBase?.bdi_percent || 0;
        return (
          <div className="space-y-6">
            {/* Resumo do orçamento importado (somente leitura) */}
            {totalOrcamento > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase mb-2">Resumo do Orçamento Importado</p>
                <div className="flex flex-wrap gap-6">
                  <div>
                    <p className="text-xs text-blue-600">Custo Direto</p>
                    <p className="text-base font-bold text-blue-900">{totalOrcamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                  {bdiPercent > 0 && (
                    <div>
                      <p className="text-xs text-blue-600">BDI</p>
                      <p className="text-base font-bold text-blue-900">{bdiPercent}%</p>
                    </div>
                  )}
                  {obraBase?.total_final_orcamento > 0 && (
                    <div>
                      <p className="text-xs text-blue-600">Total com BDI</p>
                      <p className="text-base font-bold text-blue-900">{obraBase.total_final_orcamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-gray-700 font-medium">Data de Início *</Label>
                <Input type="date" value={formData.data_inicio} onChange={(e) => handleChange('data_inicio', e.target.value)} className={`mt-1.5 bg-white border-gray-300 text-gray-900 h-11 ${clsErro('data_inicio')}`} />
                {errors.data_inicio && <p className="text-xs text-red-600 mt-1">{errors.data_inicio}</p>}
              </div>
              <div>
                <Label className="text-gray-700 font-medium">Previsão de Término *</Label>
                <Input type="date" value={formData.data_prevista_fim} onChange={(e) => handleChange('data_prevista_fim', e.target.value)} className={`mt-1.5 bg-white border-gray-300 text-gray-900 h-11 ${clsErro('data_prevista_fim')}`} />
                {errors.data_prevista_fim && <p className="text-xs text-red-600 mt-1">{errors.data_prevista_fim}</p>}
              </div>
              <div>
                <Label className="text-gray-700 font-medium">Valor do Contrato (R$)</Label>
                <Input type="number" step="0.01" value={formData.valor_contrato} onChange={(e) => handleChange('valor_contrato', e.target.value)} placeholder="0,00" className="mt-1.5 bg-white border-gray-300 text-gray-900 h-11" />
              </div>
              <div>
                <Label className="text-gray-700 font-medium">Valor Orçado (R$)</Label>
                <Input type="number" step="0.01" value={formData.valor_orcado} onChange={(e) => handleChange('valor_orcado', e.target.value)} placeholder="0,00" className="mt-1.5 bg-white border-gray-300 text-gray-900 h-11" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-gray-700 font-medium">Observações</Label>
                <Textarea value={formData.observacoes} onChange={(e) => handleChange('observacoes', e.target.value)} placeholder="Observações adicionais" className="mt-1.5 bg-white border-gray-300 text-gray-900 min-h-20" />
              </div>
            </div>
            <GarantiaSection 
              garantia_tipo={formData.garantia_tipo} 
              garantia_valor={formData.garantia_valor}
              onChange={(data) => {
                handleChange('garantia_tipo', data.tipo);
                handleChange('garantia_valor', data.valor);
              }}
            />
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Dialog de Validação de Início de Obra */}
      <ValidacaoInicioObraDialog
        open={validacaoInicioOpen}
        onClose={() => {
          setValidacaoInicioOpen(false);
          setPendingSubmitData(null);
          setValidacaoResultado(null);
        }}
        onConfirm={handleConfirmarInicioObra}
        validacao={validacaoResultado}
        loading={updateMutation.isPending}
      />

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{obraId ? 'Editar Obra' : 'Nova Obra'}</h1>
          <p className="text-gray-600 text-sm">{obraId ? 'Atualize os dados da obra' : 'Preencha os dados passo a passo'}</p>
        </div>
      </div>

      {/* Progresso */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-medium text-gray-700">Etapa {etapaAtual + 1} de {etapas.length}</span>
          <span className="text-sm text-gray-600">{etapas[etapaAtual].titulo}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${((etapaAtual + 1) / etapas.length) * 100}%` }} />
        </div>
      </div>

      <form onSubmit={(e) => e.preventDefault()} onKeyDown={handleFormKeyDown} className="space-y-6 sm:space-y-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-blue-500/10 rounded-lg">
              {React.createElement(etapas[etapaAtual].icone, { className: 'w-5 h-5 text-blue-600' })}
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{etapas[etapaAtual].titulo}</h2>
          </div>
          {obterConteudoEtapa()}
        </div>

        {/* Botões de Navegação — Anterior + Próximo na mesma linha */}
        <div className="flex gap-3">
          {etapaAtual > 0 && (
            <Button type="button" variant="outline" onClick={() => setEtapaAtual(etapaAtual - 1)} className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-100">
              Anterior
            </Button>
          )}
          {/* SALVAR:
              • EDIÇÃO → em TODAS as etapas (corrigir um telefone na etapa 1 não deve
                obrigar a percorrer as outras cinco).
              • CADASTRO → só na ÚLTIMA etapa: obra nova nasce pelo fim do wizard, não
                pela metade. Nas etapas intermediárias, só "Próximo" guia o caminho. */}
          {(obraId || etapaAtual === etapas.length - 1) && (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold gap-2"
            >
              <Save className="w-4 h-4" />
              {createMutation.isPending || updateMutation.isPending
                ? 'Salvando...'
                : (obraId ? 'Salvar alterações' : 'Salvar Obra')}
            </Button>
          )}
          {etapaAtual < etapas.length - 1 && (
            <Button type="button" onClick={avancarEtapa} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              Próximo
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
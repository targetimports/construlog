import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Lightbulb, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { analisarTextoDaObra } from './analisarTextoDaObra';
import { normalizeObraForUI } from '@/components/shared/normalizeObraForUI';
import NovoClienteModal from '@/components/clientes/NovoClienteModal';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { useEmpresa } from '@/components/shared/useEmpresaContext';

// Campos obrigatórios com labels para exibição no erro
const CAMPOS_OBRIGATORIOS = [
  { campo: 'nome',             label: 'Nome da Obra' },
  { campo: 'empresa_id',       label: 'Empresa Responsável', check: (d) => !d.empresa_id },
  { campo: 'cliente_id',       label: 'Cliente/Contratante', check: (d) => !d.cliente_id && !d.novo_cliente_nome },
  { campo: 'responsavel_tecnico', label: 'Responsável Técnico' },
  { campo: 'responsavel_obra',    label: 'Responsável da Obra' },
  { campo: 'responsavel_user_ids', label: 'Responsáveis da Obra (Supervisores)', check: (d) => !(Array.isArray(d.responsavel_user_ids) && d.responsavel_user_ids.length) },
  { campo: 'data_inicio',         label: 'Data de Início' },
  { campo: 'data_prevista_fim',   label: 'Data Prevista de Fim' },
  { campo: 'cidade',              label: 'Cidade' },
  { campo: 'estado',              label: 'Estado' },
];

function validarDados(d) {
  const erros = {};
  CAMPOS_OBRIGATORIOS.forEach(({ campo, label, check }) => {
    const vazio = check ? check(d) : !d[campo]?.trim?.();
    if (vazio) erros[campo] = `${label} é obrigatório`;
  });
  return erros;
}

function ErroCampo({ msg }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
      <AlertCircle className="w-3 h-3 flex-shrink-0" /> {msg}
    </p>
  );
}

// MAPEAMENTO: Form → Obra (remover undefined/null)
function mapFormToObraUpdate(formValues) {
  const payload = {};
  
  // Campos obrigatórios
  if (formValues.nome) payload.nome = formValues.nome;
  if (formValues.empresa_id) payload.empresa_id = formValues.empresa_id;
  if (formValues.cliente_id) {
    payload.cliente_id = formValues.cliente_id;
    // Sempre passar cliente_nome para que o backend não precise fazer lookup
    if (formValues._cliente_nome) {
      payload.cliente_nome = formValues._cliente_nome;
    }
  }
  if (formValues.novo_cliente_nome) {
    payload.novo_cliente_nome = formValues.novo_cliente_nome;
    payload.cliente_nome = formValues.novo_cliente_nome;
  }
  // Documento lido da planilha: o backend usa para NÃO duplicar cliente existente
  // (compara só os dígitos) e para completar o cadastro que estiver sem CNPJ.
  if (formValues.cliente_documento) payload.cliente_documento = formValues.cliente_documento;
  
  // Localizacao
  if (formValues.endereco_rua) payload.endereco = formValues.endereco_rua;
  if (formValues.cidade) payload.cidade = formValues.cidade;
  if (formValues.estado) payload.estado = formValues.estado;
  if (formValues.endereco_cep) payload.cep = formValues.endereco_cep;
  
  // Responsáveis
  if (formValues.responsavel_tecnico) payload.responsavel_tecnico = formValues.responsavel_tecnico;
  if (formValues.responsavel_obra) payload.responsavel_obra = formValues.responsavel_obra;
  
  // Tipo e Status
  if (formValues.tipo) payload.tipo = formValues.tipo;
  if (formValues.status) payload.status = formValues.status;
  
  // Datas
  if (formValues.data_inicio) payload.data_inicio = formValues.data_inicio;
  if (formValues.data_prevista_fim) payload.data_prevista_fim = formValues.data_prevista_fim;
  
  // Categorias
  if (formValues.categoria_dre) payload.categoria_dre = formValues.categoria_dre;
  if (formValues.tipo_estrutural) payload.tipo_estrutural = formValues.tipo_estrutural;
  if (formValues.tipo_intervencao) payload.tipo_intervencao = formValues.tipo_intervencao;
  
  // Centro de custo (somente se preenchido)
  if (formValues.centro_custo_codigo) payload.centro_custo_codigo = formValues.centro_custo_codigo;
  if (formValues.centro_custo_nome) payload.centro_custo_nome = formValues.centro_custo_nome;

  // Equipe da obra (opcional): vai como lista de Colaborador (sem o prefixo do
  // seletor). O backend cria os vínculos ObraColaborador — é o que faz essa gente
  // aparecer no Ponto/Presença da obra. Sem isto o campo era só enfeite.
  if (formValues.colaborador_ids?.length) {
    payload.colaborador_ids = formValues.colaborador_ids.map((id) => String(id).replace(/^colab_/, ''));
  }
  
  // Remover campos undefined
  Object.keys(payload).forEach(key => {
    if (payload[key] === undefined || payload[key] === null || payload[key] === '') {
      delete payload[key];
    }
  });
  
  return payload;
}

export default function Etapa4DadosObra({ onDadosCarregados, tentouAvancar = false, metaArquivo = null }) {
  const [erros, setErros] = useState({});
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const formRef = useRef(null);
  const [dados, setDados] = useState({
    nome: '',
    cliente_id: '',
    novo_cliente_nome: '',
    empresa_id: '',
    responsavel_user_ids: [],
    responsavel_tecnico: '',
    responsavel_obra: '',
    equipe_id: '',
    colaborador_ids: [],
    tipo: 'privada',
    endereco_rua: '',
    endereco_bairro: '',
    endereco_cep: '',
    cidade: '',
    estado: '',
    data_inicio: '',
    data_prevista_fim: '',
    status: 'orcamento',
    categoria_dre: '',
    tipo_estrutural: '',
    tipo_intervencao: '',
    centro_custo_codigo: '',
    centro_custo_nome: ''
  });

  const [criandoCliente, setCriandoCliente] = useState(false);
  const [modalNovoClienteOpen, setModalNovoClienteOpen] = useState(false);
  const queryClient = useQueryClient();

  // Multi-empresa: obra precisa pertencer a uma empresa (Matriz ou membro).
  const { empresas = [], empresa: empresaDoUsuario, empresaId: empresaDoUsuarioId, acessoGlobal } = useEmpresa();
  // A Matriz é a consolidação do grupo — NÃO é uma empresa operacional e não pode
  // ter obra. Só empresas-membro podem ser responsáveis por uma obra.
  const empresasSelecionaveis = (empresas || []).filter((e) => e.tipo === 'membro');
  // Membro: herda automaticamente a própria empresa (sem escolher).
  useEffect(() => {
    if (!acessoGlobal && empresaDoUsuarioId) {
      setDados((prev) => (prev.empresa_id ? prev : { ...prev, empresa_id: empresaDoUsuarioId }));
    }
  }, [acessoGlobal, empresaDoUsuarioId]);
  const [cronogramaId, setCronogramaId] = useState(null);
  const [mostraNovaCronograma, setMostraNovaCronograma] = useState(false);
  const [mostraFormularioCronograma, setMostraFormularioCronograma] = useState(false);
  const [sugestoes, setSugestoes] = useState(null);
  const [mostraSugestoes, setMostraSugestoes] = useState(false);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const data = await base44.entities.Cliente.list();
      return data || [];
    }
  });

  // PRÉ-PREENCHE com o que veio do cabeçalho da planilha. Se o contratante já
  // existir, VINCULA ao cadastro (compara documento só por dígitos, para
  // 12.345.678/0001-99 e 12345678000199 serem o mesmo); senão, deixa o nome no
  // campo de cliente novo, que o backend cadastra ao finalizar.
  // Roda uma vez, e nunca sobrescreve algo que o usuário já digitou.
  const jaSugeriu = useRef(false);
  useEffect(() => {
    if (jaSugeriu.current || !metaArquivo) return;
    const nomeArq = String(metaArquivo.cliente_nome || '').trim();
    const docArq = String(metaArquivo.cliente_documento || '').replace(/\D/g, '');
    if (!nomeArq && !docArq && !metaArquivo.nome_obra) return;
    if (!clientes.length && (nomeArq || docArq)) return;   // espera a lista carregar
    jaSugeriu.current = true;

    const soDigitos = (v) => String(v || '').replace(/\D/g, '');
    const chave = (v) => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const existente = (docArq && clientes.find((c) => soDigitos(c.cnpj_cpf) === docArq))
      || (nomeArq && clientes.find((c) => chave(c.nome) === chave(nomeArq)));

    setDados((prev) => ({
      ...prev,
      nome: prev.nome || metaArquivo.nome_obra || metaArquivo.objeto?.slice(0, 120) || '',
      ...(existente
        ? { cliente_id: prev.cliente_id || existente.id, _cliente_nome: existente.nome }
        : (nomeArq && !prev.cliente_id ? { novo_cliente_nome: prev.novo_cliente_nome || nomeArq } : {})),
      ...(docArq && !existente ? { cliente_documento: metaArquivo.cliente_documento } : {}),
    }));
    if (existente) toast.success(`Contratante "${existente.nome}" já cadastrado — vinculado.`);
    else if (nomeArq) toast.info(`Contratante "${nomeArq}" lido da planilha — será cadastrado ao finalizar.`);
  }, [metaArquivo, clientes]);

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-supervisor'],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return users || [];
    }
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ['equipes'],
    queryFn: async () => {
      const data = await base44.entities.Equipe.list();
      return data || [];
    }
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: async () => {
      const data = await base44.entities.Colaborador.list();
      return data || [];
    }
  });

  const { data: permissoes = [] } = useQuery({
    queryKey: ['permissoes-usuarios'],
    queryFn: () => base44.entities.PermissaoUsuario.list(),
  });

  // Lista unificada de pessoas (usuários + colaboradores) com papéis normalizados,
  // para os comboboxes de busca por função (igual ao cadastro manual de obra).
  const normalizeRole = (s) => {
    const v = String(s || '').toLowerCase();
    if (v.includes('mestre')) return 'mestre_obras';
    if (v.includes('financ')) return 'financeiro';
    if (v.includes('administrativ')) return 'administrativo';
    if (v.includes('engenh')) return 'engenheiro';
    if (v.includes('compra')) return 'compras';
    return v;
  };
  const rolesDoUsuario = (u) => {
    const p = permissoes.find((pp) => pp.user_email === u.email);
    const roles = [];
    if (p) {
      if (p.engenheiro) roles.push('engenheiro');
      if (p.mestre_obras) roles.push('mestre_obras');
      if (p.administrativo) roles.push('administrativo');
      if (p.financeiro) roles.push('financeiro');
      if (p.compras) roles.push('compras');
    }
    return roles;
  };
  const obterFuncao = (u) => {
    if (u.role === 'admin') return 'Administrador';
    const r = rolesDoUsuario(u);
    return r.length ? r.join(', ') : 'Usuário';
  };
  const pessoasCadastradas = [
    ...usuarios.map((u) => ({ value: u.full_name, label: `${u.full_name} (${obterFuncao(u)})`, roles: rolesDoUsuario(u) })),
    ...colaboradores.map((c) => ({ value: c.nome, label: `${c.nome} (${c.cargo})`, roles: [normalizeRole(c.cargo)] })),
  ].filter((p) => p.value);
  const pessoasPorFuncao = (roleFilter) => (roleFilter ? pessoasCadastradas.filter((p) => (p.roles || []).includes(roleFilter)) : pessoasCadastradas);

  const ESTADOS = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  // PASSO 8: Gerar sugestões ao montar e quando nome mudar
  useEffect(() => {
    if (dados.nome && dados.nome.trim()) {
      const analise = analisarTextoDaObra(dados.nome);
      setSugestoes(analise);
      setMostraSugestoes(true);
      
      // Auto-aplicar sugestões em campos vazios
      setDados(prev => ({
        ...prev,
        ...(analise.cidade && !prev.cidade ? { cidade: analise.cidade } : {}),
        ...(analise.estado && !prev.estado ? { estado: analise.estado } : {}),
        ...(analise.categoriaDRE && !prev.categoria_dre ? { categoria_dre: analise.categoriaDRE } : {}),
        ...(analise.tipoEstrutural && !prev.tipo_estrutural ? { tipo_estrutural: analise.tipoEstrutural } : {}),
        ...(analise.tipoIntervencao && !prev.tipo_intervencao ? { tipo_intervencao: analise.tipoIntervencao } : {})
      }));
    }
  }, [dados.nome]);

  // Aplicar sugestões APENAS em campos vazios
  const aplicarSugestoes = () => {
    if (!sugestoes) return;
    
    setDados(prev => ({
      ...prev,
      ...(sugestoes.nomeSugerido && !prev.nome ? { nome: sugestoes.nomeSugerido } : {}),
      ...(sugestoes.cidade && !prev.cidade ? { cidade: sugestoes.cidade } : {}),
      ...(sugestoes.estado && !prev.estado ? { estado: sugestoes.estado } : {}),
      ...(sugestoes.categoriaDRE && !prev.categoria_dre ? { categoria_dre: sugestoes.categoriaDRE } : {}),
      ...(sugestoes.tipoEstrutural && !prev.tipo_estrutural ? { tipo_estrutural: sugestoes.tipoEstrutural } : {}),
      ...(sugestoes.tipoIntervencao && !prev.tipo_intervencao ? { tipo_intervencao: sugestoes.tipoIntervencao } : {})
    }));
    
    toast.success('Sugestões aplicadas!');
    setMostraSugestoes(false);
  };

  // Quando pai tenta avançar, ativar validação visual
  useEffect(() => {
    if (tentouAvancar) setTentouSalvar(true);
  }, [tentouAvancar]);

  // Revalidar em tempo real quando já tentou salvar
  useEffect(() => {
    const errosAtuais = validarDados(dados);
    if (tentouSalvar) {
      setErros(errosAtuais);
      // Scroll para primeiro erro
      if (Object.keys(errosAtuais).length > 0 && formRef.current) {
        const firstError = formRef.current.querySelector('.border-red-400');
        if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    // Propagar null se inválido — pai bloqueia avanço
    const valido = Object.keys(errosAtuais).length === 0;
    const payloadParaEnviar = mapFormToObraUpdate(dados);
    onDadosCarregados(valido ? { payload: payloadParaEnviar } : null);
  }, [dados, tentouSalvar]);

  // Método chamado pelo pai quando o usuário tenta avançar (exposição via callback)
  // Aqui usamos um efeito especial: pai passa tentarAvancar como prop booliana
  // Implementado via prop onTentarAvancar abaixo na assinatura do componente

  const handleClienteCriadoNoModal = (novoCliente) => {
    setDados(prev => ({ ...prev, cliente_id: novoCliente.id, _cliente_nome: novoCliente.nome }));
    queryClient.invalidateQueries({ queryKey: ['clientes'] });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Etapa 4: Dados da Obra</CardTitle>
          <p className="text-sm text-gray-600 mt-2">Campos com <span className="text-red-500">*</span> são obrigatórios</p>
        </CardHeader>
        <CardContent className="space-y-4" ref={formRef}>

        {/* Sem banner de resumo: o destaque vermelho + a mensagem em cada campo
            (e a rolagem até o primeiro erro) já orientam o preenchimento. */}

        <div>
          <Label>Nome da Obra <span className="text-red-500">*</span></Label>
          <Input
            value={dados.nome}
            onChange={(e) => setDados({ ...dados, nome: e.target.value })}
            placeholder="Ex: Construção Galpão Industrial"
            className={erros.nome ? 'border-red-400 focus:ring-red-400' : ''}
          />
          <ErroCampo msg={erros.nome} />
        </div>

        <div>
          <Label>Cliente/Contratante <span className="text-red-500">*</span></Label>
          {dados.cliente_id && (
            <div className="mb-2 mt-1 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm font-medium text-blue-800">
              ✓ {clientes.find(c => c.id === dados.cliente_id)?.nome}
            </div>
          )}
          <ComboboxBusca
            value={dados.cliente_id}
            options={clientes.map(c => ({ value: c.id, label: c.nome }))}
            onSelect={(v) => {
              const cli = clientes.find(c => c.id === v);
              setDados({ ...dados, cliente_id: v, _cliente_nome: cli?.nome || '' });
            }}
            placeholder="Selecione o cliente"
            searchPlaceholder="Buscar cliente..."
            emptyMessage="Nenhum cliente encontrado."
          />
          <ErroCampo msg={erros.cliente_id} />
          <div className="mt-2">
            <Button type="button" variant="outline" className="w-full gap-2 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => setModalNovoClienteOpen(true)}>
              <Plus className="w-4 h-4" />
              Criar novo cliente
            </Button>
          </div>
        </div>

        {/* Empresa responsável (regra multi-empresa) */}
        <div>
          <Label>Empresa Responsável <span className="text-red-500">*</span></Label>
          {acessoGlobal ? (
            <>
              <ComboboxBusca
                value={dados.empresa_id}
                options={empresasSelecionaveis.map((e) => ({ value: e.id, label: e.nome }))}
                onSelect={(v) => setDados({ ...dados, empresa_id: v || '' })}
                placeholder="Selecione a empresa responsável"
                searchPlaceholder="Buscar empresa..."
                emptyMessage="Nenhuma empresa cadastrada."
              />
              <p className="text-xs text-gray-400 mt-1">A obra e todo o financeiro/estoque ficam vinculados a esta empresa do grupo.</p>
              <ErroCampo msg={erros.empresa_id} />
            </>
          ) : (
            <div className="mt-1 h-11 flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600">
              {empresaDoUsuario?.nome || 'Sua empresa'}
              <span className="text-xs text-gray-400">· vinculada automaticamente</span>
            </div>
          )}
        </div>

        <div>
          <Label>Responsável Técnico <span className="text-red-500">*</span></Label>
          <ComboboxBusca
            value={dados.responsavel_tecnico}
            options={pessoasCadastradas}
            onSelect={(v) => setDados({ ...dados, responsavel_tecnico: v })}
            placeholder="Selecione o responsável técnico"
            searchPlaceholder="Buscar funcionário..."
            emptyMessage="Nenhum funcionário encontrado."
          />
          <ErroCampo msg={erros.responsavel_tecnico} />
        </div>

        <div>
          <Label>Responsável da Obra <span className="text-red-500">*</span></Label>
          <ComboboxBusca
            value={dados.responsavel_obra}
            options={pessoasPorFuncao('mestre_obras')}
            onSelect={(v) => setDados({ ...dados, responsavel_obra: v })}
            placeholder="Selecione o mestre de obras"
            searchPlaceholder="Buscar mestre de obras..."
            emptyMessage="Nenhum mestre de obras encontrado."
          />
          <ErroCampo msg={erros.responsavel_obra} />
        </div>

        <div>
          <Label>Responsáveis da Obra (Supervisores) *</Label>
          {dados.responsavel_user_ids.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2 bg-blue-50 rounded-md mb-2 mt-1">
              {dados.responsavel_user_ids.map(userId => {
                const user = usuarios.find(u => u.id === userId);
                return (
                  <div key={userId} className="flex items-center gap-1 bg-blue-200 text-blue-900 px-3 py-1 rounded-full text-sm">
                    <span>{user?.full_name}</span>
                    <button type="button" onClick={() => setDados({ ...dados, responsavel_user_ids: dados.responsavel_user_ids.filter(id => id !== userId) })} className="ml-1 font-bold hover:text-red-600">✕</button>
                  </div>
                );
              })}
            </div>
          )}
          <ComboboxBusca
            options={usuarios
              .filter(u => !dados.responsavel_user_ids.includes(u.id))
              .map(u => ({ value: u.id, label: `${u.full_name}${u.cargo ? ` — ${u.cargo}` : (u.role ? ` — ${u.role}` : '')}` }))}
            onSelect={(id) => {
              if (!dados.responsavel_user_ids.includes(id)) {
                setDados({ ...dados, responsavel_user_ids: [...dados.responsavel_user_ids, id] });
              }
            }}
            placeholder="Adicionar supervisor"
            searchPlaceholder="Buscar usuário..."
            emptyMessage="Nenhum usuário disponível."
            className={erros.responsavel_user_ids ? 'border-red-400 focus-visible:ring-red-400' : ''}
          />
          <ErroCampo msg={erros.responsavel_user_ids} />
        </div>

        <div>
          <Label>Funcionários da Obra (Opcional)</Label>
          {(() => {
            // Só COLABORADOR: é quem bate ponto e entra na folha. Usuário do sistema
            // (login) não é vínculo de obra — viraria vínculo fantasma, com nome em
            // branco no Ponto. Quem responde pela obra vai nos campos de responsável.
            const todosOsFuncionarios = colaboradores
              .map(c => ({ id: `colab_${c.id}`, nome: c.nome || c.full_name, subtitulo: c.cargo || 'Colaborador', origem: 'Colaborador' }))
              .filter(f => f.nome);

            const disponiveis = todosOsFuncionarios.filter(f => !dados.colaborador_ids.includes(f.id));

            return (
              <>
                <div className="mt-1">
                  <ComboboxBusca
                    buscarParaListar
                    options={disponiveis.map(f => ({ value: f.id, label: `${f.nome} — ${f.subtitulo}` }))}
                    value=""
                    onSelect={(id) => {
                      if (!id || dados.colaborador_ids.includes(id)) return;
                      setDados({ ...dados, colaborador_ids: [...dados.colaborador_ids, id] });
                    }}
                    placeholder="Adicionar funcionário..."
                    searchPlaceholder="Digite o nome ou cargo..."
                    dicaBusca="Digite para buscar funcionários..."
                    emptyMessage="Nenhum funcionário encontrado."
                  />
                </div>
                {dados.colaborador_ids.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 bg-green-50 rounded-md mt-2">
                    {dados.colaborador_ids.map(fId => {
                      // Suporta IDs com prefixo (colab_/user_) e IDs brutos legados
                      const func = todosOsFuncionarios.find(f => f.id === fId)
                        || (() => {
                          const colab = colaboradores.find(c => c.id === fId || `colab_${c.id}` === fId);
                          if (colab) return { nome: colab.nome || colab.full_name };
                          const user = usuarios.find(u => u.id === fId || `user_${u.id}` === fId);
                          if (user) return { nome: user.full_name || user.email };
                          return null;
                        })();
                      return (
                        <div key={fId} className="flex items-center gap-1 bg-green-200 text-green-900 px-3 py-1 rounded-full text-sm">
                          <span>{func?.nome || '...'}</span>
                          <button type="button" onClick={() => setDados({ ...dados, colaborador_ids: dados.colaborador_ids.filter(id => id !== fId) })} className="ml-1 font-bold hover:text-red-600">✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Tipo</Label>
            <Select value={dados.tipo} onValueChange={(v) => setDados({ ...dados, tipo: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="privada">Privada</SelectItem>
                <SelectItem value="publica">Pública</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Status Inicial</Label>
            <Select value={dados.status} onValueChange={(v) => setDados({ ...dados, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="orcamento">Orçamento</SelectItem>
                <SelectItem value="a_iniciar">A Iniciar</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Endereço - Rua</Label>
          <Input
            value={dados.endereco_rua}
            onChange={(e) => setDados({ ...dados, endereco_rua: e.target.value })}
            placeholder="Ex: Rua das Flores, 123"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Bairro</Label>
            <Input
              value={dados.endereco_bairro}
              onChange={(e) => setDados({ ...dados, endereco_bairro: e.target.value })}
              placeholder="Ex: Centro"
            />
          </div>
          <div>
            <Label>CEP</Label>
            <Input
              mask="cep"
              value={dados.endereco_cep}
              onChange={(e) => setDados({ ...dados, endereco_cep: e.target.value })}
              placeholder="Ex: 48300-000"
            />
          </div>
          <div>
            <Label>Cidade <span className="text-red-500">*</span></Label>
            <Input
              value={dados.cidade}
              onChange={(e) => setDados({ ...dados, cidade: e.target.value })}
              placeholder="Ex: São Paulo"
              className={erros.cidade ? 'border-red-400 focus:ring-red-400' : ''}
            />
            <ErroCampo msg={erros.cidade} />
          </div>
        </div>

        <div>
          <Label>Estado <span className="text-red-500">*</span></Label>
          <Select value={dados.estado} onValueChange={(v) => setDados({ ...dados, estado: v })}>
            <SelectTrigger className={erros.estado ? 'border-red-400' : ''}>
              <SelectValue placeholder="Selecione o estado" />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS.map(estado => (
                <SelectItem key={estado} value={estado}>{estado}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ErroCampo msg={erros.estado} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Categoria DRE</Label>
            <Select value={dados.categoria_dre || ''} onValueChange={(v) => setDados({ ...dados, categoria_dre: v === '__none__' ? '' : v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem categoria</SelectItem>
                <SelectItem value="EDUCACAO">Educação</SelectItem>
                <SelectItem value="SAUDE">Saúde</SelectItem>
                <SelectItem value="INFRA">Infraestrutura</SelectItem>
                <SelectItem value="ADMINISTRATIVO">Administrativo</SelectItem>
                <SelectItem value="OUTRO">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo Estrutural</Label>
            <Select value={dados.tipo_estrutural || ''} onValueChange={(v) => setDados({ ...dados, tipo_estrutural: v === '__none__' ? '' : v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem tipo</SelectItem>
                <SelectItem value="CONTENCAO">Contenção</SelectItem>
                <SelectItem value="FUNDACAO">Fundação</SelectItem>
                <SelectItem value="ESTRUTURA">Estrutura</SelectItem>
                <SelectItem value="ALVENARIA">Alvenaria</SelectItem>
                <SelectItem value="COBERTURA">Cobertura</SelectItem>
                <SelectItem value="ACABAMENTO">Acabamento</SelectItem>
                <SelectItem value="INSTALACOES">Instalações</SelectItem>
                <SelectItem value="PAVIMENTACAO">Pavimentação</SelectItem>
                <SelectItem value="DRENAGEM">Drenagem</SelectItem>
                <SelectItem value="OUTRO">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo Intervenção</Label>
            <Select value={dados.tipo_intervencao || ''} onValueChange={(v) => setDados({ ...dados, tipo_intervencao: v === '__none__' ? '' : v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Não especificado</SelectItem>
                <SelectItem value="REFORMA">Reforma</SelectItem>
                <SelectItem value="CONSTRUCAO_NOVA">Construção Nova</SelectItem>
                <SelectItem value="AMPLIACAO">Ampliação</SelectItem>
                <SelectItem value="INDEFINIDA">Indefinida</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Data de Início <span className="text-red-500">*</span></Label>
            <Input
              type="date"
              value={dados.data_inicio}
              onChange={(e) => setDados({ ...dados, data_inicio: e.target.value })}
              className={erros.data_inicio ? 'border-red-400 focus:ring-red-400' : ''}
            />
            <ErroCampo msg={erros.data_inicio} />
          </div>
          <div>
            <Label>Data Prevista de Fim <span className="text-red-500">*</span></Label>
            <Input
              type="date"
              value={dados.data_prevista_fim}
              onChange={(e) => setDados({ ...dados, data_prevista_fim: e.target.value })}
              className={erros.data_prevista_fim ? 'border-red-400 focus:ring-red-400' : ''}
            />
            <ErroCampo msg={erros.data_prevista_fim} />
          </div>
        </div>
        </CardContent>
      </Card>


      <NovoClienteModal
        open={modalNovoClienteOpen}
        onClose={() => setModalNovoClienteOpen(false)}
        onClienteCriado={handleClienteCriadoNoModal}
      />
    </div>
  );
}
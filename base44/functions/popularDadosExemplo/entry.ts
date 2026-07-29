import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Acesso negado - apenas admin' }, { status: 403 });
    }

    const resultados = {
      empresas: 0,
      licitacoes: 0,
      obras: 0,
      colaboradores: 0,
      materiais: 0,
      veiculos: 0,
      motoristas: 0,
      fornecedores: 0,
      contratos: 0,
      contas: 0,
      tarefas: 0,
      templates: 0,
      almoxarifados: 0,
      diarios: 0,
      medicoes: 0,
      orcamentos: 0,
      projetos_tecnicos: 0,
      equipes: 0,
      treinamentos: 0,
      asos: 0,
      riscos: 0,
      ordens_compra: 0,
      movimentacoes: 0
    };

    // 1. EMPRESAS
    // Matriz (Central de Compras)
    const matriz = await base44.asServiceRole.entities.Empresa.create({
      nome: 'Construlog Holding',
      razao_social: 'Construlog Construções e Incorporações Holding S.A.',
      cnpj: '10.000.000/0001-00',
      tipo: 'matriz',
      e_central_compras: true,
      telefone: '(11) 3456-7890',
      email: 'holding@construlog.com.br',
      endereco: 'Av. Paulista, 1000',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01310-100',
      status: 'ativa'
    });

    // 5 Empresas Subsidiárias (gerenciam obras)
    const subsidiarias = await base44.asServiceRole.entities.Empresa.bulkCreate([
      {
        nome: 'Construlog Infraestrutura SP',
        razao_social: 'Construlog Infraestrutura São Paulo Ltda',
        cnpj: '11.111.111/0001-11',
        tipo: 'subsidiaria',
        parent_id: matriz.id,
        telefone: '(11) 3456-7891',
        email: 'infra.sp@construlog.com.br',
        endereco: 'Av. Paulista, 1000 - Sala 101',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01310-100',
        status: 'ativa'
      },
      {
        nome: 'Construlog Obras Públicas',
        razao_social: 'Construlog Obras Públicas e Serviços Ltda',
        cnpj: '22.222.222/0001-22',
        tipo: 'subsidiaria',
        parent_id: matriz.id,
        telefone: '(11) 3456-7892',
        email: 'publicas@construlog.com.br',
        endereco: 'Av. Paulista, 1000 - Sala 102',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01310-100',
        status: 'ativa'
      },
      {
        nome: 'Construlog Edificações',
        razao_social: 'Construlog Edificações Residenciais Ltda',
        cnpj: '33.333.333/0001-33',
        tipo: 'subsidiaria',
        parent_id: matriz.id,
        telefone: '(11) 3456-7893',
        email: 'edificacoes@construlog.com.br',
        endereco: 'Av. Paulista, 1000 - Sala 103',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01310-100',
        status: 'ativa'
      },
      {
        nome: 'Construlog Saúde',
        razao_social: 'Construlog Construções Hospitalares Ltda',
        cnpj: '44.444.444/0001-44',
        tipo: 'subsidiaria',
        parent_id: matriz.id,
        telefone: '(11) 3456-7894',
        email: 'saude@construlog.com.br',
        endereco: 'Av. Paulista, 1000 - Sala 104',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01310-100',
        status: 'ativa'
      },
      {
        nome: 'Construlog Metálicas',
        razao_social: 'Construlog Estruturas Metálicas Ltda',
        cnpj: '55.555.555/0001-55',
        tipo: 'subsidiaria',
        parent_id: matriz.id,
        telefone: '(11) 3456-7895',
        email: 'metalicas@construlog.com.br',
        endereco: 'Av. Paulista, 1000 - Sala 105',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01310-100',
        status: 'ativa'
      }
    ]);

    const empresas = [matriz, ...subsidiarias];
    resultados.empresas = empresas.length;

    // 2. OBRAS
    const obras = await base44.asServiceRole.entities.Obra.bulkCreate([
      {
        codigo: 'OBR-2025-001',
        nome: 'Condomínio Residencial Jardim das Flores',
        tipo: 'privada',
        status: 'em_andamento',
        cliente: 'Incorporadora São Paulo S.A.',
        endereco: 'Rua das Flores, 500',
        cidade: 'São Paulo',
        estado: 'SP',
        responsavel_tecnico: 'Eng. Carlos Silva',
        responsavel_administrativo: 'Maria Santos',
        contrato_numero: 'CONT-2024-789',
        data_inicio: '2025-01-05',
        data_prevista_fim: '2026-12-31',
        valor_contrato: 5500000,
        valor_orcado: 5200000,
        valor_realizado: 850000,
        percentual_concluido: 15
      },
      {
        codigo: 'OBR-2025-002',
        nome: 'Ponte sobre Rio Verde',
        tipo: 'publica',
        licitacao_id: licitacoes[0].id,
        status: 'em_andamento',
        cliente: 'Prefeitura Municipal de Guarulhos',
        orgao_publico: 'Secretaria de Infraestrutura',
        contrato_numero: 'CONT-PE-2024-045/2024',
        endereco: 'Km 45 - Rod. Estadual',
        cidade: 'Guarulhos',
        estado: 'SP',
        responsavel_tecnico: 'Eng. Ana Paula Costa',
        data_inicio: '2024-09-01',
        data_prevista_fim: '2026-03-31',
        valor_contrato: 12000000,
        valor_orcado: 11500000,
        valor_realizado: 4200000,
        percentual_concluido: 35
      },
      {
        codigo: 'OBR-2024-015',
        nome: 'Reforma Hospital Central',
        tipo: 'publica',
        licitacao_id: licitacoes[1].id,
        status: 'em_andamento',
        cliente: 'Governo do Estado de São Paulo',
        orgao_publico: 'Secretaria de Saúde',
        contrato_numero: 'CONT-CONC-2024-089/2024',
        endereco: 'Av. Central, 1200',
        cidade: 'São Paulo',
        estado: 'SP',
        responsavel_tecnico: 'Eng. Roberto Lima',
        data_inicio: '2024-06-15',
        data_prevista_fim: '2025-06-15',
        valor_contrato: 3500000,
        valor_orcado: 3400000,
        valor_realizado: 2100000,
        percentual_concluido: 60
      }
    ]);
    resultados.obras = obras.length;

    // 4. COLABORADORES
    const colaboradores = await base44.asServiceRole.entities.Colaborador.bulkCreate([
      {
        nome: 'João Silva Santos',
        cpf: '123.456.789-00',
        cargo: 'Pedreiro',
        departamento: 'producao',
        obra_atual: obras[0].id,
        data_admissao: '2024-01-15',
        salario: 3500,
        status: 'ativo',
        telefone: '(11) 98765-4321',
        email: 'joao.silva@construlog.com.br'
      },
      {
        nome: 'Maria Oliveira Costa',
        cpf: '234.567.890-11',
        cargo: 'Engenheira Civil',
        departamento: 'engenharia',
        obra_atual: obras[1].id,
        data_admissao: '2023-03-20',
        salario: 9500,
        status: 'ativo',
        telefone: '(11) 98765-1234',
        email: 'maria.costa@construlog.com.br'
      },
      {
        nome: 'Pedro Almeida Souza',
        cpf: '345.678.901-22',
        cargo: 'Mestre de Obras',
        departamento: 'producao',
        obra_atual: obras[0].id,
        data_admissao: '2022-07-10',
        salario: 5500,
        status: 'ativo',
        telefone: '(11) 98765-5678',
        email: 'pedro.souza@construlog.com.br'
      },
      {
        nome: 'Ana Paula Ferreira',
        cpf: '456.789.012-33',
        cargo: 'Comprador',
        departamento: 'compras',
        data_admissao: '2023-11-05',
        salario: 4500,
        status: 'ativo',
        telefone: '(11) 98765-8765',
        email: 'ana.ferreira@construlog.com.br'
      },
      {
        nome: 'Carlos Eduardo Lima',
        cpf: '567.890.123-44',
        cargo: 'Analista Financeiro',
        departamento: 'financeiro',
        data_admissao: '2024-02-01',
        salario: 6000,
        status: 'ativo',
        telefone: '(11) 98765-4444',
        email: 'carlos.lima@construlog.com.br'
      }
    ]);
    resultados.colaboradores = colaboradores.length;

    // 5. MATERIAIS
    // Estoque Central (Matriz - Central de Compras)
    const materiaisEstoqueCentral = await base44.asServiceRole.entities.Material.bulkCreate([
      {
        codigo: 'MAT-CENTRAL-001',
        nome: 'Cimento CP-II 50kg - Estoque Central',
        categoria: 'cimento',
        unidade: 'sc',
        estoque_atual: 2500,
        estoque_minimo: 500,
        preco_medio: 32.50,
        almoxarifado_id: almoxarifados[0].id,
        empresa_id: matriz.id
      },
      {
        codigo: 'MAT-CENTRAL-002',
        nome: 'Vergalhão CA-50 10mm - Estoque Central',
        categoria: 'aco',
        unidade: 'kg',
        estoque_atual: 15000,
        estoque_minimo: 3000,
        preco_medio: 6.80,
        almoxarifado_id: almoxarifados[0].id,
        empresa_id: matriz.id
      },
      {
        codigo: 'MAT-CENTRAL-003',
        nome: 'EPI - Capacete - Estoque Central',
        categoria: 'epi',
        unidade: 'un',
        estoque_atual: 500,
        estoque_minimo: 100,
        preco_medio: 25.00,
        almoxarifado_id: almoxarifados[0].id,
        empresa_id: matriz.id
      }
    ]);

    // Materiais nas Obras (após transferência da central)
    const materiaisObras = await base44.asServiceRole.entities.Material.bulkCreate([
      {
        codigo: 'MAT-001',
        nome: 'Cimento CP-II 50kg',
        categoria: 'cimento',
        unidade: 'sc',
        estoque_atual: 450,
        estoque_minimo: 100,
        preco_medio: 32.50,
        almoxarifado_id: almoxarifados[6].id,
        empresa_id: subsidiarias[2].id,
        obra_id: obras[0].id
      },
      {
        codigo: 'MAT-002',
        nome: 'Areia Média m³',
        categoria: 'areia',
        unidade: 'm3',
        estoque_atual: 85,
        estoque_minimo: 20,
        preco_medio: 95.00,
        almoxarifado_id: almoxarifados[6].id,
        empresa_id: subsidiarias[2].id,
        obra_id: obras[0].id
      },
      {
        codigo: 'MAT-003',
        nome: 'Brita 1 m³',
        categoria: 'brita',
        unidade: 'm3',
        estoque_atual: 120,
        estoque_minimo: 30,
        preco_medio: 110.00,
        almoxarifado_id: almoxarifados[7].id,
        empresa_id: subsidiarias[0].id,
        obra_id: obras[1].id
      },
      {
        codigo: 'MAT-004',
        nome: 'Vergalhão CA-50 8mm',
        categoria: 'aco',
        unidade: 'kg',
        estoque_atual: 2800,
        estoque_minimo: 500,
        preco_medio: 6.80,
        almoxarifado_id: almoxarifados[7].id,
        empresa_id: subsidiarias[0].id,
        obra_id: obras[1].id
      },
      {
        codigo: 'MAT-005',
        nome: 'Tijolo Cerâmico 6 furos',
        categoria: 'acabamento',
        unidade: 'un',
        estoque_atual: 15000,
        estoque_minimo: 3000,
        preco_medio: 0.85,
        almoxarifado_id: almoxarifados[6].id,
        empresa_id: subsidiarias[2].id,
        obra_id: obras[0].id
      }
    ]);

    const materiais = [...materiaisEstoqueCentral, ...materiaisObras];
    resultados.materiais = materiais.length;

    // 6. VEÍCULOS E MOTORISTAS
    const motoristas = await base44.asServiceRole.entities.Motorista.bulkCreate([
      {
        nome: 'José Carlos Rodrigues',
        cpf: '678.901.234-55',
        cnh: '12345678901',
        categoria_cnh: 'D',
        validade_cnh: '2027-06-15',
        telefone: '(11) 98888-1111',
        status: 'ativo'
      },
      {
        nome: 'Marcos Antônio Silva',
        cpf: '789.012.345-66',
        cnh: '23456789012',
        categoria_cnh: 'E',
        validade_cnh: '2028-03-20',
        telefone: '(11) 98888-2222',
        status: 'ativo'
      }
    ]);
    resultados.motoristas = motoristas.length;

    const veiculos = await base44.asServiceRole.entities.Veiculo.bulkCreate([
      {
        placa: 'ABC-1234',
        tipo: 'caminhao',
        marca: 'Mercedes-Benz',
        modelo: 'Atego 1719',
        ano: 2022,
        status: 'ativo',
        km_atual: 45800,
        obra_vinculada: obras[0].id,
        motorista_responsavel: motoristas[0].nome,
        proxima_manutencao_km: 50000
      },
      {
        placa: 'DEF-5678',
        tipo: 'maquina_pesada',
        marca: 'Caterpillar',
        modelo: 'D6T',
        ano: 2021,
        status: 'ativo',
        km_atual: 1250,
        obra_vinculada: obras[1].id,
        motorista_responsavel: motoristas[1].nome,
        proxima_manutencao_km: 1500
      },
      {
        placa: 'GHI-9012',
        tipo: 'utilitario',
        marca: 'Fiat',
        modelo: 'Toro',
        ano: 2023,
        status: 'ativo',
        km_atual: 18500,
        obra_vinculada: obras[2].id,
        proxima_manutencao_km: 20000
      }
    ]);
    resultados.veiculos = veiculos.length;

    // 6. FORNECEDORES
    const fornecedores = await base44.asServiceRole.entities.Fornecedor.bulkCreate([
      {
        nome: 'Cimentos Brasil S.A.',
        cnpj: '11.222.333/0001-44',
        categoria: 'materiais',
        telefone: '(11) 4000-1000',
        email: 'vendas@cimentosbrasil.com.br',
        cidade: 'São Paulo',
        estado: 'SP',
        status: 'ativo',
        avaliacao_qualidade: 9.5
      },
      {
        nome: 'Areias e Britas Ltda',
        cnpj: '22.333.444/0001-55',
        categoria: 'materiais',
        telefone: '(11) 4000-2000',
        email: 'contato@areiasebritas.com.br',
        cidade: 'Guarulhos',
        estado: 'SP',
        status: 'ativo',
        avaliacao_qualidade: 8.8
      },
      {
        nome: 'Aços Especiais Ind. e Com.',
        cnpj: '33.444.555/0001-66',
        categoria: 'materiais',
        telefone: '(11) 4000-3000',
        email: 'vendas@acosespeciais.com.br',
        cidade: 'São Paulo',
        estado: 'SP',
        status: 'ativo',
        avaliacao_qualidade: 9.2
      }
    ]);
    resultados.fornecedores = fornecedores.length;

    // 7. CONTRATOS (Central de Compras)
    const contratos = await base44.asServiceRole.entities.Contrato.bulkCreate([
      {
        numero: 'CONT-CENTRAL-2025-001',
        tipo: 'fornecimento',
        fornecedor_id: fornecedores[0].id,
        descricao: 'Fornecimento centralizado de cimento para todas as obras',
        valor_total: 850000,
        data_inicio: '2025-01-10',
        data_fim: '2026-12-31',
        status: 'ativo',
        responsavel: user.email
      },
      {
        numero: 'CONT-CENTRAL-2024-045',
        tipo: 'fornecimento',
        fornecedor_id: fornecedores[2].id,
        descricao: 'Fornecimento centralizado de aço e vergalhões',
        valor_total: 1800000,
        data_inicio: '2024-09-01',
        data_fim: '2026-03-31',
        status: 'ativo',
        responsavel: user.email
      }
    ]);
    resultados.contratos = contratos.length;

    // 7.1 ORDENS DE COMPRA (Central compra e distribui para obras)
    const ordensCompra = await base44.asServiceRole.entities.OrdemCompra.bulkCreate([
      {
        numero: 'OC-2025-001',
        empresa_compradora_id: matriz.id,
        obra_destino_id: obras[0].id,
        fornecedor_id: fornecedores[0].id,
        fornecedor_nome: fornecedores[0].nome,
        descricao: 'Cimento CP-II 50kg para Obra Condomínio',
        quantidade: 500,
        unidade: 'sc',
        valor_unitario: 32.50,
        valor_total: 16250,
        data_emissao: '2025-01-05',
        data_prevista_entrega: '2025-01-12',
        condicoes_pagamento: '30 dias',
        status: 'em_transito',
        aprovado_por: user.email,
        data_aprovacao: '2025-01-05'
      },
      {
        numero: 'OC-2025-002',
        empresa_compradora_id: matriz.id,
        obra_destino_id: obras[1].id,
        fornecedor_id: fornecedores[2].id,
        fornecedor_nome: fornecedores[2].nome,
        descricao: 'Vergalhão CA-50 para Obra Ponte',
        quantidade: 5000,
        unidade: 'kg',
        valor_unitario: 6.80,
        valor_total: 34000,
        data_emissao: '2025-01-03',
        data_prevista_entrega: '2025-01-10',
        condicoes_pagamento: '45 dias',
        status: 'confirmada',
        aprovado_por: user.email,
        data_aprovacao: '2025-01-03'
      }
    ]);
    resultados.ordens_compra = ordensCompra.length;

    // 7.2 MOVIMENTAÇÕES DE ESTOQUE (Transferências entre Almoxarifados)
    const movimentacoes = await base44.asServiceRole.entities.MovimentacaoEstoque.bulkCreate([
      {
        material_id: materiaisEstoqueCentral[0].id,
        tipo: 'transferencia',
        quantidade: 500,
        almoxarifado_origem_id: almoxarifados[0].id,
        almoxarifado_destino_id: almoxarifados[6].id,
        obra_destino_id: obras[0].id,
        valor_unitario: 32.50,
        valor_total: 16250,
        data_movimentacao: '2025-01-06',
        responsavel: user.email,
        observacoes: 'Transferência do almoxarifado central para almoxarifado da Obra Condomínio'
      },
      {
        material_id: materiaisEstoqueCentral[1].id,
        tipo: 'transferencia',
        quantidade: 3000,
        almoxarifado_origem_id: almoxarifados[0].id,
        almoxarifado_destino_id: almoxarifados[7].id,
        obra_destino_id: obras[1].id,
        valor_unitario: 6.80,
        valor_total: 20400,
        data_movimentacao: '2025-01-07',
        responsavel: user.email,
        observacoes: 'Transferência do almoxarifado central para almoxarifado da Obra Ponte'
      },
      {
        material_id: materiaisEstoqueCentral[2].id,
        tipo: 'transferencia',
        quantidade: 50,
        almoxarifado_origem_id: almoxarifados[0].id,
        almoxarifado_destino_id: almoxarifados[8].id,
        obra_destino_id: obras[2].id,
        valor_unitario: 25.00,
        valor_total: 1250,
        data_movimentacao: '2025-01-08',
        responsavel: user.email,
        observacoes: 'Transferência de EPIs do almoxarifado central para almoxarifado da Obra Hospital'
      }
    ]);
    resultados.movimentacoes = movimentacoes.length;

    // 8. CONTAS FINANCEIRAS
    const contas = await base44.asServiceRole.entities.ContaFinanceira.bulkCreate([
      {
        tipo: 'pagar',
        descricao: 'Fornecimento de cimento - Parcela 1/12',
        valor: 23750,
        data_vencimento: '2025-02-10',
        status: 'pendente',
        obra_id: obras[0].id,
        categoria: 'material',
        fornecedor_cliente: fornecedores[0].nome,
        nota_fiscal: 'NF-12345'
      },
      {
        tipo: 'pagar',
        descricao: 'Mão de obra - Janeiro/2025',
        valor: 125000,
        data_vencimento: '2025-02-05',
        status: 'pendente',
        obra_id: obras[0].id,
        categoria: 'mao_de_obra'
      },
      {
        tipo: 'receber',
        descricao: 'Medição 3 - Condomínio Jardim',
        valor: 450000,
        data_vencimento: '2025-02-15',
        status: 'pendente',
        obra_id: obras[0].id,
        categoria: 'medicao',
        fornecedor_cliente: 'Incorporadora São Paulo S.A.'
      },
      {
        tipo: 'pagar',
        descricao: 'Aluguel de equipamentos',
        valor: 18500,
        data_vencimento: '2025-01-25',
        status: 'pago',
        data_pagamento: '2025-01-24',
        obra_id: obras[1].id,
        categoria: 'equipamento'
      }
    ]);
    resultados.contas = contas.length;

    // 9. TEMPLATES DE CHECKLIST
    const templates = await base44.asServiceRole.entities.TemplateChecklist.bulkCreate([
      {
        nome: 'Vistoria de Alvenaria',
        categoria: 'vistoria_obra',
        descricao: 'Checklist padrão para vistoria de alvenaria estrutural',
        itens: [
          { texto: 'Verificar prumo das paredes', obrigatorio: true },
          { texto: 'Conferir alinhamento horizontal', obrigatorio: true },
          { texto: 'Verificar espessura das juntas', obrigatorio: true },
          { texto: 'Conferir amarração dos cantos', obrigatorio: true },
          { texto: 'Verificar vãos de portas e janelas', obrigatorio: true },
          { texto: 'Conferir limpeza da argamassa', obrigatorio: false }
        ],
        ativo: true,
        uso_count: 0
      },
      {
        nome: 'Inspeção de Segurança Diária',
        categoria: 'seguranca',
        descricao: 'Checklist diário de segurança do trabalho',
        itens: [
          { texto: 'Verificar uso de EPIs', obrigatorio: true },
          { texto: 'Conferir estado dos andaimes', obrigatorio: true },
          { texto: 'Verificar proteção de bordas', obrigatorio: true },
          { texto: 'Conferir sinalização de segurança', obrigatorio: true },
          { texto: 'Verificar ordem e limpeza', obrigatorio: true },
          { texto: 'Conferir extintores', obrigatorio: true }
        ],
        ativo: true,
        uso_count: 0
      },
      {
        nome: 'Controle de Qualidade - Concreto',
        categoria: 'qualidade',
        descricao: 'Checklist para recebimento e aplicação de concreto',
        itens: [
          { texto: 'Verificar nota fiscal e rastreabilidade', obrigatorio: true },
          { texto: 'Conferir slump test', obrigatorio: true },
          { texto: 'Verificar temperatura do concreto', obrigatorio: true },
          { texto: 'Coletar corpos de prova', obrigatorio: true },
          { texto: 'Conferir vibração adequada', obrigatorio: true },
          { texto: 'Verificar cura do concreto', obrigatorio: true }
        ],
        ativo: true,
        uso_count: 0
      }
    ]);
    resultados.templates = templates.length;

    // 10. TAREFAS DE CAMPO
    const tarefas = await base44.asServiceRole.entities.TarefaCampo.bulkCreate([
      {
        obra_id: obras[0].id,
        titulo: 'Concretagem da laje do 3º pavimento',
        descricao: 'Realizar concretagem completa da laje',
        tipo: 'tarefa',
        prioridade: 'alta',
        status: 'em_andamento',
        responsavel: user.email,
        responsaveis: [user.email],
        data_prazo: '2025-01-15'
      },
      {
        obra_id: obras[0].id,
        titulo: 'Vistoria de alvenaria - Bloco A',
        descricao: 'Realizar vistoria completa da alvenaria',
        tipo: 'checklist',
        prioridade: 'normal',
        status: 'pendente',
        responsavel: user.email,
        responsaveis: [user.email],
        template_checklist_id: templates[0].id,
        data_prazo: '2025-01-12',
        itens_checklist: templates[0].itens.map(item => ({
          texto: item.texto,
          concluido: false,
          obrigatorio: item.obrigatorio
        }))
      },
      {
        obra_id: obras[1].id,
        titulo: 'Inspeção diária de segurança',
        descricao: 'Inspeção rotineira de segurança',
        tipo: 'checklist',
        prioridade: 'urgente',
        status: 'pendente',
        responsavel: user.email,
        responsaveis: [user.email],
        template_checklist_id: templates[1].id,
        data_prazo: '2025-01-10',
        itens_checklist: templates[1].itens.map(item => ({
          texto: item.texto,
          concluido: false,
          obrigatorio: item.obrigatorio
        }))
      }
    ]);
    resultados.tarefas = tarefas.length;

    // 11. DIÁRIOS DE OBRA
    const diarios = await base44.asServiceRole.entities.DiarioObra.bulkCreate([
      {
        obra_id: obras[0].id,
        data: '2025-01-09',
        clima: 'ensolarado',
        temperatura: 28,
        atividades_realizadas: 'Concretagem da fundação do bloco B, instalação de armaduras da laje',
        equipe_presente: '15 pedreiros, 3 armadores, 2 carpinteiros, 1 mestre de obras',
        materiais_utilizados: '25 sacos de cimento, 8m³ de areia, 12m³ de brita, 850kg de aço',
        equipamentos_utilizados: 'Betoneira 400L, guincho, andaimes',
        responsavel: user.full_name || user.email,
        fotos: []
      },
      {
        obra_id: obras[1].id,
        data: '2025-01-08',
        clima: 'nublado',
        temperatura: 24,
        atividades_realizadas: 'Montagem de estrutura metálica do vão principal',
        equipe_presente: '8 montadores, 2 soldadores, 1 engenheiro',
        materiais_utilizados: 'Perfis metálicos I, eletrodos de solda',
        equipamentos_utilizados: 'Guindaste 50t, máquina de solda',
        ocorrencias: 'Aguardando liberação da fiscalização para próxima etapa',
        responsavel: user.full_name || user.email,
        fotos: []
      }
    ]);
    resultados.diarios = diarios.length;

    // 12. ORÇAMENTOS
    const orcamentos = await base44.asServiceRole.entities.Orcamento.bulkCreate([
      {
        obra_id: obras[0].id,
        numero: 'ORC-2025-001',
        descricao: 'Orçamento completo - Condomínio Jardim das Flores',
        valor_total: 5200000,
        status: 'aprovado',
        data_orcamento: '2024-11-15',
        responsavel: user.email
      }
    ]);
    resultados.orcamentos = orcamentos.length;

    // 12.1 PROJETOS TÉCNICOS (por disciplina/setor)
    const projetos = await base44.asServiceRole.entities.ProjetoTecnico.bulkCreate([
      {
        codigo: 'PROJ-CIVIL-001',
        nome: 'Projeto Civil - Condomínio Jardim',
        obra_id: obras[0].id,
        disciplina: 'civil',
        responsavel_tecnico: 'Eng. Carlos Silva',
        art_rrt: 'ART-SP-2024-12345',
        status: 'em_execucao',
        data_inicio: '2024-11-01',
        data_previsao_entrega: '2025-03-15',
        revisao: 'Rev. 02',
        memorial_descritivo: 'Projeto civil completo incluindo fundações, estrutura e acabamentos'
      },
      {
        codigo: 'PROJ-ELETRICO-001',
        nome: 'Projeto Elétrico - Condomínio Jardim',
        obra_id: obras[0].id,
        disciplina: 'eletrico',
        responsavel_tecnico: 'Eng. Eletricista José Santos',
        art_rrt: 'ART-SP-2024-54321',
        status: 'aprovado',
        data_inicio: '2024-11-15',
        data_previsao_entrega: '2025-02-28',
        revisao: 'Rev. 01',
        memorial_descritivo: 'Projeto elétrico completo - quadros, circuitos, iluminação'
      },
      {
        codigo: 'PROJ-HIDRAULICO-001',
        nome: 'Projeto Hidráulico e Sanitário - Condomínio',
        obra_id: obras[0].id,
        disciplina: 'hidraulico',
        responsavel_tecnico: 'Eng. Hidráulico Pedro Almeida',
        art_rrt: 'ART-SP-2024-67890',
        status: 'em_execucao',
        data_inicio: '2024-12-01',
        data_previsao_entrega: '2025-03-30',
        revisao: 'Rev. 01'
      },
      {
        codigo: 'PROJ-ESTRUTURAL-002',
        nome: 'Projeto Estrutural - Ponte Rio Verde',
        obra_id: obras[1].id,
        disciplina: 'estrutural',
        responsavel_tecnico: 'Eng. Ana Paula Costa',
        art_rrt: 'ART-SP-2024-11111',
        status: 'em_execucao',
        data_inicio: '2024-06-01',
        data_previsao_entrega: '2025-12-31',
        revisao: 'Rev. 03',
        memorial_descritivo: 'Cálculo estrutural completo da ponte metálica'
      },
      {
        codigo: 'PROJ-ELETRICO-003',
        nome: 'Projeto Elétrico - Hospital Central',
        obra_id: obras[2].id,
        disciplina: 'eletrico',
        responsavel_tecnico: 'Eng. Fernando Elétrico',
        art_rrt: 'ART-SP-2024-22222',
        status: 'concluido',
        data_inicio: '2024-04-01',
        data_previsao_entrega: '2024-08-31',
        data_entrega_real: '2024-08-25',
        revisao: 'Rev. 02'
      },
      {
        codigo: 'PROJ-HIDRO-003',
        nome: 'Projeto Hidrossanitário - Hospital Central',
        obra_id: obras[2].id,
        disciplina: 'sanitario',
        responsavel_tecnico: 'Eng. Sanitarista Maria Água',
        art_rrt: 'ART-SP-2024-33333',
        status: 'aprovado',
        data_inicio: '2024-05-01',
        data_previsao_entrega: '2024-09-30',
        revisao: 'Rev. 01'
      }
    ]);
    resultados.projetos_tecnicos = projetos.length;

    // 13. EQUIPES
    const equipes = await base44.asServiceRole.entities.Equipe.bulkCreate([
      {
        nome: 'Equipe Alvenaria A',
        obra_id: obras[0].id,
        lider_id: colaboradores[2].id,
        membros_ids: [colaboradores[0].id, colaboradores[2].id],
        especialidade: 'Alvenaria estrutural',
        status: 'ativa'
      },
      {
        nome: 'Equipe Estrutura Metálica',
        obra_id: obras[1].id,
        lider_id: colaboradores[1].id,
        membros_ids: [colaboradores[1].id],
        especialidade: 'Montagem de estruturas metálicas',
        status: 'ativa'
      }
    ]);
    resultados.equipes = equipes.length;

    // 14. TREINAMENTOS
    const treinamentos = await base44.asServiceRole.entities.Treinamento.bulkCreate([
      {
        titulo: 'NR-35 - Trabalho em Altura',
        tipo: 'nr35',
        carga_horaria: 8,
        instrutor: 'José Treinamentos Ltda',
        data_realizacao: '2024-12-10',
        validade_meses: 24,
        colaboradores_ids: [colaboradores[0].id, colaboradores[2].id],
        status: 'realizado'
      },
      {
        titulo: 'NR-18 - Construção Civil',
        tipo: 'nr18',
        carga_horaria: 6,
        instrutor: 'Segurança Total',
        data_realizacao: '2025-01-05',
        validade_meses: 12,
        colaboradores_ids: colaboradores.map(c => c.id),
        status: 'realizado'
      }
    ]);
    resultados.treinamentos = treinamentos.length;

    // 15. ASOs
    const asos = await base44.asServiceRole.entities.ASO.bulkCreate([
      {
        colaborador_id: colaboradores[0].id,
        tipo: 'periodico',
        medico_responsavel: 'Dr. Paulo Santos',
        crm: '123456',
        data_exame: '2024-12-15',
        data_validade: '2025-12-15',
        resultado: 'apto',
        exames_realizados: ['Hemograma', 'Audiometria', 'Acuidade Visual']
      },
      {
        colaborador_id: colaboradores[1].id,
        tipo: 'periodico',
        medico_responsador: 'Dra. Ana Lima',
        crm: '234567',
        data_exame: '2024-11-20',
        data_validade: '2025-11-20',
        resultado: 'apto',
        exames_realizados: ['Hemograma', 'Radiografia de Tórax']
      }
    ]);
    resultados.asos = asos.length;

    // 16. RISCOS
    const riscos = await base44.asServiceRole.entities.Risco.bulkCreate([
      {
        titulo: 'Atraso na entrega de estruturas metálicas',
        categoria: 'operacional',
        tipo: 'tatico',
        descricao: 'Possível atraso de 15 dias na entrega das estruturas',
        obra_id: obras[1].id,
        probabilidade: 'media',
        impacto: 'alto',
        nivel_risco: 6,
        classificacao_risco: 'alto',
        impacto_financeiro_estimado: 180000,
        plano_mitigacao: 'Negociar com fornecedor alternativo',
        responsavel: user.email,
        status: 'em_analise'
      },
      {
        titulo: 'Chuvas intensas no período',
        categoria: 'operacional',
        tipo: 'operacional',
        descricao: 'Previsão de chuvas fortes que podem atrasar concretagem',
        obra_id: obras[0].id,
        probabilidade: 'alta',
        impacto: 'medio',
        nivel_risco: 7,
        classificacao_risco: 'alto',
        plano_mitigacao: 'Preparar cobertura provisória',
        responsavel: user.email,
        status: 'mitigando'
      }
    ]);
    resultados.riscos = riscos.length;

    return Response.json({
      success: true,
      message: 'Dados de exemplo criados com sucesso!',
      detalhes: resultados,
      total: Object.values(resultados).reduce((a, b) => a + b, 0)
    });

  } catch (error) {
    console.error('Erro ao popular dados:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});
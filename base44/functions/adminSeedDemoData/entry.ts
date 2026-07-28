import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const generateRandomName = (prefix = 'DEMO') => {
  const names = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Fernandes'];
  const firstNames = ['João', 'Maria', 'José', 'Ana', 'Carlos', 'Paula', 'Pedro', 'Mariana'];
  return `${prefix} ${firstNames[Math.floor(Math.random() * firstNames.length)]} ${names[Math.floor(Math.random() * names.length)]}`;
};

const generateRandomCompany = (prefix = 'DEMO') => {
  const types = ['Construções', 'Engenharia', 'Obras', 'Construtora', 'Infraestrutura'];
  return `${prefix} ${types[Math.floor(Math.random() * types.length)]} Ltda`;
};

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    const payload = await req.json();
    const {
      qtdObras = 5,
      insumosPorObra = 20,
      qtdClientes = 5,
      qtdFornecedores = 5,
      gerarComprasEstoque = false,
      gerarMedicoes = false,
      gerarLogistica = false,
      prefixo = 'DEMO'
    } = payload;

    const demoRunId = crypto.randomUUID();
    const created = {};

    // 1. Criar clientes
    const clientes = [];
    for (let i = 0; i < qtdClientes; i++) {
      const cliente = await base44.asServiceRole.entities.Cliente.create({
        nome: generateRandomCompany(prefixo),
        tipo: Math.random() > 0.5 ? 'pessoa_juridica' : 'pessoa_fisica',
        cpf_cnpj: `${Math.floor(Math.random() * 100000000000000)}`,
        telefone: `(11) 9${Math.floor(Math.random() * 100000000)}`,
        email: `${prefixo.toLowerCase()}.cliente${i}@demo.com`,
        is_demo: true,
        demo_run_id: demoRunId
      });
      clientes.push(cliente);
    }
    created.Cliente = clientes.length;

    // 2. Criar fornecedores
    const fornecedores = [];
    for (let i = 0; i < qtdFornecedores; i++) {
      const fornecedor = await base44.asServiceRole.entities.Fornecedor.create({
        nome: generateRandomCompany(prefixo),
        cnpj: `${Math.floor(Math.random() * 100000000000000)}`,
        telefone: `(11) 3${Math.floor(Math.random() * 100000000)}`,
        email: `${prefixo.toLowerCase()}.fornecedor${i}@demo.com`,
        is_demo: true,
        demo_run_id: demoRunId
      });
      fornecedores.push(fornecedor);
    }
    created.Fornecedor = fornecedores.length;

    // 3. Criar obras
    const obras = [];
    for (let i = 0; i < qtdObras; i++) {
      const cliente = clientes[Math.floor(Math.random() * clientes.length)];
      const obra = await base44.asServiceRole.entities.Obra.create({
        codigo: `${prefixo}-OBR-${i + 1}`,
        nome: `${prefixo} Obra ${i + 1} - Construção Residencial`,
        tipo: Math.random() > 0.5 ? 'publica' : 'privada',
        tipo_obra: 'edificacao',
        fase: 'ativa',
        status: 'em_andamento',
        cliente: cliente.nome,
        cliente_id: cliente.id,
        total_orcamento: Math.floor(Math.random() * 5000000) + 500000,
        data_inicio: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        data_prevista_fim: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        cidade: 'São Paulo',
        estado: 'SP',
        is_demo: true,
        demo_run_id: demoRunId
      });
      obras.push(obra);
    }
    created.Obra = obras.length;

    // 4. Criar insumos e vínculos com obras
    const insumos = [];
    const demandasEstoque = [];
    
    const tiposInsumo = [
      { descricao: 'Cimento Portland CP-II 50kg', unidade: 'sc', grupo: 'material_construcao', base: 'sinapi', preco: 35.50 },
      { descricao: 'Areia Média m³', unidade: 'm3', grupo: 'material_construcao', base: 'sinapi', preco: 85.00 },
      { descricao: 'Brita 1 m³', unidade: 'm3', grupo: 'material_construcao', base: 'sinapi', preco: 95.00 },
      { descricao: 'Tijolo Cerâmico 6 furos', unidade: 'un', grupo: 'material_construcao', base: 'sinapi', preco: 0.85 },
      { descricao: 'Vergalhão CA-50 8mm', unidade: 'kg', grupo: 'material_construcao', base: 'sinapi', preco: 6.20 },
      { descricao: 'Tubo PVC Esgoto 100mm 6m', unidade: 'un', grupo: 'material_construcao', base: 'sinapi', preco: 45.00 },
      { descricao: 'Tinta Acrílica Premium 18L', unidade: 'l', grupo: 'material_construcao', base: 'sinapi', preco: 285.00 }
    ];

    for (const obra of obras) {
      for (let i = 0; i < insumosPorObra; i++) {
        const tipo = tiposInsumo[i % tiposInsumo.length];
        const codigo = `${prefixo}-INS-${obras.indexOf(obra)}-${i}`;
        
        const insumo = await base44.asServiceRole.entities.Insumo.create({
          codigo,
          banco: tipo.base,
          descricao: `${tipo.descricao} (${prefixo})`,
          unidade: tipo.unidade,
          tipo: 'material',
          grupo: tipo.grupo,
          base: tipo.base,
          preco_unitario: tipo.preco * (0.8 + Math.random() * 0.4),
          ativo: true,
          is_demo: true,
          demo_run_id: demoRunId
        });
        insumos.push(insumo);

        // Criar vínculo com obra
        const demanda = await base44.asServiceRole.entities.DemandaEstoqueObra.create({
          obra_id: obra.id,
          insumo_id: insumo.id,
          insumo_descricao: insumo.descricao,
          unidade: insumo.unidade,
          quantidade_prevista: Math.floor(Math.random() * 500) + 50,
          quantidade_comprada: 0,
          quantidade_recebida: 0,
          quantidade_consumida: 0,
          saldo: 0,
          is_demo: true,
          demo_run_id: demoRunId
        });
        demandasEstoque.push(demanda);
      }
    }
    created.Insumo = insumos.length;
    created.DemandaEstoqueObra = demandasEstoque.length;

    // 5. Gerar compras e estoque (se solicitado)
    if (gerarComprasEstoque) {
      const requisicoes = [];
      for (const obra of obras.slice(0, Math.min(3, obras.length))) {
        const req = await base44.asServiceRole.entities.RequisicaoCompra.create({
          obra_id: obra.id,
          numero: `REQ-${prefixo}-${requisicoes.length + 1}`,
          data_requisicao: new Date().toISOString().split('T')[0],
          solicitante: user.email,
          status: 'aprovada',
          observacoes: `Requisição demo ${prefixo}`,
          is_demo: true,
          demo_run_id: demoRunId
        });
        requisicoes.push(req);
      }
      created.RequisicaoCompra = requisicoes.length;
    }

    // 6. Gerar medições (se solicitado)
    if (gerarMedicoes) {
      const medicoes = [];
      for (const obra of obras.slice(0, Math.min(2, obras.length))) {
        const medicao = await base44.asServiceRole.entities.Medicao.create({
          obra_id: obra.id,
          numero: `MED-${prefixo}-${medicoes.length + 1}`,
          data_medicao: new Date().toISOString().split('T')[0],
          responsavel_email: user.email,
          status: 'confirmada',
          valor_total_realizado: Math.floor(Math.random() * 100000) + 10000,
          is_demo: true,
          demo_run_id: demoRunId
        });
        medicoes.push(medicao);
      }
      created.Medicao = medicoes.length;
    }

    // 7. Gerar logística (se solicitado)
    if (gerarLogistica) {
      const viagens = [];
      for (const obra of obras.slice(0, Math.min(2, obras.length))) {
        const viagem = await base44.asServiceRole.entities.Viagem.create({
          obra_id: obra.id,
          motorista: generateRandomName(prefixo),
          veiculo_placa: `${prefixo}${Math.floor(Math.random() * 9999)}`,
          data_inicio: new Date().toISOString(),
          status: 'em_andamento',
          is_demo: true,
          demo_run_id: demoRunId
        });
        viagens.push(viagem);
      }
      created.Viagem = viagens.length;
    }

    const duration = Date.now() - startTime;

    // Registrar log
    await base44.asServiceRole.entities.DataAdminLog.create({
      action: 'SEED',
      executed_by_user_id: user.id,
      executed_by_email: user.email,
      scope_json: { qtdObras, insumosPorObra, qtdClientes, qtdFornecedores, gerarComprasEstoque, gerarMedicoes, gerarLogistica, prefixo },
      result_json: { demoRunId, created },
      status: 'SUCCESS',
      duration_ms: duration
    });

    return Response.json({ 
      success: true,
      demoRunId,
      created,
      duration_ms: duration 
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    try {
      const base44 = createClientFromRequest(req);
      const user = await base44.auth.me();
      
      await base44.asServiceRole.entities.DataAdminLog.create({
        action: 'SEED',
        executed_by_user_id: user?.id,
        executed_by_email: user?.email,
        scope_json: {},
        result_json: {},
        status: 'ERROR',
        error_message: error.message,
        duration_ms: duration
      });
    } catch (logError) {
      console.error('Erro ao registrar log:', logError);
    }

    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});
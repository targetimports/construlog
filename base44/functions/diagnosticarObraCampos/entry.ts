import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload = {};
    try {
      payload = await req.json();
    } catch (e) {
      return Response.json({ error: 'Corpo JSON inválido' }, { status: 400 });
    }
    const { obra_id } = payload;

    if (!obra_id) {
      return Response.json({ error: 'obra_id é obrigatório' }, { status: 400 });
    }

    // Buscar registro bruto do banco
    let obra = null;
    try {
      obra = await base44.entities.Obra.read(obra_id);
    } catch (e) {
      console.warn('[diagnosticarObraCampos] Obra.read falhou, tentando filter:', e.message);
      const obrasFiltered = await base44.entities.Obra.filter({ id: obra_id }) || [];
      obra = obrasFiltered[0] || null;
    }

    if (!obra) {
      return Response.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    // Normalizar campos para checklist
    const camposImportantes = {
      nome: obra.nome,
      cliente_id: obra.cliente_id,
      cliente_nome: obra.cliente,
      cidade: obra.cidade,
      uf: obra.uf || obra.estado, // suportar ambos
      estado: obra.estado || obra.uf,
      cep: obra.cep,
      logradouro: obra.logradouro || obra.rua,
      rua: obra.rua || obra.logradouro,
      bairro: obra.bairro,
      numero: obra.numero,
      complemento: obra.complemento,
      categoria_dre: obra.categoria_dre,
      tipo_estrutural: obra.tipo_estrutural,
      tipo_intervencao: obra.tipo_intervencao,
      responsavel_tecnico: obra.responsavel_tecnico,
      responsavel_tecnico_id: obra.responsavel_tecnico_id,
      responsavel_obra: obra.responsavel_obra,
      responsavel_obra_id: obra.responsavel_obra_id,
      data_inicio: obra.data_inicio,
      data_fim_previsto: obra.data_fim_previsto || obra.data_prevista_fim,
      tipo: obra.tipo,
      status_inicial: obra.status_inicial || obra.status,
      centro_custo_codigo: obra.centro_custo_codigo,
      centro_custo_nome: obra.centro_custo_nome,
    };

    // Checklist de campos obrigatórios/importantes
    const missingFields = [];
    if (!camposImportantes.nome) missingFields.push('nome');
    if (!camposImportantes.cliente_id && !camposImportantes.cliente_nome) missingFields.push('cliente');
    if (!camposImportantes.cidade) missingFields.push('cidade');
    if (!camposImportantes.uf && !camposImportantes.estado) missingFields.push('uf/estado');
    if (!camposImportantes.categoria_dre) missingFields.push('categoria_dre');
    if (!camposImportantes.tipo_estrutural) missingFields.push('tipo_estrutural');
    if (!camposImportantes.tipo_intervencao) missingFields.push('tipo_intervencao');

    return Response.json({
      obra_id,
      obra_raw: obra,
      campos_importantes: camposImportantes,
      missingFields,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ diagnosticarObraCampos error:', error.message);
    return Response.json({
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    }, { status: 500 });
  }
});
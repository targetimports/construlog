import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity, entityId, searchText, tipo, page = 1, limit = 50 } = await req.json();

    const entityMap = {
      'contrato': { name: 'DocumentoContrato', idField: 'contrato_id' },
      'medicao-contrato': { name: 'DocumentoMedicaoContrato', idField: 'medicao_contrato_id' },
      'nao-conformidade': { name: 'DocumentoNaoConformidade', idField: 'nao_conformidade_id' }
    };

    const config = entityMap[entity];
    if (!config) {
      return Response.json({ error: 'Entity type not found' }, { status: 400 });
    }

    // Buscar documentos
    let docs = await base44.entities[config.name].filter({
      [config.idField]: entityId,
      status: 'ativo'
    }) || [];

    // Filtrar por permissão (baseado em role)
    docs = docs.filter(doc => 
      !doc.visivel_para_roles || 
      doc.visivel_para_roles.includes(user.role) ||
      user.role === 'admin'
    );

    // Filtrar por texto
    if (searchText) {
      const search = searchText.toLowerCase();
      docs = docs.filter(doc =>
        doc.titulo.toLowerCase().includes(search) ||
        doc.tags?.some(tag => tag.toLowerCase().includes(search))
      );
    }

    // Filtrar por tipo
    if (tipo && tipo !== 'todos') {
      docs = docs.filter(doc => doc.tipo === tipo);
    }

    // Paginação
    const skip = (page - 1) * limit;
    const paginated = docs.slice(skip, skip + limit);

    return Response.json({
      data: paginated,
      total: docs.length,
      page,
      limit
    });
  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
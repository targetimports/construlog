import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_id, termo_busca, tipo, tags, data_inicio, data_fim } = await req.json();

    if (!obra_id) {
      return Response.json({ error: 'obra_id obrigatório' }, { status: 400 });
    }

    // 1️⃣ BUSCAR DOCUMENTOS COM FILTROS
    let documentos = await base44.entities.DocumentoObra.filter({ obra_id });

    // Filtrar por termo de busca (nome, descricao, tags, conteúdo)
    if (termo_busca) {
      const termo = termo_busca.toLowerCase();
      documentos = documentos.filter(d => {
        const nomeMatch = d.nome?.toLowerCase().includes(termo);
        const descricaoMatch = d.descricao?.toLowerCase().includes(termo);
        const tagsMatch = d.tags?.some(t => t.toLowerCase().includes(termo));
        const conteudoMatch = d.conteudo_indexado?.toLowerCase().includes(termo);
        return nomeMatch || descricaoMatch || tagsMatch || conteudoMatch;
      });
    }

    // Filtrar por tipo
    if (tipo) {
      documentos = documentos.filter(d => d.tipo === tipo);
    }

    // Filtrar por tags
    if (tags && Array.isArray(tags) && tags.length > 0) {
      documentos = documentos.filter(d => {
        return tags.some(tag => d.tags?.includes(tag));
      });
    }

    // Filtrar por data
    if (data_inicio || data_fim) {
      documentos = documentos.filter(d => {
        const dataDoc = new Date(d.data_criacao);
        if (data_inicio && dataDoc < new Date(data_inicio)) return false;
        if (data_fim && dataDoc > new Date(data_fim)) return false;
        return true;
      });
    }

    // 2️⃣ BUSCAR FASES ASSOCIADAS
    const faseIds = [...new Set(documentos.map(d => d.fase_id))];
    const fases = await base44.entities.Fase.filter({ id: { $in: faseIds } });
    const fasesMap = Object.fromEntries(fases.map(f => [f.id, f]));

    // 3️⃣ FORMATAR RESPOSTA
    const resultados = documentos.map(doc => ({
      id: doc.id,
      nome: doc.nome,
      tipo: doc.tipo,
      descricao: doc.descricao,
      tags: doc.tags || [],
      versao: doc.versao_atual,
      criado_em: doc.data_criacao,
      modificado_em: doc.data_modificacao,
      criado_por: doc.criado_por,
      fase_nome: fasesMap[doc.fase_id]?.nome || 'Desconhecido',
      arquivo_url: doc.arquivo_url
    }));

    return Response.json({
      sucesso: true,
      total_resultados: resultados.length,
      resultados: resultados.sort((a, b) => new Date(b.modificado_em) - new Date(a.modificado_em))
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
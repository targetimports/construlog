import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { acao, documento_id, arquivo_url, descricao_mudancas } = await req.json();

    if (!acao || !documento_id) {
      return Response.json({ error: 'acao e documento_id obrigatórios' }, { status: 400 });
    }

    // 1️⃣ BUSCAR DOCUMENTO
    const documentos = await base44.entities.DocumentoObra.filter({ id: documento_id });
    if (!documentos || documentos.length === 0) {
      return Response.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    const doc = documentos[0];

    if (acao === 'criar_versao') {
      // 2️⃣ CRIAR NOVA VERSÃO
      const novaVersao = doc.versao_atual + 1;

      // Salvar versão anterior
      await base44.entities.VersaoDocumento.create({
        documento_id,
        numero_versao: novaVersao,
        arquivo_url,
        tamanho_bytes: arquivo_url ? 0 : doc.tamanho_bytes,
        descricao_mudancas,
        criado_por: user.email
      });

      // Atualizar documento
      await base44.entities.DocumentoObra.update(documento_id, {
        arquivo_url,
        versao_atual: novaVersao,
        modificado_por: user.email,
        data_modificacao: new Date().toISOString()
      });

      // Registrar log
      await base44.entities.LogDocumento.create({
        documento_id,
        obra_id: doc.obra_id,
        acao: 'versao_criada',
        detalhes: `Versão ${novaVersao} criada`,
        usuario_email: user.email,
        data_acao: new Date().toISOString(),
        versao_anterior: doc.versao_atual,
        versao_nova: novaVersao
      });

      return Response.json({
        sucesso: true,
        mensagem: `Versão ${novaVersao} criada com sucesso`,
        versao_nova: novaVersao
      });
    }

    if (acao === 'restaurar_versao') {
      // 3️⃣ RESTAURAR VERSÃO ANTERIOR
      const versaoNumero = parseInt(descricao_mudancas);
      if (!versaoNumero) {
        return Response.json({ error: 'Número da versão inválido' }, { status: 400 });
      }

      const versoes = await base44.entities.VersaoDocumento.filter({
        documento_id,
        numero_versao: versaoNumero
      });

      if (!versoes || versoes.length === 0) {
        return Response.json({ error: 'Versão não encontrada' }, { status: 404 });
      }

      const versao = versoes[0];

      // Criar nova versão com conteúdo da versão anterior
      const novaVersao = doc.versao_atual + 1;
      await base44.entities.VersaoDocumento.create({
        documento_id,
        numero_versao: novaVersao,
        arquivo_url: versao.arquivo_url,
        tamanho_bytes: versao.tamanho_bytes,
        descricao_mudancas: `Restaurado da versão ${versaoNumero}`,
        criado_por: user.email
      });

      // Atualizar documento
      await base44.entities.DocumentoObra.update(documento_id, {
        arquivo_url: versao.arquivo_url,
        versao_atual: novaVersao,
        modificado_por: user.email,
        data_modificacao: new Date().toISOString()
      });

      // Registrar log
      await base44.entities.LogDocumento.create({
        documento_id,
        obra_id: doc.obra_id,
        acao: 'versao_criada',
        detalhes: `Restaurado para versão ${versaoNumero}`,
        usuario_email: user.email,
        data_acao: new Date().toISOString(),
        versao_anterior: doc.versao_atual,
        versao_nova: novaVersao
      });

      return Response.json({
        sucesso: true,
        mensagem: `Documento restaurado para versão ${versaoNumero}`,
        versao_nova: novaVersao
      });
    }

    if (acao === 'listar_versoes') {
      // 4️⃣ LISTAR HISTÓRICO DE VERSÕES
      const versoes = await base44.entities.VersaoDocumento.filter({ documento_id });
      const logs = await base44.entities.LogDocumento.filter({ documento_id });

      return Response.json({
        sucesso: true,
        versao_atual: doc.versao_atual,
        versoes: versoes.sort((a, b) => b.numero_versao - a.numero_versao),
        historico: logs.sort((a, b) => new Date(b.data_acao) - new Date(a.data_acao))
      });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
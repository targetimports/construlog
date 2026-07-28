import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url, file_name, contexto_tipo, contexto_id, contexto_descricao, tags } = await req.json();

    if (!file_url || !file_name || !contexto_tipo) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Extrair extensão para determinar tipo
    const ext = file_name.split('.').pop().toLowerCase();
    let file_type = 'outro';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) file_type = 'image';
    else if (ext === 'pdf') file_type = 'pdf';
    else if (['doc', 'docx', 'xlsx', 'xls', 'ppt', 'pptx'].includes(ext)) file_type = 'document';

    // Registrar upload
    const registro = await base44.entities.UploadArquivo.create({
      file_url,
      file_name,
      file_type,
      contexto_tipo,
      contexto_id: contexto_id || '',
      contexto_descricao: contexto_descricao || '',
      uploaded_by: user.email,
      tags: tags || []
    });

    return Response.json({
      status: 'sucesso',
      arquivo_id: registro.id,
      mensagem: 'Arquivo registrado com sucesso'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
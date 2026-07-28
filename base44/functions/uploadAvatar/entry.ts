import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validar tamanho
    if (file.size > MAX_SIZE) {
      return Response.json({ 
        error: 'File too large. Maximum size is 2MB' 
      }, { status: 400 });
    }

    // Validar tipo MIME
    if (!ALLOWED_MIMES.includes(file.type)) {
      return Response.json({ 
        error: 'Invalid image format. Only JPG, PNG, and WebP are allowed' 
      }, { status: 400 });
    }

    // Converter arquivo para buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload usando UploadFile da integração Core
    const uploadResponse = await base44.asServiceRole.integrations.Core.UploadFile({
      file: buffer
    });

    const avatarUrl = uploadResponse.file_url;

    // Atualizar usuário com a URL do avatar
    await base44.auth.updateMe({
      avatar_url: avatarUrl
    });

    return Response.json({ 
      ok: true,
      avatar_url: avatarUrl
    });

  } catch (error) {
    console.error('Avatar upload error:', error);
    return Response.json({ 
      error: error.message || 'Upload failed' 
    }, { status: 500 });
  }
});
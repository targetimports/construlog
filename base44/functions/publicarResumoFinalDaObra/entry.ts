import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validar permissão: admin, engenheiro, orcamentista
    const rolesPermitidas = ['admin', 'engenheiro', 'orcamentista'];
    const permissoes = await base44.entities.PermissaoUsuario.filter({ 
      user_email: user.email 
    });
    const temPermissao = user.role === 'admin' || 
                         rolesPermitidas.includes(user.role) ||
                         permissoes.some(p => rolesPermitidas.includes(p.cargo));

    if (!temPermissao) {
      return Response.json({ error: 'Sem permissão para esta ação' }, { status: 403 });
    }

    const { 
      obra_id, 
      total_custo_direto = 0,
      total_bdi = 0,
      total_final = 0,
      status_orcamento = 'fechado',
      ultimo_orcamento_id,
      ultimo_contrato_id,
      observacoes = ''
    } = await req.json();

    if (!obra_id) {
      return Response.json({ error: 'obra_id obrigatório' }, { status: 400 });
    }

    // Buscar obra para pegar cliente_id
    const obras = await base44.entities.Obra.list();
    const obra = obras.find(o => o.id === obra_id);

    if (!obra) {
      return Response.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    // Buscar ou criar ResumoObra
    const resumos = await base44.entities.ResumoObra.filter({ 
      obra_id: obra_id 
    });
    const resumoExistente = resumos[0];

    const dadosResumo = {
      obra_id: obra_id,
      cliente_id: obra.cliente_id,
      total_custo_direto: Number(total_custo_direto),
      total_bdi: Number(total_bdi),
      total_final: Number(total_final),
      status_orcamento: status_orcamento,
      ultimo_orcamento_id: ultimo_orcamento_id || null,
      ultimo_contrato_id: ultimo_contrato_id || null,
      data_fechamento_orcamento: status_orcamento === 'fechado' ? new Date().toISOString().split('T')[0] : null,
      observacoes: observacoes
    };

    let resultado;
    if (resumoExistente) {
      await base44.entities.ResumoObra.update(resumoExistente.id, dadosResumo);
      resultado = { ...resumoExistente, ...dadosResumo, id: resumoExistente.id };
    } else {
      resultado = await base44.entities.ResumoObra.create(dadosResumo);
    }

    return Response.json({
      success: true,
      message: `ResumoObra ${resumoExistente ? 'atualizado' : 'criado'} com sucesso`,
      resumo_obra: resultado
    });
  } catch (error) {
    console.error('Erro ao publicar resumo:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
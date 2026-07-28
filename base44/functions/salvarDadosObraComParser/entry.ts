/**
 * salvarDadosObraComParser
 * 
 * Recebe os dados parseados de analisarTextoDaObra + dados do usuário
 * e salva na Obra para uso em Financeiro/DRE
 * 
 * INPUT:
 * {
 *   obra_id: string,
 *   nome_obra: string,
 *   natureza_obra: "PUBLICA" | "PRIVADA" | "INDEFINIDA",
 *   tipo_estrutural: string,
 *   tipo_intervencao: string,
 *   categoria_dre: string,
 *   centro_custo_nome: string,
 *   cliente: string,
 *   cidade: string,
 *   estado: string,
 *   ... outros campos
 * }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await req.json();
    const {
      obra_id,
      nome_obra,
      natureza_obra,
      tipo_estrutural,
      tipo_intervencao,
      categoria_dre,
      centro_custo_nome,
      cliente,
      cidade,
      estado,
      responsavel_user_ids,
      tipo,
      data_inicio,
      data_prevista_fim,
      novo_cliente_nome
    } = payload;

    if (!obra_id || !nome_obra) {
      return Response.json(
        { error: 'obra_id e nome_obra são obrigatórios' },
        { status: 400 }
      );
    }

    // ===== Construir objeto da Obra =====
    const dadosObra = {
      nome: nome_obra,
      nome_obra,
      natureza_obra: natureza_obra || 'INDEFINIDA',
      tipo_estrutural,
      tipo_intervencao,
      categoria_dre,
      centro_custo_nome,
      tipo_privacao: tipo === 'publica' ? 'publica' : 'privada',
      cliente_nome: cliente || novo_cliente_nome || null,
      municipio: cidade,
      estado,
      data_inicio,
      data_prevista_fim,
      responsaveis: responsavel_user_ids || []
    };

    // ===== Salvar na Obra =====
    const obraAtualizada = await base44.entities.Obra.update(obra_id, dadosObra);

    // ===== Log de Auditoria =====
    await base44.asServiceRole.entities.SystemLogs.create({
      function_name: 'salvarDadosObraComParser',
      user_email: user.email,
      user_role: user.role,
      payload: JSON.stringify({
        obra_id,
        natureza_obra,
        tipo_estrutural,
        tipo_intervencao,
        categoria_dre
      }),
      result: 'success',
      execution_time_ms: 0,
      timestamp: new Date().toISOString(),
      metadata: { obra_id }
    });

    return Response.json({
      success: true,
      obra: obraAtualizada,
      mensagem: 'Dados da obra salvos com sucesso'
    });

  } catch (error) {
    console.error('Erro em salvarDadosObraComParser:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});
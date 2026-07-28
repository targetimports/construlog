import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { integracao_id } = await req.json();

    const integracao = await base44.asServiceRole.entities.Integracao.get(integracao_id);

    if (!integracao) {
      return Response.json({ 
        success: false, 
        message: 'Integração não encontrada' 
      }, { status: 404 });
    }

    if (!integracao.ativa) {
      return Response.json({ 
        success: false, 
        message: 'Integração está desativada' 
      });
    }

    // Testar conexão baseado no tipo
    let testResult = { success: false, message: 'Tipo de integração não suportado' };

    switch (integracao.tipo) {
      case 'contabil':
      case 'erp':
        // Testar API REST
        if (integracao.configuracao?.api_url) {
          try {
            const response = await fetch(integracao.configuracao.api_url, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${integracao.configuracao.api_key}`
              }
            });
            testResult = {
              success: response.ok,
              message: response.ok ? 'Conexão bem-sucedida' : `Erro: ${response.status}`
            };
          } catch (error) {
            testResult = {
              success: false,
              message: `Erro de conexão: ${error.message}`
            };
          }
        }
        break;

      case 'email':
        // Validar configuração SMTP
        testResult = {
          success: !!(integracao.configuracao?.smtp_host && 
                     integracao.configuracao?.smtp_port),
          message: integracao.configuracao?.smtp_host 
            ? 'Configuração válida' 
            : 'Configuração incompleta'
        };
        break;

      case 'whatsapp':
        // Validar token e phone_id
        testResult = {
          success: !!(integracao.configuracao?.phone_id && 
                     integracao.configuracao?.access_token),
          message: integracao.configuracao?.access_token 
            ? 'Credenciais configuradas' 
            : 'Credenciais incompletas'
        };
        break;

      default:
        testResult = {
          success: !!integracao.configuracao,
          message: integracao.configuracao 
            ? 'Configuração presente' 
            : 'Sem configuração'
        };
    }

    // Atualizar última verificação
    await base44.asServiceRole.entities.Integracao.update(integracao_id, {
      ultima_verificacao: new Date().toISOString(),
      status_ultimo_teste: testResult.success ? 'sucesso' : 'falha'
    });

    // Log de auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'testar_integracao',
      modulo: 'integracoes',
      detalhes: `Integração: ${integracao.nome}, Resultado: ${testResult.success ? 'Sucesso' : 'Falha'}`
    });

    return Response.json(testResult);

  } catch (error) {
    console.error('Erro ao testar integração:', error);
    return Response.json({ 
      success: false,
      message: error.message 
    }, { status: 500 });
  }
});
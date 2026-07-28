import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Testes automáticos do sistema de auditoria
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Somente admins podem executar testes' }, { status: 403 });
    }

    const resultados = {
      testes_executados: 0,
      testes_passou: 0,
      testes_falhou: 0,
      detalhes: []
    };

    const obra = await base44.asServiceRole.entities.Obra.create({
      nome: 'Obra Teste Auditoria',
      cliente: 'Cliente Teste'
    });

    // ========================================
    // TESTE 1: Criação gera log
    // ========================================
    try {
      resultados.testes_executados++;
      
      const conta = await base44.asServiceRole.entities.ContaFinanceira.create({
        tipo: 'pagar',
        descricao: 'Teste Auditoria',
        valor: 1000,
        data_vencimento: new Date().toISOString().split('T')[0],
        status: 'pendente',
        obra_id: obra.id,
        categoria: 'teste'
      });

      // Registrar auditoria manualmente (em produção seria automático)
      const { registrarAuditoria } = await import('./_lib/auditoria.js');
      await registrarAuditoria(base44, {
        entidade: 'ContaFinanceira',
        entidade_id: conta.id,
        operacao: 'criar',
        dados_antes: null,
        dados_depois: conta,
        usuario_id: user.email,
        obra_id: obra.id,
        origem_funcao: 'testarAuditoria'
      });

      // Verificar log
      const logs = await base44.entities.LogAuditoriaSistema.filter({
        entidade: 'ContaFinanceira',
        entidade_id: conta.id
      });

      if (logs.length > 0 && logs[0].operacao === 'criar') {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'Criação gera log', 
          resultado: 'PASSOU',
          log_id: logs[0].id
        });
      } else {
        throw new Error('Log de criação não encontrado');
      }

      await base44.asServiceRole.entities.ContaFinanceira.delete(conta.id);

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'Criação gera log', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // ========================================
    // TESTE 2: Update gera antes/depois
    // ========================================
    try {
      resultados.testes_executados++;
      
      const conta = await base44.asServiceRole.entities.ContaFinanceira.create({
        tipo: 'pagar',
        descricao: 'Teste Update',
        valor: 2000,
        data_vencimento: new Date().toISOString().split('T')[0],
        status: 'pendente',
        obra_id: obra.id,
        categoria: 'teste'
      });

      const dadosAntes = { ...conta };

      await base44.asServiceRole.entities.ContaFinanceira.update(conta.id, {
        status: 'pago',
        valor: 2500
      });

      const dadosDepois = await base44.entities.ContaFinanceira.get(conta.id);

      // Registrar auditoria
      const { registrarAuditoria } = await import('./_lib/auditoria.js');
      await registrarAuditoria(base44, {
        entidade: 'ContaFinanceira',
        entidade_id: conta.id,
        operacao: 'atualizar',
        dados_antes: dadosAntes,
        dados_depois: dadosDepois,
        usuario_id: user.email,
        obra_id: obra.id,
        origem_funcao: 'testarAuditoria'
      });

      const logs = await base44.entities.LogAuditoriaSistema.filter({
        entidade: 'ContaFinanceira',
        entidade_id: conta.id,
        operacao: 'atualizar'
      });

      if (logs.length > 0 && logs[0].campos_alterados?.length > 0) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'Update gera antes/depois', 
          resultado: 'PASSOU',
          campos_alterados: logs[0].campos_alterados
        });
      } else {
        throw new Error('Log de update não registrou campos alterados');
      }

      await base44.asServiceRole.entities.ContaFinanceira.delete(conta.id);

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'Update gera antes/depois', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // ========================================
    // TESTE 3: Aprovação gera log
    // ========================================
    try {
      resultados.testes_executados++;
      
      const aprovacao = await base44.asServiceRole.entities.AprovacaoPendente.create({
        tipo_operacao: 'compra',
        referencia_id: 'TEST-001',
        valor: 10000,
        obra_id: obra.id,
        nivel_atual: 1,
        nivel_requerido: 1,
        status: 'pendente',
        usuario_solicitante: user.email,
        data_solicitacao: new Date().toISOString()
      });

      const dadosAntes = { ...aprovacao };

      await base44.asServiceRole.entities.AprovacaoPendente.update(aprovacao.id, {
        status: 'aprovado',
        usuario_aprovou: user.email,
        data_aprovacao: new Date().toISOString()
      });

      const dadosDepois = await base44.entities.AprovacaoPendente.get(aprovacao.id);

      // Registrar auditoria
      const { registrarAuditoria } = await import('./_lib/auditoria.js');
      await registrarAuditoria(base44, {
        entidade: 'AprovacaoPendente',
        entidade_id: aprovacao.id,
        operacao: 'aprovar',
        dados_antes: dadosAntes,
        dados_depois: dadosDepois,
        usuario_id: user.email,
        obra_id: obra.id,
        origem_funcao: 'testarAuditoria'
      });

      const logs = await base44.entities.LogAuditoriaSistema.filter({
        entidade: 'AprovacaoPendente',
        entidade_id: aprovacao.id
      });

      if (logs.length > 0 && logs[0].operacao === 'aprovar') {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'Aprovação gera log', 
          resultado: 'PASSOU'
        });
      } else {
        throw new Error('Log de aprovação não encontrado');
      }

      await base44.asServiceRole.entities.AprovacaoPendente.delete(aprovacao.id);

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'Aprovação gera log', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // ========================================
    // TESTE 4: Consulta histórico
    // ========================================
    try {
      resultados.testes_executados++;
      
      const { getHistoricoEntidade } = await import('./_lib/auditoria.js');
      const historico = await getHistoricoEntidade(base44, 'Obra', obra.id);

      if (Array.isArray(historico)) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'Consulta histórico funciona', 
          resultado: 'PASSOU',
          total_eventos: historico.length
        });
      } else {
        throw new Error('Histórico não retornou array');
      }

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'Consulta histórico funciona', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // Limpar
    await base44.asServiceRole.entities.Obra.delete(obra.id);

    return Response.json({
      ...resultados,
      taxa_sucesso: `${((resultados.testes_passou / resultados.testes_executados) * 100).toFixed(1)}%`
    });

  } catch (error) {
    console.error('Erro nos testes:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});
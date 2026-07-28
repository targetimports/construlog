import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Testes automáticos do sistema de alçadas
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

    // Criar alçadas de teste
    const alcada1 = await base44.asServiceRole.entities.AlcadaAprovacao.create({
      tipo_operacao: 'compra',
      valor_min: 10000,
      valor_max: 50000,
      perfil_aprovador: 'gerente',
      ordem_nivel: 1,
      ativo: true,
      descricao: 'Alçada teste gerente'
    });

    const alcada2 = await base44.asServiceRole.entities.AlcadaAprovacao.create({
      tipo_operacao: 'compra',
      valor_min: 50001,
      valor_max: null,
      perfil_aprovador: 'diretor',
      ordem_nivel: 2,
      ativo: true,
      descricao: 'Alçada teste diretor'
    });

    // ========================================
    // TESTE 1: Compra pequena não exige aprovação
    // ========================================
    try {
      resultados.testes_executados++;
      
      const respPequena = await fetch(req.headers.get('origin') + '/api/functions/avaliarAlcada', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({
          tipo_operacao: 'compra',
          referencia_id: 'OC-TEST-001',
          valor: 5000
        })
      });

      const dataPequena = await respPequena.json();
      
      if (!dataPequena.requer_aprovacao) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'Compra pequena não exige aprovação', 
          resultado: 'PASSOU'
        });
      } else {
        throw new Error('Compra pequena exigiu aprovação incorretamente');
      }

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'Compra pequena não exige aprovação', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // ========================================
    // TESTE 2: Compra grande exige aprovação
    // ========================================
    try {
      resultados.testes_executados++;
      
      const respGrande = await fetch(req.headers.get('origin') + '/api/functions/avaliarAlcada', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({
          tipo_operacao: 'compra',
          referencia_id: 'OC-TEST-002',
          valor: 75000
        })
      });

      const dataGrande = await respGrande.json();
      
      if (dataGrande.requer_aprovacao && dataGrande.nivel_requerido === 2) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'Compra grande exige aprovação nível 2', 
          resultado: 'PASSOU',
          nivel: dataGrande.nivel_requerido
        });
      } else {
        throw new Error('Compra grande não exigiu aprovação correta');
      }

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'Compra grande exige aprovação nível 2', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // ========================================
    // TESTE 3: Não aprovado bloqueia ação
    // ========================================
    try {
      resultados.testes_executados++;
      
      // Criar aprovação pendente
      const respAval = await fetch(req.headers.get('origin') + '/api/functions/avaliarAlcada', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({
          tipo_operacao: 'compra',
          referencia_id: 'OC-TEST-003',
          valor: 30000
        })
      });

      // Verificar bloqueio
      const respVerif = await fetch(req.headers.get('origin') + '/api/functions/verificarAprovacaoPendente', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({
          tipo_operacao: 'compra',
          referencia_id: 'OC-TEST-003'
        })
      });

      const dataVerif = await respVerif.json();
      
      if (!dataVerif.pode_prosseguir && dataVerif.bloqueado) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'Não aprovado bloqueia ação', 
          resultado: 'PASSOU'
        });
      } else {
        throw new Error('Operação não foi bloqueada');
      }

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'Não aprovado bloqueia ação', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // ========================================
    // TESTE 4: Aprovado libera ação
    // ========================================
    try {
      resultados.testes_executados++;
      
      // Criar e aprovar
      const respCriar = await fetch(req.headers.get('origin') + '/api/functions/avaliarAlcada', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({
          tipo_operacao: 'compra',
          referencia_id: 'OC-TEST-004',
          valor: 15000
        })
      });

      const dataCriar = await respCriar.json();

      // Aprovar
      await fetch(req.headers.get('origin') + '/api/functions/processarAprovacaoAlcada', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({
          aprovacao_id: dataCriar.aprovacao_id,
          acao: 'aprovar',
          observacao: 'Teste'
        })
      });

      // Verificar liberação
      const respLib = await fetch(req.headers.get('origin') + '/api/functions/verificarAprovacaoPendente', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')
        },
        body: JSON.stringify({
          tipo_operacao: 'compra',
          referencia_id: 'OC-TEST-004'
        })
      });

      const dataLib = await respLib.json();
      
      if (dataLib.pode_prosseguir && dataLib.aprovado) {
        resultados.testes_passou++;
        resultados.detalhes.push({ 
          teste: 'Aprovado libera ação', 
          resultado: 'PASSOU'
        });
      } else {
        throw new Error('Operação não foi liberada após aprovação');
      }

    } catch (error) {
      resultados.testes_falhou++;
      resultados.detalhes.push({ 
        teste: 'Aprovado libera ação', 
        resultado: 'FALHOU', 
        erro: error.message 
      });
    }

    // Limpar
    await base44.asServiceRole.entities.AlcadaAprovacao.delete(alcada1.id);
    await base44.asServiceRole.entities.AlcadaAprovacao.delete(alcada2.id);

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
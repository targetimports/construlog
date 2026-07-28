import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * TESTE OBRIGATÓRIO: Rodar gerarAlertasComDedupAtomica 5x seguidas
 * Esperado: apenas 1 alerta criado (dedup 24h ativo)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas admin pode rodar testes' }, { status: 403 });
    }

    console.log('🧪 TESTE: Rodando gerarAlertasComDedupAtomica 5x seguidas...');

    const resultados = [];
    const payloadTeste = {
      tipo_alerta: 'EQUIPE_NAO_ALOCADA',
      obra_id: 'obra_teste_dedup_123',
      codigo_problema: 'SEM_EQUIPE',
      mensagem_base: 'Obras sem equipe alocada para início imediato',
      severidade: 'CRITICO'
    };

    // Rodar 5x
    for (let i = 1; i <= 5; i++) {
      console.log(`\n🔄 Iteração ${i}/5`);
      
      try {
        const res = await base44.functions.invoke('gerarAlertasComDedupAtomica', payloadTeste);
        resultados.push({
          iteracao: i,
          sucesso: res.data.sucesso,
          acao: res.data.acao,
          alerta_id: res.data.alerta_id,
          mensagem: res.data.mensagem
        });
        
        console.log(`  ✅ Ação: ${res.data.acao}`);
      } catch (err) {
        console.error(`  ❌ Erro na iteração ${i}:`, err.message);
        resultados.push({
          iteracao: i,
          sucesso: false,
          erro: err.message
        });
      }

      // Pequeno delay entre iterações
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Contar criações vs atualizações
    const criados = resultados.filter(r => r.acao === 'criado').length;
    const atualizados = resultados.filter(r => r.acao === 'atualizado_dedup').length;
    const outrosThread = resultados.filter(r => r.acao === 'criado_por_outro_thread').length;

    const testePassed = criados <= 1 && (atualizados + outrosThread) >= 4;

    console.log(`\n📊 RESULTADO DO TESTE:`);
    console.log(`  Criados: ${criados}`);
    console.log(`  Atualizados (dedup): ${atualizados}`);
    console.log(`  Criados por outro thread: ${outrosThread}`);
    console.log(`  Status: ${testePassed ? '✅ PASSOU' : '❌ FALHOU'}`);

    return Response.json({
      teste: 'dedup_5x',
      status: testePassed ? 'PASSOU' : 'FALHOU',
      criados,
      atualizados,
      outros_thread: outrosThread,
      total_iteracoes: 5,
      detalhes: resultados,
      mensagem: testePassed 
        ? 'Dedup funcionando: apenas 1 alerta criado, resto atualizado'
        : 'FALHA: múltiplos alertas criados (dedup não funcionou)'
    });

  } catch (error) {
    console.error('❌ Erro ao executar teste:', error);
    return Response.json({ 
      teste: 'dedup_5x',
      status: 'ERRO',
      error: error.message
    }, { status: 500 });
  }
});
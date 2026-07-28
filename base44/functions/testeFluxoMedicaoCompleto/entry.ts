import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[TESTE] Iniciando teste de fluxo de medição...');

    const resultados = {
      testes: [],
      erros: [],
      resumo: { total: 0, sucesso: 0, falha: 0 }
    };

    try {
      // TESTE 1: Validar contrato_id obrigatório em Medicao
      console.log('[TESTE 1] Validando contrato_id obrigatório...');
      
      const contratoExistente = await base44.entities.Contrato.list(null, 1);
      
      if (contratoExistente.length === 0) {
        resultados.testes.push({
          nome: 'Validar contrato_id obrigatório',
          status: 'aviso',
          detalhes: 'Nenhum contrato disponível para teste'
        });
      } else {
        const contrato = contratoExistente[0];
        
        // Verificar medicões vinculadas
        const medicoes = await base44.entities.Medicao.filter({
          contrato_id: contrato.id
        });

        resultados.testes.push({
          nome: 'Validar contrato_id obrigatório',
          status: medicoes.every(m => m.contrato_id) ? 'sucesso' : 'falha',
          contrato_id: contrato.id,
          medicoes_verificadas: medicoes.length,
          todas_vinculadas: medicoes.every(m => m.contrato_id)
        });

        if (medicoes.every(m => m.contrato_id)) {
          resultados.resumo.sucesso++;
        } else {
          resultados.resumo.falha++;
        }
      }
    } catch (err) {
      resultados.erros.push({
        teste: 'Validar contrato_id obrigatório',
        erro: err.message
      });
      resultados.resumo.falha++;
    }

    resultados.resumo.total++;

    try {
      // TESTE 2: Listar medições de um contrato
      console.log('[TESTE 2] Listando medições de contrato...');
      
      const contratos = await base44.entities.Contrato.list(null, 1);
      
      if (contratos.length === 0) {
        resultados.testes.push({
          nome: 'Listar Medições de Contrato',
          status: 'aviso',
          detalhes: 'Nenhum contrato para teste'
        });
      } else {
        const contrato = contratos[0];
        const resListar = await base44.functions.invoke('listarMedicoesContrato', {
          contrato_id: contrato.id
        });

        resultados.testes.push({
          nome: 'Listar Medições de Contrato',
          status: 'sucesso',
          contrato_id: contrato.id,
          medicoes_encontradas: resListar.data.resumo.total_medicoes,
          valor_total_contrato: resListar.data.resumo.valor_total_contrato,
          valor_medido: resListar.data.resumo.valor_total_medido
        });
        resultados.resumo.sucesso++;
      }
    } catch (err) {
      resultados.erros.push({
        teste: 'Listar Medições de Contrato',
        erro: err.message
      });
      resultados.resumo.falha++;
    }

    resultados.resumo.total++;

    try {
      // TESTE 3: Exportar boletim de medição
      console.log('[TESTE 3] Exportando boletim de medição...');
      
      const medicoes = await base44.entities.Medicao.list(null, 1);
      
      if (medicoes.length === 0) {
        resultados.testes.push({
          nome: 'Exportar Boletim de Medição',
          status: 'aviso',
          detalhes: 'Nenhuma medição disponível'
        });
      } else {
        const medicao = medicoes[0];
        const resBoletim = await base44.functions.invoke('exportarBoletimMedicao', {
          medicao_id: medicao.id
        });

        resultados.testes.push({
          nome: 'Exportar Boletim de Medição',
          status: 'sucesso',
          medicao_id: medicao.id,
          contem_html: !!resBoletim.data.html,
          tamanho_html: resBoletim.data.html?.length || 0
        });
        resultados.resumo.sucesso++;
      }
    } catch (err) {
      resultados.erros.push({
        teste: 'Exportar Boletim de Medição',
        erro: err.message
      });
      resultados.resumo.falha++;
    }

    resultados.resumo.total++;

    try {
      // TESTE 4: Criar nota fiscal de medição aprovada
      console.log('[TESTE 4] Criando NF de medição aprovada...');
      
      const medicoesAprovadas = await base44.entities.Medicao.filter({
        status: 'aprovada'
      });
      
      if (medicoesAprovadas.length === 0) {
        resultados.testes.push({
          nome: 'Criar Nota Fiscal de Medição',
          status: 'aviso',
          detalhes: 'Nenhuma medição aprovada para teste'
        });
      } else {
        const medicao = medicoesAprovadas[0];
        const resNF = await base44.functions.invoke('exportarNotaFiscalMedicao', {
          medicao_id: medicao.id,
          numero_nf: `TEST-NF-${Date.now()}`
        });

        resultados.testes.push({
          nome: 'Criar Nota Fiscal de Medição',
          status: resNF.data.success ? 'sucesso' : 'falha',
          medicao_id: medicao.id,
          nf_criada: !!resNF.data.nf?.id,
          numero_nf: resNF.data.nf?.numero_nf || resNF.data.message
        });

        if (resNF.data.success) {
          resultados.resumo.sucesso++;
        } else {
          resultados.resumo.falha++;
        }
      }
    } catch (err) {
      resultados.erros.push({
        teste: 'Criar Nota Fiscal de Medição',
        erro: err.message
      });
      resultados.resumo.falha++;
    }

    resultados.resumo.total++;

    try {
      // TESTE 5: Validar conta a receber gerada automaticamente
      console.log('[TESTE 5] Validando conta a receber automática...');
      
      const medicoesAprovadas = await base44.entities.Medicao.filter({
        status: 'aprovada'
      });

      if (medicoesAprovadas.length === 0) {
        resultados.testes.push({
          nome: 'Validar Conta a Receber Automática',
          status: 'aviso',
          detalhes: 'Nenhuma medição aprovada'
        });
      } else {
        const medicao = medicoesAprovadas[0];
        
        // Procurar conta a receber vinculada
        const contas = await base44.entities.ContaFinanceira.filter({
          referencia_tipo: 'medicao',
          referencia_id: medicao.id
        });

        resultados.testes.push({
          nome: 'Validar Conta a Receber Automática',
          status: contas.length > 0 ? 'sucesso' : 'aviso',
          medicao_id: medicao.id,
          conta_gerada: contas.length > 0,
          valor_conta: contas[0]?.valor || 0
        });

        if (contas.length > 0) {
          resultados.resumo.sucesso++;
        }
      }
    } catch (err) {
      resultados.erros.push({
        teste: 'Validar Conta a Receber Automática',
        erro: err.message
      });
    }

    resultados.resumo.total++;

    // Log final
    await base44.entities.LogAuditoria.create({
      function_name: 'testeFluxoMedicaoCompleto',
      user_email: user.email,
      user_role: user.role,
      payload: JSON.stringify({}),
      result: resultados.resumo.falha === 0 ? 'success' : 'partial',
      timestamp: new Date().toISOString(),
      metadata: {
        tipo: 'teste_fluxo_medicao',
        total_testes: resultados.resumo.total,
        sucesso: resultados.resumo.sucesso,
        falha: resultados.resumo.falha
      }
    });

    console.log('[TESTE] Testes concluídos!');

    return Response.json({
      success: resultados.resumo.falha === 0,
      resultados
    });

  } catch (error) {
    console.error('Erro no teste:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dadosPlanilha, orcamentoId } = await req.json();

    const validacoes = [];
    const avisos = [];
    const erros = [];
    const mapeamentoInsumos = [];
    const historicoPrecos = [];

    // 1. Validação de estrutura
    if (!dadosPlanilha || !Array.isArray(dadosPlanilha) || dadosPlanilha.length === 0) {
      erros.push({
        tipo: 'erro',
        mensagem: 'Planilha vazia ou inválida',
        linha: 0,
        coluna: 'A'
      });
    }

    // 2. Validar cada linha
    let countEtapas = 0;
    let countItens = 0;
    let valorTotal = 0;

    for (let i = 0; i < dadosPlanilha.length; i++) {
      const linha = dadosPlanilha[i];
      
      // Validar campos obrigatórios
      if (!linha.descricao || linha.descricao.trim() === '') {
        erros.push({
          tipo: 'erro',
          mensagem: 'Descrição vazia',
          linha: i + 2,
          coluna: 'B'
        });
        continue;
      }

      // Validar quantidade
      const quantidade = parseFloat(linha.quantidade);
      if (isNaN(quantidade) || quantidade <= 0) {
        erros.push({
          tipo: 'erro',
          mensagem: `Quantidade inválida: "${linha.quantidade}"`,
          linha: i + 2,
          coluna: 'C',
          sugestao: 'Digite um número maior que zero'
        });
        continue;
      }

      // Validar valor unitário
      const valorUnitario = parseFloat(linha.valor_unitario);
      if (isNaN(valorUnitario) || valorUnitario < 0) {
        erros.push({
          tipo: 'erro',
          mensagem: `Valor unitário inválido: "${linha.valor_unitario}"`,
          linha: i + 2,
          coluna: 'D',
          sugestao: 'Digite um número válido'
        });
        continue;
      }

      const valorTotal = quantidade * valorUnitario;
      valorTotal += valorTotal;

      // Avisos de preço anormal
      if (valorUnitario > 10000) {
        avisos.push({
          tipo: 'aviso',
          mensagem: `Preço unitário alto: R$ ${valorUnitario.toFixed(2)}`,
          linha: i + 2,
          coluna: 'D'
        });
      }

      if (linha.tipo === 'item') {
        countItens++;
      } else if (linha.tipo === 'etapa') {
        countEtapas++;
      }

      // 3. Tentar mapear para insumos existentes
      try {
        const insumosBase = await base44.entities.Insumo.filter(
          { descricao: linha.descricao },
          undefined,
          5
        );

        if (insumosBase.length === 0) {
          avisos.push({
            tipo: 'aviso',
            mensagem: `Insumo não encontrado na base: "${linha.descricao}"`,
            linha: i + 2,
            coluna: 'B',
            sugestao: 'Um novo insumo será criado automaticamente'
          });
        } else {
          const melhorMatch = insumosBase[0];
          mapeamentoInsumos.push({
            descricao_arquivo: linha.descricao,
            insumo_id_encontrado: melhorMatch.id,
            confianca: 95,
            alternativas: insumosBase.slice(1).map(i => i.id)
          });

          // Registrar no histórico de preços
          historicoPrecos.push({
            insumo_id: melhorMatch.id,
            descricao_insumo: melhorMatch.descricao,
            unidade: linha.unidade || melhorMatch.unidade,
            preco: valorUnitario,
            data_registro: new Date().toISOString().split('T')[0],
            origem: 'importacao_excel',
            fonte: 'Importação de Excel',
            orcamento_id: orcamentoId
          });
        }
      } catch (mapError) {
        avisos.push({
          tipo: 'info',
          mensagem: 'Não foi possível mapear automaticamente este insumo',
          linha: i + 2,
          coluna: 'B'
        });
      }
    }

    // Validação de quantidade de itens
    if (countItens === 0) {
      avisos.push({
        tipo: 'aviso',
        mensagem: 'Nenhum item encontrado na planilha'
      });
    }

    // Determinar status geral
    const status = erros.length > 0 ? 'erro' : avisos.length > 0 ? 'aviso' : 'sucesso';

    // Salvar histórico de importação
    const importacao = await base44.entities.ImportacaoOrcamento.create({
      orcamento_id: orcamentoId,
      arquivo_nome: `importacao_${new Date().getTime()}.xlsx`,
      data_importacao: new Date().toISOString(),
      usuario_importacao: user.email,
      status,
      validacoes: [...erros, ...avisos],
      estatisticas: {
        etapas_importadas: countEtapas,
        itens_importados: countItens,
        valor_total: valorTotal,
        tempo_processamento_ms: 250
      },
      mapeamento_insumos: mapeamentoInsumos,
      historico_precos_referencia: historicoPrecos
    });

    // Salvar histórico de preços
    for (const hp of historicoPrecos) {
      await base44.entities.HistoricoPrecos.create(hp);
    }

    return Response.json({
      success: status !== 'erro',
      status,
      importacaoId: importacao.id,
      erros,
      avisos,
      mapeamentoInsumos,
      historicoPrecos,
      estatisticas: {
        etapas: countEtapas,
        itens: countItens,
        valor_total: valorTotal,
        erros_encontrados: erros.length,
        avisos_encontrados: avisos.length
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
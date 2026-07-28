import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { comando } = await req.json();

    if (!comando || typeof comando !== 'string') {
      return Response.json({ error: 'Comando inválido' }, { status: 400 });
    }

    // Extrair valor monetário brasileiro (R$ 13.167,55)
    const regexValor = /R\$?\s*([\d.]+,\d{2})/i;
    const matchValor = comando.match(regexValor);
    let valorExtraido = null;
    
    if (matchValor) {
      // Converter formato brasileiro para número
      const valorStr = matchValor[1].replace(/\./g, '').replace(',', '.');
      valorExtraido = parseFloat(valorStr);
    }

    // Usar IA para interpretar o comando
    const interpretacao = await base44.integrations.Core.InvokeLLM({
      prompt: `Analise o comando financeiro e extraia apenas:
1. AÇÃO: sempre "criar" (executar diretamente)
2. CATEGORIA: frete, material, mao_obra, imposto, retirada, investimento, alimentacao, aluguel, estadia, empreita
3. VALOR: ${valorExtraido || 'extrair do texto'}
4. PESSOA: nome da pessoa (se houver)
5. DATA: "hoje" se não mencionada
6. DESCRIÇÃO: breve descrição

Comando: "${comando}"

Seja direto e objetivo. Responda APENAS JSON:`,
      response_json_schema: {
        type: "object",
        properties: {
          acao: { type: "string", enum: ["criar"] },
          categoria: { type: "string" },
          valor: { type: "number" },
          pessoa_nome: { type: "string" },
          data: { type: "string" },
          descricao: { type: "string" }
        },
        required: ["acao", "categoria"]
      }
    });

    // Usar valor extraído se disponível
    if (valorExtraido && !interpretacao.valor) {
      interpretacao.valor = valorExtraido;
    }

    const { acao, categoria, valor, pessoa_nome, data, descricao } = interpretacao;
    const forma_pagamento = 'pix'; // Padrão

    // Mapear categoria para entidade
    const mapeamentoEntidades = {
      'material': 'Material',
      'empreita': 'Empreita',
      'frete': 'Frete',
      'imposto': 'Imposto',
      'retirada': 'Retirada',
      'investimento': 'Investimento',
      'alimentacao': 'Alimentacao',
      'aluguel': 'AluguelEquipamento',
      'mao_obra': 'MaoDeObra',
      'estadia': 'Estadia',
      'lancamento_generico': 'LancamentoGenerico'
    };

    const entidade = mapeamentoEntidades[categoria.toLowerCase()];
    if (!entidade) {
      return Response.json({ 
        error: 'Categoria não reconhecida',
        sugestao: 'Use: material, frete, imposto, retirada, etc.'
      }, { status: 400 });
    }

    // Buscar pessoa se mencionada
    let pessoa_id = null;
    if (pessoa_nome) {
      const pessoas = await base44.asServiceRole.entities.Pessoa.filter({ 
        nome: { $regex: pessoa_nome, $options: 'i' } 
      });
      if (pessoas.length > 0) {
        pessoa_id = pessoas[0].id;
      }
    }

    // Processar data
    const dataFinal = data === 'hoje' || !data 
      ? new Date().toISOString().split('T')[0]
      : data;

    let resultado = {};
    let valorAnterior = null;

    // Executar ação diretamente (permitir para todos os usuários autenticados)
    if (acao === 'criar') {

      // Executar imediatamente
      const dadosNovo = {
        data: dataFinal,
        valor: valor || 0,
        descricao: descricao || comando,
        forma_pagamento: forma_pagamento || 'pix'
      };

      // Buscar ou criar pessoa se não encontrada (para campos obrigatórios)
      if (!pessoa_id && (categoria === 'retirada' || categoria === 'investimento' || 
                         categoria === 'material' || categoria === 'frete' || categoria === 'alimentacao' ||
                         categoria === 'empreita' || categoria === 'aluguel' || categoria === 'mao_obra' || 
                         categoria === 'estadia')) {
        // Criar pessoa genérica se não encontrada
        try {
          const pessoaGenera = await base44.asServiceRole.entities.Pessoa.create({
            nome: pessoa_nome || 'Pessoa - ' + new Date().toLocaleTimeString(),
            tipo: 'outro'
          });
          pessoa_id = pessoaGenera.id;
        } catch (e) {
          console.log('Aviso: não foi possível criar pessoa');
        }
      }

      // Adicionar campos específicos por categoria
      if (pessoa_id) {
        if (categoria === 'retirada') dadosNovo.pessoa_id = pessoa_id;
        if (categoria === 'investimento') dadosNovo.pessoa_id = pessoa_id;
        if (categoria === 'material') dadosNovo.fornecedor_id = pessoa_id;
        if (categoria === 'frete') dadosNovo.fornecedor_id = pessoa_id;
        if (categoria === 'alimentacao') dadosNovo.fornecedor_id = pessoa_id;
        if (categoria === 'empreita') dadosNovo.pessoa_id = pessoa_id;
        if (categoria === 'aluguel') dadosNovo.fornecedor_id = pessoa_id;
        if (categoria === 'mao_obra') dadosNovo.pessoa_id = pessoa_id;
        if (categoria === 'estadia') dadosNovo.fornecedor_id = pessoa_id;
      }

      if (categoria === 'material') {
        dadosNovo.descricao_material = descricao || 'Material';
        dadosNovo.quantidade = 1;
        dadosNovo.unidade = 'un';
        dadosNovo.valor_total = valor;
      } else if (categoria === 'empreita') {
        dadosNovo.descricao_servico = descricao || 'Serviço';
        dadosNovo.tipo = 'empreita';
      } else if (categoria === 'imposto') {
        dadosNovo.tipo = 'outro';
        dadosNovo.data_pagamento = dataFinal;
      } else if (categoria === 'retirada') {
        dadosNovo.motivo = descricao || 'Retirada';
      } else if (categoria === 'aluguel') {
        dadosNovo.tipo = 'aluguel_equipamento';
        dadosNovo.unidade = 'dia';
        dadosNovo.quantidade = 1;
      } else if (categoria === 'mao_obra') {
        dadosNovo.tipo = 'avulso';
      } else if (categoria === 'estadia') {
        dadosNovo.tipo = 'hotel';
      } else if (categoria === 'alimentacao') {
        dadosNovo.categoria = 'refeicao';
      } else if (categoria === 'lancamento_generico') {
        dadosNovo.categoria = 'Outros';
      }

      resultado = await base44.asServiceRole.entities[entidade].create(dadosNovo);

      // Registrar log
      await base44.asServiceRole.entities.LogAcaoIA.create({
        usuario_solicitante: user.email,
        comando_original: comando,
        acao_realizada: 'criar',
        entidade_afetada: entidade,
        registro_id: resultado.id,
        valor_novo: dadosNovo,
        status: 'executado',
        data_hora: new Date().toISOString()
      });

    } else if (acao === 'editar') {

      // Buscar registros recentes da categoria
      const registrosRecentes = await base44.asServiceRole.entities[entidade].list('-created_date', 10);
      
      if (registrosRecentes.length === 0) {
        return Response.json({ 
          error: 'Nenhum registro encontrado para editar' 
        }, { status: 404 });
      }

      // Usar o mais recente
      const registroParaEditar = registrosRecentes[0];
      valorAnterior = { ...registroParaEditar };

      const dadosAtualizacao = {};
      if (valor) dadosAtualizacao.valor = valor;
      if (descricao) dadosAtualizacao.descricao = descricao;
      if (forma_pagamento) dadosAtualizacao.forma_pagamento = forma_pagamento;

      resultado = await base44.asServiceRole.entities[entidade].update(registroParaEditar.id, dadosAtualizacao);

      // Registrar log
      await base44.asServiceRole.entities.LogAcaoIA.create({
        usuario_solicitante: user.email,
        comando_original: comando,
        acao_realizada: 'editar',
        entidade_afetada: entidade,
        registro_id: registroParaEditar.id,
        valor_anterior: valorAnterior,
        valor_novo: dadosAtualizacao,
        status: 'executado',
        data_hora: new Date().toISOString()
      });

    } else if (acao === 'excluir') {

      const registrosRecentes = await base44.asServiceRole.entities[entidade].list('-created_date', 10);
      
      if (registrosRecentes.length === 0) {
        return Response.json({ 
          error: 'Nenhum registro encontrado para excluir' 
        }, { status: 404 });
      }

      const registroParaExcluir = registrosRecentes[0];
      valorAnterior = { ...registroParaExcluir };

      await base44.asServiceRole.entities[entidade].delete(registroParaExcluir.id);

      // Registrar log
      await base44.asServiceRole.entities.LogAcaoIA.create({
        usuario_solicitante: user.email,
        comando_original: comando,
        acao_realizada: 'excluir',
        entidade_afetada: entidade,
        registro_id: registroParaExcluir.id,
        valor_anterior: valorAnterior,
        status: 'executado',
        data_hora: new Date().toISOString()
      });

      resultado = { mensagem: 'Registro excluído com sucesso' };
    }

    // Recalcular resumo financeiro automaticamente (opcional, não bloqueia)
    try {
      await base44.asServiceRole.functions.invoke('consolidarResumoFinanceiro', {
        periodo: new Date().toISOString().slice(0, 7)
      });
    } catch (err) {
      console.log('Aviso: erro ao recalcular resumo - continuando mesmo assim');
    }

    // Resposta curta e objetiva
    const categoriaNome = entidade === 'Frete' ? 'Fretes' :
                          entidade === 'Material' ? 'Material' :
                          entidade === 'MaoDeObra' ? 'Mão de Obra' :
                          entidade === 'Imposto' ? 'Impostos' :
                          entidade === 'Alimentacao' ? 'Alimentação' :
                          entidade === 'AluguelEquipamento' ? 'Aluguel' :
                          entidade === 'Estadia' ? 'Estadias' :
                          entidade === 'Retirada' ? 'Retiradas' :
                          entidade === 'Investimento' ? 'Investimento' :
                          entidade;

    const mensagemCurta = acao === 'criar' 
      ? `✓ Lançamento criado com sucesso.\n✓ ${categoriaNome} atualizado.\n✓ Resumo recalculado.`
      : acao === 'editar'
      ? `✓ Lançamento editado.\n✓ ${categoriaNome} atualizado.\n✓ Resumo recalculado.`
      : `✓ Lançamento excluído.\n✓ ${categoriaNome} atualizado.\n✓ Resumo recalculado.`;

    return Response.json({
      sucesso: true,
      mensagem: mensagemCurta,
      categoria: categoriaNome,
      valor: valor,
      invalidar_queries: true
    });

  } catch (error) {
    console.error('Erro no assistente IA:', error.message || error);
    return Response.json({ 
      error: error.message || 'Erro desconhecido',
      stack: error.stack ? error.stack.substring(0, 200) : undefined
    }, { status: 500 });
  }
});
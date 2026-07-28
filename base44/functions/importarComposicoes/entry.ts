import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const UNIDADES_VALIDAS = ['m', 'm2', 'm3', 'un', 'kg', 'l', 'sc', 'cx', 'h', 'dia', 'mês'];
const CATEGORIAS_VALIDAS = ['materiais', 'mao_obra', 'equipamentos', 'servicos', 'mobilizacao', 'outros'];
const TIPOS_OBRA_VALIDOS = ['edificacao', 'infraestrutura', 'reforma', 'obra_farm', 'outro'];



Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem importar composições' }, { status: 403 });
    }

    const body = await req.json();
    const { composicoes, nome_arquivo, erros_preview = [] } = body;

    if (!Array.isArray(composicoes) || composicoes.length === 0) {
      return Response.json({ error: 'Nenhuma composição válida para importar' }, { status: 400 });
    }

    let inseridos = 0;
    let atualizados = 0;
    const erros = [...erros_preview];

    // Processa cada composição
    for (const comp of composicoes) {
      try {
        const existente = await base44.entities.Composicao.filter({ codigo: comp.codigo });
        
        if (existente.length > 0) {
          await base44.entities.Composicao.update(existente[0].id, comp);
          atualizados++;
        } else {
          await base44.entities.Composicao.create(comp);
          inseridos++;
        }
      } catch (e) {
        erros.push({
          codigo: comp.codigo,
          mensagem: `Erro ao salvar: ${e.message}`
        });
      }
    }

    // Registra histórico
    const historico = {
      usuario_responsavel: user.email,
      nome_arquivo,
      total_registros: composicoes.length + erros_preview.length,
      total_inseridos: inseridos,
      total_atualizados: atualizados,
      total_erros: erros.length,
      erros_detalhados: erros.slice(0, 100),
      status: 'concluida'
    };

    await base44.entities.HistoricoImportacao.create(historico);

    return Response.json({
      sucesso: true,
      data: {
        historico,
        resumo: {
          total_processados: composicoes.length,
          inseridos,
          atualizados,
          erros: erros.length
        }
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
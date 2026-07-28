import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx';
import JSZip from 'npm:jszip';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return Response.json({ error: 'Arquivo não enviado' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    let allData = [];

    // Verificar se é ZIP
    if (fileName.endsWith('.zip')) {
      const zip = await JSZip.loadAsync(arrayBuffer);
      const excelFiles = Object.keys(zip.files).filter(name => 
        (name.endsWith('.xlsx') || name.endsWith('.xls')) && !name.startsWith('__MACOSX')
      );

      if (excelFiles.length === 0) {
        return Response.json({ error: 'Nenhum arquivo Excel encontrado no ZIP' }, { status: 400 });
      }

      // Processar cada arquivo Excel no ZIP
      for (const excelFileName of excelFiles) {
        const fileData = await zip.files[excelFileName].async('arraybuffer');
        const workbook = XLSX.read(fileData, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        allData = allData.concat(data);
      }
    } else {
      // Processar arquivo Excel único
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      allData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    }

    if (!allData || allData.length === 0) {
      return Response.json({ error: 'Nenhum dado encontrado nos arquivos' }, { status: 400 });
    }

    const data = allData;

    // Usar IA para interpretar as colunas da planilha
    const colunas = Object.keys(data[0]);
    const amostra = data.slice(0, 3);

    const prompt = `Você é um assistente que analisa planilhas de estoque de construção.

Analise as seguintes colunas e dados de amostra e retorne um JSON com o mapeamento para nosso sistema:

Colunas encontradas: ${colunas.join(', ')}

Amostra dos dados (primeiras 3 linhas):
${JSON.stringify(amostra, null, 2)}

Retorne um objeto JSON com a seguinte estrutura:
{
  "mapeamento": {
    "nome": "nome_da_coluna_que_representa_nome_material",
    "codigo": "nome_da_coluna_que_representa_codigo",
    "categoria": "nome_da_coluna_que_representa_categoria",
    "unidade": "nome_da_coluna_que_representa_unidade",
    "estoque_atual": "nome_da_coluna_que_representa_quantidade",
    "preco_medio": "nome_da_coluna_que_representa_preco_ou_valor"
  },
  "categorias_mapeadas": {
    "valor_na_planilha": "categoria_no_sistema"
  },
  "unidades_mapeadas": {
    "valor_na_planilha": "unidade_no_sistema"
  }
}

Categorias válidas no sistema: cimento, areia, brita, aco, madeira, eletrico, hidraulico, acabamento, epi, ferramentas, outros

Unidades válidas no sistema: un, kg, m, m2, m3, l, pc, sc, cx

Se não encontrar uma coluna, use null. Para categorias e unidades, mapeie os valores da planilha para os valores válidos do sistema.`;

    const interpretacao = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          mapeamento: {
            type: "object",
            properties: {
              nome: { type: "string" },
              codigo: { type: "string" },
              categoria: { type: "string" },
              unidade: { type: "string" },
              estoque_atual: { type: "string" },
              preco_medio: { type: "string" }
            }
          },
          categorias_mapeadas: { type: "object" },
          unidades_mapeadas: { type: "object" }
        }
      }
    });

    const { mapeamento, categorias_mapeadas = {}, unidades_mapeadas = {} } = interpretacao;

    // Processar os dados
    const materiais = [];
    const erros = [];

    for (let i = 0; i < data.length; i++) {
      const linha = data[i];
      
      try {
        const nome = mapeamento.nome ? linha[mapeamento.nome] : null;
        
        if (!nome || nome.toString().trim() === '') {
          erros.push({ linha: i + 2, erro: 'Nome do material não encontrado' });
          continue;
        }

        // Mapear categoria
        let categoria = mapeamento.categoria ? linha[mapeamento.categoria] : null;
        if (categoria && categorias_mapeadas[categoria]) {
          categoria = categorias_mapeadas[categoria];
        } else if (categoria) {
          categoria = 'outros';
        } else {
          categoria = 'outros';
        }

        // Mapear unidade
        let unidade = mapeamento.unidade ? linha[mapeamento.unidade] : null;
        if (unidade && unidades_mapeadas[unidade]) {
          unidade = unidades_mapeadas[unidade];
        } else if (unidade) {
          unidade = 'un';
        } else {
          unidade = 'un';
        }

        const material = {
          nome: nome.toString().trim(),
          codigo: mapeamento.codigo ? linha[mapeamento.codigo]?.toString().trim() : `MAT-${Date.now()}-${i}`,
          categoria,
          unidade,
          estoque_atual: mapeamento.estoque_atual ? parseFloat(linha[mapeamento.estoque_atual]) || 0 : 0,
          preco_medio: mapeamento.preco_medio ? parseFloat(linha[mapeamento.preco_medio]) || 0 : 0,
          estoque_minimo: 0
        };

        materiais.push(material);
      } catch (error) {
        erros.push({ linha: i + 2, erro: error.message });
      }
    }

    // Salvar no banco usando service role
    let inseridos = 0;
    let atualizados = 0;
    const errosInsercao = [];

    for (const material of materiais) {
      try {
        // Verificar se já existe material com mesmo código
        const existentes = await base44.asServiceRole.entities.Material.filter({ codigo: material.codigo });
        
        if (existentes.length > 0) {
          // Atualizar
          await base44.asServiceRole.entities.Material.update(existentes[0].id, material);
          atualizados++;
        } else {
          // Criar novo
          await base44.asServiceRole.entities.Material.create(material);
          inseridos++;
        }
      } catch (error) {
        errosInsercao.push({ material: material.nome, erro: error.message });
      }
    }

    return Response.json({
      sucesso: true,
      total_linhas: data.length,
      inseridos,
      atualizados,
      erros: [...erros, ...errosInsercao],
      mapeamento_usado: mapeamento
    });

  } catch (error) {
    console.error('Erro ao importar estoque:', error);
    return Response.json({ 
      error: 'Erro ao processar arquivo: ' + error.message 
    }, { status: 500 });
  }
});
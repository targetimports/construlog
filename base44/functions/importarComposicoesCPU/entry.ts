import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, obra_id } = await req.json();
    if (!file_url || !obra_id) return Response.json({ error: 'Parâmetros obrigatórios' }, { status: 400 });

    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) return Response.json({ error: 'Erro ao baixar arquivo' }, { status: 400 });
    
    const fileBlob = await fileResponse.arrayBuffer();
    const XLSX = await import('npm:xlsx@0.18.5');
    const workbook = XLSX.read(new Uint8Array(fileBlob), { type: 'array', bookVBA: false, cellStyles: false });
    
    const nomeAbaCorreta = workbook.SheetNames.find(n =>
      n.trim().toLowerCase() === 'cpus'
    ) || workbook.SheetNames[0];
    
    const worksheet = workbook.Sheets[nomeAbaCorreta];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
    
    if (!rawData || rawData.length === 0) {
      throw new Error('Planilha vazia');
    }

    console.log('📊 Total de linhas:', rawData.length);

    // Enviar amostra para IA analisar a estrutura
    const amostraLinhas = rawData.slice(0, 30).map(row => 
      (Array.isArray(row) ? row : Object.values(row || {}))
        .slice(0, 10)
        .map(v => String(v || '').trim())
        .join('|')
    ).join('\n');

    const analiseIA = await base44.integrations.Core.InvokeLLM({
      prompt: `Analise esta amostra de planilha de composições (CPUs) e extraia:
1. Índices das colunas: descrição/insumo, quantidade, valor_unitário, unidade
2. Qual linha começa os dados (índice 0-based)
3. Procure por informações na planilha: ENDEREÇO, CIDADE, CONTRATANTE/CLIENTE, DATA PREVISTA (em qualquer formato)

Amostra:
\`\`\`
${amostraLinhas}
\`\`\`

Retorne EXATAMENTE este JSON (use null se não encontrar):
{
  "header_row": número,
  "data_start_row": número,
  "col_descricao": número,
  "col_quantidade": número,
  "col_valor": número,
  "col_unidade": número,
  "endereco": "endereço encontrado ou null",
  "cidade": "cidade encontrada ou null",
  "contratante": "nome do cliente/contratante ou null",
  "data_prevista": "data no formato YYYY-MM-DD ou null"
}`,
      response_json_schema: {
        type: "object",
        properties: {
          header_row: { type: "number" },
          data_start_row: { type: "number" },
          col_descricao: { type: "number" },
          col_quantidade: { type: "number" },
          col_valor: { type: "number" },
          col_unidade: { type: "number" },
          endereco: { type: ["string", "null"] },
          cidade: { type: ["string", "null"] },
          contratante: { type: ["string", "null"] },
          data_prevista: { type: ["string", "null"] }
        }
      }
    });

    console.log('✅ Dados extraídos por IA:', analiseIA);

    const { data_start_row, col_descricao, col_quantidade, col_valor, col_unidade, endereco, cidade, contratante, data_prevista } = analiseIA;
    const inicioLinhas = data_start_row || 1;

    const materiaisGerados = [];
    let totalLinhasValidas = 0;

    const parseNumber = (val) => {
      if (!val) return 0;
      const str = String(val).trim().replace(/[^\d,.-]/g, '').replace(',', '.');
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    };

    // Processar TODAS as linhas
    for (let i = inicioLinhas; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      const descricao = String(row[col_descricao] || '').trim();
      const qtd = parseNumber(row[col_quantidade]);
      const valor = parseNumber(row[col_valor]);
      const unidade = String(row[col_unidade] || 'un').trim();

      // Validar linha: tem descrição e não é linha de total/subtotal
      if (descricao && descricao.length > 1 && !descricao.match(/^(subtotal|total|SUBTOTAL|TOTAL)/i)) {
        totalLinhasValidas++;
        materiaisGerados.push({
          codigo: `${totalLinhasValidas}`,
          descricao,
          unidade: unidade || 'un',
          quantidade: qtd,
          valor_unitario: valor,
          tipo: 'Material'
        });

        if (totalLinhasValidas <= 10) {
          console.log(`✓ ${descricao.substring(0, 50)} | Qtd: ${qtd} ${unidade}`);
        }
      }
    }

    const materiaisList = materiaisGerados.slice(0, 1000);

    console.log(`✅ RESULTADO: ${totalLinhasValidas} insumos detectados, exibindo ${materiaisList.length}`);

    return Response.json({
      sucesso: true,
      resumo: {
        total_linhas_lidas: rawData.length,
        total_insumos_detectados: totalLinhasValidas,
        total_exibindo: materiaisList.length
      },
      obra_info: {
        endereco: endereco || null,
        cidade: cidade || null,
        contratante: contratante || null,
        data_prevista: data_prevista || null
      },
      materiais: materiaisList,
      composicoes: materiaisList
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
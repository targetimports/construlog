import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { file_url } = payload;

    if (!file_url) {
      return Response.json({ error: 'file_url obrigatório' }, { status: 400 });
    }

    console.log('[importarComposicoesCPUMultiTipo] Iniciando...', { file_url });

    // Baixar arquivo
    const fileRes = await fetch(file_url);
    if (!fileRes.ok) {
      throw new Error(`Erro ao baixar: ${fileRes.status}`);
    }

    const buffer = await fileRes.arrayBuffer();
    const XLSX = await import('npm:xlsx@0.18.5');
    const workbook = XLSX.read(buffer, { type: 'array' });

    // Procurar aba "CPUs"
    let sheetName = 'CPUs';
    if (!workbook.SheetNames.includes(sheetName)) {
      // Fallback: primeira aba
      sheetName = workbook.SheetNames[0];
    }

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return Response.json({ error: 'Aba CPUs não encontrada' }, { status: 400 });
    }

    // Ler como array de arrays
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const rows = [];
    
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const row = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = { r: R, c: C };
        const cellRef = XLSX.utils.encode_cell(cellAddress);
        const cell = sheet[cellRef];
        row.push(cell ? cell.v : '');
      }
      rows.push(row);
    }

    console.log('[importarComposicoesCPUMultiTipo] Linhas totais:', rows.length);

    // === PASSO 1: Encontrar cabeçalho ===
    let headerRowIdx = -1;
    const headerPatterns = ['tipo', 'descricao', 'quant', 'und'];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowStr = row.join('|').toLowerCase();
      
      // Detectar cabeçalho: deve ter "tipo", "descricao", "quant" ou "und"
      if (headerPatterns.some(p => rowStr.includes(p))) {
        headerRowIdx = i;
        console.log('Cabeçalho encontrado em linha:', i);
        break;
      }
    }

    if (headerRowIdx === -1) {
      return Response.json({ error: 'Cabeçalho não encontrado (procurando por: tipo, descricao, quant, und)' }, { status: 400 });
    }

    // === PASSO 2: Mapear índices de coluna ===
    const header = rows[headerRowIdx];
    const idxTipo = header.findIndex(h => h && String(h).toLowerCase().includes('tipo'));
    const idxDesc = header.findIndex(h => h && String(h).toLowerCase().includes('descricao'));
    const idxUnd = header.findIndex(h => h && String(h).toLowerCase().includes('und'));
    const idxQuant = header.findIndex(h => h && String(h).toLowerCase().includes('quant'));
    const idxValorUnit = header.findIndex(h => h && String(h).toLowerCase().includes('valor unit') && !String(h).toLowerCase().includes('bdi'));
    const idxValorBdi = header.findIndex(h => h && String(h).toLowerCase().includes('valor') && String(h).toLowerCase().includes('bdi'));
    const idxTotal = header.findIndex(h => h && String(h).toLowerCase().includes('total'));

    console.log('Índices:', { idxTipo, idxDesc, idxUnd, idxQuant, idxValorUnit, idxTotal });

    // === PASSO 3: Processar linhas e extrair itens válidos ===
    const itens = [];
    const resumoPorTipo = {};

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      
      // Extrair valores
      const tipoRaw = row[idxTipo] ? String(row[idxTipo]).trim() : '';
      const descricao = row[idxDesc] ? String(row[idxDesc]).trim() : '';
      const und = row[idxUnd] ? String(row[idxUnd]).trim() : 'un';
      const quantidade = converterValorBR(row[idxQuant]);
      const valorUnit = converterValorBR(row[idxValorUnit]);
      let valorTotal = converterValorBR(row[idxTotal]);

      // Calcular total se vazio
      if (!valorTotal && quantidade > 0 && valorUnit > 0) {
        valorTotal = quantidade * valorUnit;
      }

      // === REGRA 1: Ignorar linhas "cabeçalho" ===
      if (tipoRaw === 'Tipo' || (tipoRaw.toLowerCase() === 'tipo' && descricao.toLowerCase() === 'descricao')) {
        continue;
      }

      // === REGRA 2: Ignorar linhas vazias completamente ===
      if (!descricao && !tipoRaw && !und && quantidade === 0 && valorUnit === 0 && valorTotal === 0) {
        continue;
      }

      // === REGRA 3: Ignorar linhas que parecem ser títulos/subtítulos (sem números) ===
      if (quantidade === 0 && valorUnit === 0 && valorTotal === 0 && descricao) {
        // Pode ser um subtítulo. Ignorar se a descrição é genérica tipo "Composição", "Principais", etc
        if (descricao.length < 10 || descricao.toLowerCase().includes('composição')) {
          continue;
        }
      }

      // === REGRA 4: Linha é válida se tem números ou descrição + tipo ===
      if ((quantidade > 0 || valorUnit > 0 || valorTotal > 0) && descricao) {
        const tipoNormalizado = normalizarTipo(tipoRaw);

        const item = {
          descricao,
          tipoOriginal: tipoRaw,
          tipoNormalizado,
          und,
          quantidade,
          valorUnit,
          total: valorTotal
        };

        itens.push(item);

        // Acumular no resumo
        if (!resumoPorTipo[tipoNormalizado]) {
          resumoPorTipo[tipoNormalizado] = {
            tipo: tipoNormalizado,
            quantidade: 0,
            total: 0,
            itens: 0
          };
        }
        resumoPorTipo[tipoNormalizado].quantidade += quantidade;
        resumoPorTipo[tipoNormalizado].total += valorTotal;
        resumoPorTipo[tipoNormalizado].itens += 1;
      }
    }

    console.log('[importarComposicoesCPUMultiTipo] Itens válidos encontrados:', itens.length);
    console.log('[importarComposicoesCPUMultiTipo] Resumo por tipo:', resumoPorTipo);

    // Converter resumo em array
    const resumoArray = Object.values(resumoPorTipo);
    const totalGeral = resumoArray.reduce((sum, r) => sum + r.total, 0);

    return Response.json({
      sucesso: true,
      itens,
      resumo: {
        por_tipo: resumoArray,
        total_geral: totalGeral,
        total_itens: itens.length
      }
    });

  } catch (error) {
    console.error('[importarComposicoesCPUMultiTipo] Erro:', error);
    return Response.json(
      { error: error.message || 'Erro ao importar CPUs' },
      { status: 500 }
    );
  }
});

// === HELPER FUNCTIONS ===

/**
 * Converte string pt-BR para número
 */
function converterValorBR(valor) {
  if (!valor && valor !== 0) return 0;
  if (typeof valor === 'number') return valor;

  const str = String(valor).trim();
  if (!str) return 0;

  const numStr = str
    .replace(/\./g, '')  // remove pontos de milhar
    .replace(/,/g, '.');  // troca vírgula por ponto

  const num = parseFloat(numStr);
  return isNaN(num) ? 0 : num;
}

/**
 * Normaliza tipo para enum padrão (lowercase para compatibilidade com UI)
 */
function normalizarTipo(tipoRaw) {
  const tipo = (tipoRaw || '').trim().toLowerCase();

  if (!tipo) {
    return 'sem_tipo';
  }

  if (tipo.includes('material')) {
    return 'material';
  }

  if (tipo.includes('mo') || tipo.includes('mão') || tipo.includes('mao')) {
    return 'mao_de_obra';
  }

  if (tipo.includes('equipamento')) {
    return 'equipamento';
  }

  if (tipo.includes('serviç') || tipo.includes('servic')) {
    return 'servico';
  }

  if (tipo.includes('provis')) {
    return 'provisorios';
  }

  if (tipo.includes('mobil') || tipo.includes('instala')) {
    return 'mobilizacao';
  }

  if (tipo.includes('encargo')) {
    return 'encargos';
  }

  if (tipo.includes('bdi')) {
    return 'bdi';
  }

  return 'outros';
}
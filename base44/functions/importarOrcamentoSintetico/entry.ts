import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { file_url, arquivo_nome, obra_id, salvar_banco } = body || {};
    if (!file_url) return Response.json({ error: 'file_url obrigatório' }, { status: 400 });

    // —— Download + validação de tamanho (max 10MB) ——
    let buffer;
    try {
      const fileRes = await fetch(file_url);
      if (!fileRes.ok) {
        const txt = await fileRes.text().catch(() => '');
        return Response.json({ error: `Não foi possível baixar o arquivo (${fileRes.status}). ${txt?.slice(0,200)}` }, { status: 400 });
      }
      buffer = await fileRes.arrayBuffer();
    } catch (e) {
      return Response.json({ error: `Falha ao acessar o arquivo: ${e?.message || e}` }, { status: 400 });
    }

    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
    if (buffer.byteLength > MAX_BYTES) {
      return Response.json({ error: `Arquivo muito grande (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB). Limite: 10 MB.` }, { status: 400 });
    }

    const XLSX = await import('npm:xlsx@0.18.5');
    const dataArr = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    let workbook;
    try {
      workbook = XLSX.read(dataArr, { type: 'array' });
    } catch (e) {
      return Response.json({ error: 'Arquivo Excel inválido ou corrompido. Confirme que é .xlsx/.xls.' }, { status: 400 });
    }

    // —— Escolher aba ——
    const candidatos = ['Orçamento Sintético', 'Orcamento Sintetico', 'Sintético', 'Sintetico', 'SINTÉTICO', 'Orçamento'];
    let sheetName = workbook.SheetNames[0];
    for (const nome of candidatos) {
      if (workbook.SheetNames.includes(nome)) { sheetName = nome; break; }
    }
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return Response.json({ error: 'Nenhuma planilha encontrada no arquivo.' }, { status: 400 });

    // —— Converter para array de arrays (valor formatado para capturar texto) ——
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

    // Resolver merges
    const merged = {};
    for (const m of (sheet['!merges'] || [])) {
      const masterCell = sheet[XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c })];
      const val = masterCell ? (masterCell.w ?? masterCell.v ?? '') : '';
      for (let r = m.s.r; r <= m.e.r; r++) {
        for (let c = m.s.c; c <= m.e.c; c++) {
          if (r === m.s.r && c === m.s.c) continue;
          merged[`${r}_${c}`] = val;
        }
      }
    }

    const rows = [];
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const row = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const key = `${R}_${C}`;
        if (merged[key] !== undefined) {
          row.push(merged[key]);
        } else {
          const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })];
          // Preferir valor numérico bruto para cálculos
          row.push(cell ? (cell.v ?? '') : '');
        }
      }
      rows.push(row);
    }

    // —— Encontrar linha de cabeçalho ——
    // Critério: Item + Descrição + (Und OU Quant.) — nas primeiras 30 linhas
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(30, rows.length); i++) {
      const norm = rows[i].map(c => String(c || '').toLowerCase().replace(/\s+/g, ' ').trim());
      const hasItem  = norm.some(c => c === 'item' || c === 'item.');
      const hasDesc  = norm.some(c => c.includes('descri'));
      const hasUnd   = norm.some(c => c === 'und' || c === 'und.' || c === 'unidade' || c === 'un' || c === 'un.' || c.startsWith('unid'));
      const hasQuant = norm.some(c => c.startsWith('quant'));
      if (hasItem && hasDesc && (hasUnd || hasQuant)) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      // Segunda tentativa: apenas Item + Descrição
      for (let i = 0; i < Math.min(30, rows.length); i++) {
        const norm = rows[i].map(c => String(c || '').toLowerCase().replace(/\s+/g, ' ').trim());
        const hasItem = norm.some(c => c === 'item' || c === 'item.');
        const hasDesc = norm.some(c => c.includes('descri'));
        if (hasItem && hasDesc) { headerRowIdx = i; break; }
      }
    }

    if (headerRowIdx === -1) {
      return Response.json({
        error: 'Cabeçalho não encontrado. Procurei por linha com as colunas "Item" e "Descrição" e "Und"/"Quant." nas primeiras 30 linhas. Verifique se a planilha está no formato do Orça Fácil.',
      }, { status: 400 });
    }

    // —— Mapear índices das colunas ——
    const hRow = rows[headerRowIdx].map(c => String(c || '').toLowerCase().replace(/\s+/g, ' ').trim());

    const findCol = (...matchers) => {
      for (const m of matchers) {
        const idx = hRow.findIndex(h => typeof m === 'function' ? m(h) : h === m || h.includes(m));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const idxItem        = findCol(h => h === 'item' || h === 'item.');
    const idxDesc        = findCol('descrição', 'descricao', 'descriçao', 'descr');
    const idxCodigo      = findCol(h => h === 'código' || h === 'codigo' || h === 'cód.' || h === 'cod.' || h === 'cod');
    const idxBanco       = findCol('banco', 'base de preço', 'tabela');
    const idxUnd         = findCol(h => h === 'und' || h === 'und.' || h === 'unidade' || h === 'un' || h === 'un.' || h.startsWith('unid'));
    const idxQuant       = findCol('quant');
    const idxValorUnit   = findCol(
      h => (h.includes('unit') || h.includes('preço unit') || h.includes('preco unit') || h === 'p.unit.' || h === 'p. unit.')
           && !h.includes('bdi') && !h.includes('c/') && !h.includes('total')
    );
    const idxValorUnitBdi = findCol(
      h => (h.includes('unit') || h.includes('preço') || h.includes('preco')) && (h.includes('bdi') || h.includes('c/bdi'))
    );
    const idxTotal = findCol(
      h => (h === 'total' || h.includes('valor total') || h.includes('total r$') || h.includes('preço total'))
           && !h.includes('sem bdi') && !h.includes('c/bdi')
    );

    // —— Validar colunas obrigatórias ——
    const faltando = [];
    if (idxItem < 0) faltando.push('"Item"');
    if (idxDesc < 0) faltando.push('"Descrição"');

    if (faltando.length > 0) {
      return Response.json({
        error: `Não encontrei a(s) coluna(s) obrigatória(s): ${faltando.join(', ')}. Confira os nomes das colunas na planilha.`,
        debug: { headerRowIdx, hRow }
      }, { status: 400 });
    }

    // Colunas opcionais detectadas (para retornar ao frontend)
    const colunasDetectadas = {
      item: idxItem, descricao: idxDesc,
      codigo: idxCodigo, banco: idxBanco,
      und: idxUnd, quant: idxQuant,
      valor_unit: idxValorUnit, valor_unit_bdi: idxValorUnitBdi,
      total: idxTotal
    };

    // —— Extrair metadados (linhas ANTES do cabeçalho) ——
    let nomeObra = '';
    let bdiPercent = 0;

    for (let i = 0; i < headerRowIdx; i++) {
      const rowStr = rows[i].map(c => String(c || '').trim());

      // Nome da obra
      if (!nomeObra) {
        for (let c = 0; c < rowStr.length; c++) {
          const cell = rowStr[c].toLowerCase();
          if (cell === 'obra' || cell === 'obra:') {
            const next = rowStr.slice(c + 1).find(v => v.length > 2) || '';
            if (next) { nomeObra = next; break; }
          }
          const mObra = rowStr[c].match(/^obra[:\s]+(.+)/i);
          if (mObra && mObra[1].trim().length > 2) { nomeObra = mObra[1].trim(); break; }
        }
      }

      // BDI %
      if (!bdiPercent) {
        const joined = rowStr.join(' ').toLowerCase();
        if (/b\.?d\.?i/i.test(joined)) {
          for (let c = 0; c < rowStr.length; c++) {
            if (/b\.?d\.?i/i.test(rowStr[c])) {
              for (let off = 1; off <= 5; off++) {
                const v = parseValorBR(rowStr[c + off]);
                if (v > 0 && v < 200) { bdiPercent = v; break; }
              }
              if (bdiPercent) break;
            }
          }
          // Tentar padrão "BDI = 25,00%" na mesma célula
          if (!bdiPercent) {
            const mBdi = rowStr.join(' ').match(/b\.?d\.?i[^0-9]*(\d+[\d.,]*)\s*%/i);
            if (mBdi) bdiPercent = parseValorBR(mBdi[1]);
          }
        }
      }
    }

    // —— Extrair totais do rodapé (últimas 50 linhas após dados) ——
    let totalSemBdi = 0, totalBdi = 0, totalGeral = 0;

    for (let i = Math.max(headerRowIdx + 1, rows.length - 50); i < rows.length; i++) {
      const rowStr = rows[i].map(c => String(c || '').trim());
      const joined = rowStr.join(' ').toLowerCase();

      if (/total.*sem.*bdi|sem.*bdi.*total/i.test(joined) && !totalSemBdi) {
        const v = findMaiorNumerico(rowStr); if (v > 0) totalSemBdi = v;
      }
      if (/total.*do.*bdi|valor.*do.*bdi|bdi.*total/i.test(joined) && !joined.includes('sem') && !totalBdi) {
        const v = findMaiorNumerico(rowStr); if (v > 0) totalBdi = v;
      }
      if (/(total geral|total da obra|total do or[cç]amento|total c[/\s]*bdi)/i.test(joined) && !totalGeral) {
        const v = findMaiorNumerico(rowStr); if (v > 0) totalGeral = v;
      }
    }

    // —— Processar linhas de dados ——
    const itens = [];
    let ordem = 0;

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const itemRaw = String(row[idxItem] ?? '').trim();
      const descRaw = String(row[idxDesc] ?? '').trim();

      if (!itemRaw) continue;

      // Pular linhas de total/rodapé
      const primeiraCol = String(row[0] ?? '').trim().toLowerCase();
      if (/^(total|b\.?d\.?i|data:|revisão|elaborado|aprovado)/i.test(primeiraCol)) continue;
      if (/^(total|b\.?d\.?i)/i.test(descRaw)) continue;
      if (!descRaw && !String(row[idxUnd] ?? '').trim()) continue;

      const quant       = idxQuant >= 0       ? parseValorBR(row[idxQuant])       : 0;
      const valorUnit   = idxValorUnit >= 0   ? parseValorBR(row[idxValorUnit])   : 0;
      const valUnitBdi  = idxValorUnitBdi >= 0? parseValorBR(row[idxValorUnitBdi]): 0;
      const total       = idxTotal >= 0       ? parseValorBR(row[idxTotal])       : (quant > 0 && valorUnit > 0 ? quant * valorUnit : 0);

      const isGrupo  = /^\d+$/.test(itemRaw);
      const grupoPai = isGrupo ? null : itemRaw.includes('.') ? itemRaw.split('.').slice(0, -1).join('.') : null;
      const nivel    = isGrupo ? 0 : itemRaw.split('.').length;

      // Guardar raw para auditoria (apenas índices, sem conteúdo de células sensíveis — LGPD)
      const rawRow = {};
      [idxItem, idxDesc, idxUnd, idxQuant, idxValorUnit, idxTotal].forEach(idx => {
        if (idx >= 0 && row[idx] !== '' && row[idx] != null) rawRow[idx] = row[idx];
      });

      itens.push({
        item:          itemRaw,
        codigo:        idxCodigo >= 0 ? String(row[idxCodigo] ?? '').trim() : '',
        banco:         idxBanco >= 0  ? String(row[idxBanco]  ?? '').trim() : '',
        descricao:     descRaw,
        und:           idxUnd >= 0    ? String(row[idxUnd]    ?? '').trim() : '',
        quantidade:    quant,
        valor_unit:    valorUnit,
        valor_unit_bdi:valUnitBdi,
        total,
        is_grupo:      isGrupo,
        grupo_pai:     grupoPai,
        nivel,
        ordem:         ordem++,
        raw_row_json:  JSON.stringify(rawRow)
      });
    }

    if (itens.length === 0) {
      return Response.json({
        error: 'Nenhum item encontrado após o cabeçalho. Verifique se os dados estão na planilha correta.'
      }, { status: 400 });
    }

    // —— Calcular totais a partir dos dados se rodapé não encontrou ——
    const grupos  = itens.filter(i => i.is_grupo);
    const subItens= itens.filter(i => !i.is_grupo);

    if (!totalGeral) {
      totalGeral = grupos.length > 0
        ? grupos.reduce((s, g) => s + g.total, 0)
        : subItens.reduce((s, i) => s + i.total, 0);
    }
    if (!totalSemBdi && bdiPercent > 0 && totalGeral > 0) {
      totalSemBdi = totalGeral / (1 + bdiPercent / 100);
    }
    if (!totalBdi && totalGeral > 0 && totalSemBdi > 0) {
      totalBdi = totalGeral - totalSemBdi;
    }

    // —— Persistir no banco em lotes (batch 200) se solicitado ——
    let importId = null;
    if (salvar_banco) {
      try {
        const importRecord = await base44.asServiceRole.entities.OrcamentoSinteticoImport.create({
          obra_id:      obra_id || null,
          arquivo_nome: arquivo_nome || 'orcamento.xlsx',
          nome_obra:    nomeObra,
          bdi_percent:  bdiPercent,
          total_sem_bdi: Math.round(totalSemBdi * 100) / 100,
          total_bdi:    Math.round(totalBdi * 100) / 100,
          total_geral:  Math.round(totalGeral * 100) / 100,
          status: 'pendente',
          criado_por: user.email
        });
        importId = importRecord.id;

        // Inserir itens em batches de 200
        const BATCH = 200;
        for (let b = 0; b < itens.length; b += BATCH) {
          const slice = itens.slice(b, b + BATCH).map(item => ({
            import_id:     importId,
            obra_id:       obra_id || null,
            item:          item.item,
            descricao:     item.descricao,
            und:           item.und,
            quantidade:    item.quantidade,
            valor_unit:    item.valor_unit,
            total:         item.total,
            is_grupo:      item.is_grupo,
            grupo_pai:     item.grupo_pai || null,
            nivel:         item.nivel,
            ordem:         item.ordem,
            raw_row_json:  item.raw_row_json
          }));
          await base44.asServiceRole.entities.OrcamentoSinteticoItens.bulkCreate(slice);
        }
      } catch (dbErr) {
        console.error('[importarOrcamentoSintetico] Erro ao salvar banco:', dbErr.message);
      }
    }

    return Response.json({
      sucesso: true,
      import_id: importId,
      meta: {
        nome_obra:     nomeObra,
        bdi_percent:   bdiPercent,
        total_sem_bdi: Math.round(totalSemBdi * 100) / 100,
        total_bdi:     Math.round(totalBdi * 100) / 100,
        total_geral:   Math.round(totalGeral * 100) / 100,
        sheet_name:    sheetName,
        colunas_detectadas: colunasDetectadas
      },
      itens,
      resumo: {
        total_linhas:  itens.length,
        total_grupos:  grupos.length,
        total_itens:   subItens.length
      }
    });

  } catch (error) {
    console.error('[importarOrcamentoSintetico]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// —— Helpers ——
function parseValorBR(valor) {
  if (valor == null || valor === '') return 0;
  if (typeof valor === 'number') return valor;
  const str = String(valor).replace(/[^\d,.-]/g, '');
  if (!str) return 0;
  const hasCommaDecimal = str.includes(',') && str.lastIndexOf(',') > str.lastIndexOf('.');
  const normalized = hasCommaDecimal
    ? str.replace(/\./g, '').replace(',', '.')
    : str.replace(',', '');
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

function findMaiorNumerico(rowArr) {
  let maior = 0;
  for (const v of rowArr) {
    const n = parseValorBR(v);
    if (n > maior) maior = n;
  }
  return maior;
}
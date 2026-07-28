import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { file_url, arquivo_nome, obra_id, salvar_banco } = body || {};
    if (!file_url) return Response.json({ error: 'file_url obrigatório' }, { status: 400 });

    // Baixar arquivo
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

    const MAX_BYTES = 10 * 1024 * 1024; // 10MB
    if (buffer.byteLength > MAX_BYTES) {
      return Response.json({ error: `Arquivo muito grande (${(buffer.byteLength/1024/1024).toFixed(1)} MB). Limite: 10 MB.` }, { status: 400 });
    }

    // Ler Excel
    const XLSX = await import('npm:xlsx@0.18.5');
    const dataArr = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    let workbook;
    try {
      workbook = XLSX.read(dataArr, { type: 'array' });
    } catch (_e) {
      return Response.json({ error: 'Arquivo Excel inválido ou corrompido. Confirme que é .xlsx/.xls.' }, { status: 400 });
    }

    // Tentar escolher a aba do cronograma
    const candidatos = [
      'Cronograma Físico-Financeiro', 'Cronograma Fisico-Financeiro', 'Cronograma', 'CFF',
      'Fisico-Financeiro', 'Físico-Financeiro', 'S-Cronograma'
    ];
    let sheetName = workbook.SheetNames[0];
    for (const nome of candidatos) {
      if (workbook.SheetNames.includes(nome)) { sheetName = nome; break; }
    }
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return Response.json({ error: 'Nenhuma planilha encontrada no arquivo.' }, { status: 400 });

    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

    // Resolver merges básicos
    const merged = {};
    for (const m of (sheet['!merges'] || [])) {
      const master = sheet[XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c })];
      const val = master ? (master.w ?? master.v ?? '') : '';
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
          row.push(cell ? (cell.v ?? '') : '');
        }
      }
      rows.push(row);
    }

    // Encontrar header: Item + Descrição (primeiras 40 linhas)
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(40, rows.length); i++) {
      const norm = rows[i].map(c => String(c ?? '').toLowerCase().replace(/\s+/g,' ').trim());
      const hasItem = norm.some(c => c === 'item' || c === 'item.');
      const hasDesc = norm.some(c => c.includes('descri'));
      if (hasItem && hasDesc) { headerRowIdx = i; break; }
    }
    if (headerRowIdx === -1) {
      return Response.json({ error: 'Cabeçalho não encontrado (Item/Descrição). Verifique o layout do CFF.' }, { status: 400 });
    }

    const hRowRaw = rows[headerRowIdx];
    const hRow = hRowRaw.map(c => String(c ?? '').toLowerCase().replace(/\s+/g,' ').trim());

    const findCol = (...matchers) => {
      for (const m of matchers) {
        const idx = hRow.findIndex(h => typeof m === 'function' ? m(h) : h === m || h.includes(m));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const idxItem = findCol(h => h === 'item' || h === 'item.');
    const idxDesc = findCol('descrição', 'descricao', 'descriçao', 'descr');
    const idxUnd  = findCol(h => h === 'und' || h === 'unidade' || h.startsWith('unid'));

    if (idxItem < 0 || idxDesc < 0) {
      return Response.json({ error: 'Colunas obrigatórias não detectadas (Item/Descrição).', debug: { headerRowIdx, hRow: hRowRaw } }, { status: 400 });
    }

    // Detectar colunas de períodos
    const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const periodoIdxs = [];
    const periodoLabels = [];
    for (let c = 0; c < hRow.length; c++) {
      if (c === idxItem || c === idxDesc || c === idxUnd) continue;
      const h = hRow[c];
      const isPeriodo = (
        /per[ií]odo/.test(h) || /\d+º/.test(h) || /\d+o/.test(h) ||
        /\d{1,2}\/(\d{2}|\d{4})/.test(h) || meses.some(m => h.startsWith(m))
      );
      if (isPeriodo) {
        periodoIdxs.push(c);
        periodoLabels.push(String(hRowRaw[c] ?? `Período ${c}`));
      }
    }

    if (periodoIdxs.length === 0) {
      // fallback: considerar todas as colunas após Descrição como períodos (até 24 colunas)
      for (let c = Math.max(idxDesc, idxUnd) + 1; c < hRow.length && periodoIdxs.length < 24; c++) {
        periodoIdxs.push(c);
        periodoLabels.push(String(hRowRaw[c] ?? `Período ${c}`));
      }
    }

    if (periodoIdxs.length === 0) {
      return Response.json({ error: 'Não identifiquei colunas de períodos. Renomeie os cabeçalhos (ex.: "1º Período", "Jan/2026").' }, { status: 400 });
    }

    // Processar linhas
    const itens = [];
    const totalPorPeriodo = {}; // label -> {valor, percent}
    periodoLabels.forEach(l => { totalPorPeriodo[l] = { valor: 0, percent: 0 }; });

    let ordem = 0;
    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      const itemRaw = String(row[idxItem] ?? '').trim();
      const descRaw = String(row[idxDesc] ?? '').trim();
      if (!itemRaw && !descRaw) continue;
      if (!itemRaw) continue; // exige código estruturado

      const isGrupo = /^\d+$/.test(itemRaw);
      const grupoPai = isGrupo ? null : itemRaw.includes('.') ? itemRaw.split('.').slice(0,-1).join('.') : null;
      const nivel = isGrupo ? 0 : itemRaw.split('.').length;

      const periodos = {};
      let totalValorItem = 0;

      for (let i = 0; i < periodoIdxs.length; i++) {
        const col = periodoIdxs[i];
        const label = periodoLabels[i];
        const raw = row[col];
        const num = parseValorBR(raw);
        let percent = 0, valor = 0;
        if (typeof raw === 'string' && /%/.test(raw)) {
          percent = Math.max(0, Math.min(100, num));
        } else if (num <= 1 && num > 0) {
          // fração 0..1 -> %
          percent = Math.round(num * 10000) / 100;
        } else if (num > 0 && num <= 100) {
          // pode ser %
          percent = num;
        } else if (num > 100) {
          // valor monetário
          valor = num;
        }
        if (percent > 0 || valor > 0) {
          periodos[label] = { percent, valor };
          totalPorPeriodo[label].valor += valor;
          totalPorPeriodo[label].percent += percent;
          totalValorItem += valor;
        }
      }

      itens.push({
        item: itemRaw,
        descricao: descRaw,
        und: idxUnd >= 0 ? String(row[idxUnd] ?? '').trim() : '',
        is_grupo: isGrupo,
        grupo_pai: grupoPai,
        nivel,
        ordem: ordem++,
        periodos,
        total_valor: totalValorItem,
      });
    }

    const resumo = {
      linhas: itens.length,
      periodos: periodoLabels.length,
    };

    const meta = {
      total_por_periodo: totalPorPeriodo,
      total_geral: Object.values(totalPorPeriodo).reduce((s, v) => s + (v.valor || 0), 0),
    };

    // Nota: salvar_banco/obra_id não implementados aqui (preview). Mantido para compatibilidade.
    return Response.json({
      sucesso: true,
      arquivo_nome: arquivo_nome || 'cronograma.xlsx',
      sheet_name: sheetName,
      periodos_labels: periodoLabels,
      itens,
      meta,
      resumo,
    });
  } catch (error) {
    console.error('[importarCronogramaFisFinan]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function parseValorBR(valor) {
  if (valor == null || valor === '') return 0;
  if (typeof valor === 'number') return valor;
  const str = String(valor).replace(/[^\d,.,%-]/g, '');
  if (!str) return 0;
  // se tiver vírgula como decimal
  const hasCommaDecimal = str.includes(',') && str.lastIndexOf(',') > str.lastIndexOf('.')
  const normalized = hasCommaDecimal ? str.replace(/\./g,'').replace(',','.') : str.replace(',','');
  const n = parseFloat(normalized.replace('%',''));
  return isNaN(n) ? 0 : n;
}
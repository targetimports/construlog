import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';
import { parseBrNumber, normalizarDescricao, calcularHashArquivo } from './_lib/brNumberParser.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Apenas admin ou com permissão específica
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const obraId = formData.get('obra_id');
    const oracamentoFile = formData.get('orcamento_file');
    const cpuFile = formData.get('cpu_file');
    const cronogramaFile = formData.get('cronograma_file');

    if (!obraId) {
      return Response.json({ error: 'obra_id obrigatório' }, { status: 400 });
    }

    const resultado = {
      obra_id: obraId,
      orcamento: null,
      composicoes: null,
      cronograma: null,
      erros: []
    };

    // 1. Processar Orçamento Sintético
    if (oracamentoFile) {
      try {
        resultado.orcamento = await processarOrcamentoSintetico(
          base44, user, obraId, oracamentoFile
        );
      } catch (err) {
        resultado.erros.push({ 
          modulo: 'orcamento', 
          erro: err.message 
        });
      }
    }

    // 2. Processar Composições (CPU)
    if (cpuFile) {
      try {
        resultado.composicoes = await processarComposicoesCPU(
          base44, user, obraId, cpuFile, resultado.orcamento
        );
      } catch (err) {
        resultado.erros.push({ 
          modulo: 'composicoes', 
          erro: err.message 
        });
      }
    }

    // 3. Processar Cronograma
    if (cronogramaFile) {
      try {
        resultado.cronograma = await processarCronograma(
          base44, user, obraId, cronogramaFile
        );
      } catch (err) {
        resultado.erros.push({ 
          modulo: 'cronograma', 
          erro: err.message 
        });
      }
    }

    return Response.json(resultado, { status: 200 });
  } catch (error) {
    console.error('Erro importador:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Processar Orçamento Sintético
 */
async function processarOrcamentoSintetico(base44, user, obraId, file) {
  const buffer = await file.arrayBuffer();
  const hash = await calcularHashArquivo(new Uint8Array(buffer));

  const workbook = XLSX.read(buffer, { sheet: 'Orçamento Sintético' });
  const aba = workbook.Sheets['Orçamento Sintético'];
  const rows = XLSX.utils.sheet_to_json(aba, { defval: '' });

  // Encontrar cabeçalho: Item | Código | Banco | Descrição | Und | Quant. | Valor Unit | Valor Unit com BDI | Total
  let indiceLinhaHeader = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row['Item'] && row['Código'] && row['Descrição']) {
      indiceLinhaHeader = i;
      break;
    }
  }

  if (indiceLinhaHeader === -1) {
    throw new Error('Cabeçalho de orçamento não encontrado (esperado: Item, Código, Descrição)');
  }

  const linhasProcessadas = [];
  let totalValor = 0;
  let gruposMap = {};

  // Processar cada linha
  for (let i = indiceLinhaHeader + 1; i < rows.length; i++) {
    const row = rows[i];
    const itemNum = String(row['Item'] || '').trim();
    
    if (!itemNum) continue;

    const codigo = String(row['Código'] || '').trim();
    const banco = String(row['Banco'] || '').trim();
    const descricao = String(row['Descrição'] || '').trim();
    const und = String(row['Und'] || '').trim();
    const quant = parseBrNumber(row['Quant.']);
    const valorUnit = parseBrNumber(row['Valor Unit']);
    const valorComBdi = parseBrNumber(row['Valor Unit com BDI']);
    const valorTotal = parseBrNumber(row['Total']);

    if (!valorTotal) continue;

    // Determinar se é grupo ou item
    const isGrupo = !und || quant === null;

    try {
      let entidadeId, status = 'processada';
      let chaveNegocio = `${obraId}:${itemNum}`;

      if (isGrupo) {
        // Criar/Atualizar Grupo
        const grupoExistente = await base44.asServiceRole.entities.OrcamentoGrupo.filter({
          obra_id: obraId,
          item_num: itemNum
        });

        if (grupoExistente && grupoExistente.length > 0) {
          entidadeId = grupoExistente[0].id;
          status = 'duplicada';
          await base44.asServiceRole.entities.OrcamentoGrupo.update(entidadeId, {
            descricao,
            valor_total: valorTotal
          });
        } else {
          const novoGrupo = await base44.asServiceRole.entities.OrcamentoGrupo.create({
            obra_id: obraId,
            item_num: itemNum,
            descricao,
            valor_total: valorTotal
          });
          entidadeId = novoGrupo.id;
        }

        gruposMap[itemNum] = entidadeId;
      } else {
        // Criar/Atualizar Item
        chaveNegocio = `${obraId}:${itemNum}:${codigo}:${banco}`;
        
        const itemExistente = await base44.asServiceRole.entities.OrcamentoItem.filter({
          obra_id: obraId,
          item_num: itemNum
        });

        if (itemExistente && itemExistente.length > 0) {
          entidadeId = itemExistente[0].id;
          status = 'duplicada';
          await base44.asServiceRole.entities.OrcamentoItem.update(entidadeId, {
            codigo,
            banco,
            descricao,
            unidade: und,
            quantidade_orcada: quant,
            valor_unit_sem_bdi: valorUnit,
            valor_unit_com_bdi: valorComBdi,
            valor_total: valorTotal
          });
        } else {
          const novoItem = await base44.asServiceRole.entities.OrcamentoItem.create({
            obra_id: obraId,
            item_num: itemNum,
            codigo,
            banco,
            descricao,
            unidade: und,
            quantidade_orcada: quant,
            valor_unit_sem_bdi: valorUnit,
            valor_unit_com_bdi: valorComBdi,
            valor_total: valorTotal,
            is_grupo: false
          });
          entidadeId = novoItem.id;
        }

        totalValor += valorTotal;
      }

      // Registrar linha processada
      await base44.asServiceRole.entities.ImportacaoLinha.create({
        arquivo_hash: hash,
        arquivo_tipo: 'orcamento',
        obra_id: obraId,
        num_linha: i,
        item_num: itemNum,
        status,
        entidade_tipo: isGrupo ? 'OrcamentoGrupo' : 'OrcamentoItem',
        entidade_id: entidadeId,
        chave_negocio: chaveNegocio,
        dados_originais: {
          item_num: itemNum,
          codigo,
          banco,
          descricao,
          und,
          quant,
          valor_total: valorTotal
        },
        importacao_data: new Date().toISOString()
      });

      linhasProcessadas.push({
        item_num: itemNum,
        status,
        entidade_id: entidadeId
      });
    } catch (err) {
      await base44.asServiceRole.entities.ImportacaoLinha.create({
        arquivo_hash: hash,
        arquivo_tipo: 'orcamento',
        obra_id: obraId,
        num_linha: i,
        item_num: itemNum,
        status: 'erro',
        mensagem: err.message,
        dados_originais: { item_num: itemNum },
        importacao_data: new Date().toISOString()
      });
    }
  }

  // Criar OrcamentoObra
  const obraExistente = await base44.asServiceRole.entities.OrcamentoObra.filter({
    obra_id: obraId
  });

  if (obraExistente && obraExistente.length > 0) {
    await base44.asServiceRole.entities.OrcamentoObra.update(obraExistente[0].id, {
      arquivo_hash: hash,
      valor_total: totalValor,
      data_importacao: new Date().toISOString(),
      total_itens: linhasProcessadas.filter(l => l.status === 'processada').length
    });
  } else {
    await base44.asServiceRole.entities.OrcamentoObra.create({
      obra_id: obraId,
      arquivo_hash: hash,
      valor_total: totalValor,
      data_importacao: new Date().toISOString(),
      total_itens: linhasProcessadas.filter(l => l.status === 'processada').length
    });
  }

  return {
    total_linhas: linhasProcessadas.length,
    linhas_processadas: linhasProcessadas.filter(l => l.status === 'processada').length,
    linhas_duplicadas: linhasProcessadas.filter(l => l.status === 'duplicada').length,
    valor_total: totalValor,
    arquivo_hash: hash
  };
}

/**
 * Processar Composições (CPU)
 */
async function processarComposicoesCPU(base44, user, obraId, file, oracamentoResult) {
  const buffer = await file.arrayBuffer();
  const hash = await calcularHashArquivo(new Uint8Array(buffer));

  const workbook = XLSX.read(buffer);
  const abas = workbook.SheetNames;
  const abaName = abas[0]; // Usar primeira aba
  const aba = workbook.Sheets[abaName];
  const rows = XLSX.utils.sheet_to_json(aba, { defval: '' });

  let linhasProcessadas = [];
  let composicoesCriadas = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const colA = String(row['col_0'] || '').trim();
    const colB = String(row['col_1'] || '').trim();
    const colC = String(row['col_2'] || '').trim();
    const colD = String(row['Obra'] || '').trim();
    const colE = String(row['Bancos'] || '').trim();
    const colG = String(row['B.D.I.'] || '').trim();
    const colH = String(row['Encargos Sociais'] || '').trim();
    const colI = String(row['col_8'] || '').trim();

    // Detectar bloco de composição: colA = item_num, colB = "Código"
    if (colB === 'Código') {
      // Próxima linha deve ser a composição principal
      if (i + 1 < rows.length) {
        const proximaRow = rows[i + 1];
        const proximoA = String(proximaRow['col_0'] || '').trim();

        if (proximoA === 'Composição') {
          const codigo = String(proximaRow['col_1'] || '').trim();
          const banco = String(proximaRow['col_2'] || '').trim();
          const descricao = String(proximaRow['Obra'] || '').trim();
          const categoria = String(proximaRow['Bancos'] || '').trim();
          const unidade = String(proximaRow['B.D.I.'] || '').trim();
          const valor = parseBrNumber(proximaRow['Encargos Sociais']) || parseBrNumber(proximaRow['col_8']);

          try {
            const chaveNegocio = `${codigo}:${banco}`;
            const existente = await base44.asServiceRole.entities.Composicao.filter({
              codigo,
              banco
            });

            let composicaoId;
            if (existente && existente.length > 0) {
              composicaoId = existente[0].id;
              await base44.asServiceRole.entities.Composicao.update(composicaoId, {
                descricao,
                categoria,
                unidade,
                valor_unitario: valor,
                item_num_orcamento: colA
              });
            } else {
              const nova = await base44.asServiceRole.entities.Composicao.create({
                codigo,
                banco,
                descricao,
                categoria,
                unidade,
                valor_unitario: valor,
                item_num_orcamento: colA,
                obra_id: obraId
              });
              composicaoId = nova.id;
            }

            composicoesCriadas[colA] = { id: composicaoId, codigo, banco };

            linhasProcessadas.push({
              num_linha: i,
              tipo: 'composicao',
              item_num: colA,
              codigo,
              status: existente ? 'duplicada' : 'processada'
            });
          } catch (err) {
            linhasProcessadas.push({
              num_linha: i,
              tipo: 'composicao',
              status: 'erro',
              erro: err.message
            });
          }
        }
      }
    }

    // Detectar linhas internas (Insumo ou Composição/subcomposição)
    if (colA === 'Insumo' || colA === 'Composição') {
      // Encontrar composição atual pela linha anterior com item_num
      let composicaoIdAtual = null;
      for (let j = i - 1; j >= 0; j--) {
        const rowAnt = rows[j];
        const colBant = String(rowAnt['col_1'] || '').trim();
        if (colBant === 'Código') {
          const itemAnt = String(rowAnt['col_0'] || '').trim();
          if (composicoesCriadas[itemAnt]) {
            composicaoIdAtual = composicoesCriadas[itemAnt].id;
          }
          break;
        }
      }

      if (composicaoIdAtual) {
        const codigo = colB;
        const banco = colC;
        const descricao = colD;
        const tipo = colE;
        const unidade = colG;
        const quantidade = parseBrNumber(colH);
        const valorUnit = parseBrNumber(colI);
        const valorTotal = quantidade && valorUnit ? quantidade * valorUnit : parseBrNumber(colI);

        try {
          const chaveNegocio = `${codigo}:${banco}`;
          let insumoId = null;

          if (colA === 'Insumo') {
            const existenteInsumo = await base44.asServiceRole.entities.Insumo.filter({
              codigo,
              banco
            });

            if (existenteInsumo && existenteInsumo.length > 0) {
              insumoId = existenteInsumo[0].id;
            } else {
              const novoInsumo = await base44.asServiceRole.entities.Insumo.create({
                codigo,
                banco,
                descricao,
                unidade,
                tipo
              });
              insumoId = novoInsumo.id;
            }
          }

          // Criar ComposicaoLinha
          await base44.asServiceRole.entities.ComposicaoLinha.create({
            composicao_id: composicaoIdAtual,
            natureza: colA === 'Insumo' ? 'INSUMO' : 'SUBCOMPOSICAO',
            codigo,
            banco,
            descricao,
            tipo,
            unidade,
            quantidade,
            valor_unit: valorUnit,
            valor_total: valorTotal,
            insumo_id: insumoId
          });

          linhasProcessadas.push({
            num_linha: i,
            tipo: colA.toLowerCase(),
            status: 'processada'
          });
        } catch (err) {
          linhasProcessadas.push({
            num_linha: i,
            tipo: colA.toLowerCase(),
            status: 'erro',
            erro: err.message
          });
        }
      }
    }
  }

  // Vincular OrcamentoItem com Composição
  const itensOrcamento = await base44.asServiceRole.entities.OrcamentoItem.filter({
    obra_id: obraId
  });

  for (const item of itensOrcamento || []) {
    for (const [itemNum, compData] of Object.entries(composicoesCriadas)) {
      if (item.item_num === itemNum || (item.codigo === compData.codigo && item.banco === compData.banco)) {
        await base44.asServiceRole.entities.OrcamentoItem.update(item.id, {
          composicao_id: compData.id
        });
      }
    }
  }

  return {
    total_linhas: linhasProcessadas.length,
    composicoes_processadas: Object.keys(composicoesCriadas).length,
    arquivo_hash: hash
  };
}

/**
 * Processar Cronograma
 */
async function processarCronograma(base44, user, obraId, file) {
  const buffer = await file.arrayBuffer();
  const hash = await calcularHashArquivo(new Uint8Array(buffer));

  const workbook = XLSX.read(buffer);
  const abaName = workbook.SheetNames[0];
  const aba = workbook.Sheets[abaName];
  const rows = XLSX.utils.sheet_to_json(aba, { defval: '' });

  let linhasProcessadas = [];
  const periodosEncontrados = new Set();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const itemNum = String(row['Item'] || '').trim();
    
    if (!itemNum || itemNum === 'Item') continue;

    // Processar cada coluna de período
    const colunasValidas = Object.keys(row).filter(k => k.includes('DIAS'));

    for (const colPeriodo of colunasValidas) {
      const valor = String(row[colPeriodo] || '').trim();
      
      if (!valor) continue;

      periodosEncontrados.add(colPeriodo);

      // Extrair percentual e valor de "percentual\nvalor"
      const linhas = valor.split('\n').map(l => l.trim());
      let percentual = null;
      let valorMoeda = null;

      for (const linha of linhas) {
        if (linha.includes('%')) {
          percentual = parseBrNumber(linha);
        } else if (linha.includes(',') || linha.includes('.') || !isNaN(linha)) {
          valorMoeda = parseBrNumber(linha);
        }
      }

      if (percentual === null || valorMoeda === null) continue;

      try {
        const chaveNegocio = `${obraId}:${itemNum}:${colPeriodo}`;
        const existente = await base44.asServiceRole.entities.CronogramaItemPeriodo.filter({
          obra_id: obraId,
          item_num: itemNum,
          periodo_nome: colPeriodo
        });

        if (existente && existente.length > 0) {
          await base44.asServiceRole.entities.CronogramaItemPeriodo.update(existente[0].id, {
            percentual,
            valor: valorMoeda
          });
        } else {
          const diasMatch = colPeriodo.match(/(\d+)/);
          const diasNum = diasMatch ? parseInt(diasMatch[1]) : null;

          await base44.asServiceRole.entities.CronogramaItemPeriodo.create({
            obra_id: obraId,
            item_num: itemNum,
            periodo_nome: colPeriodo,
            periodo_dias: diasNum,
            percentual,
            valor: valorMoeda
          });
        }

        linhasProcessadas.push({
          num_linha: i,
          item_num: itemNum,
          periodo: colPeriodo,
          status: 'processada'
        });
      } catch (err) {
        linhasProcessadas.push({
          num_linha: i,
          status: 'erro',
          erro: err.message
        });
      }
    }
  }

  return {
    total_linhas: linhasProcessadas.length,
    linhas_processadas: linhasProcessadas.filter(l => l.status === 'processada').length,
    periodos_encontrados: Array.from(periodosEncontrados),
    arquivo_hash: hash
  };
}
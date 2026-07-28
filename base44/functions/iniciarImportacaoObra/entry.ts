import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { arquivo_url } = await req.json();

    if (!arquivo_url) {
      return Response.json({ error: 'arquivo_url não fornecido' }, { status: 400 });
    }

    // Baixar e ler arquivo
    const fileResponse = await fetch(arquivo_url);
    const buffer = await fileResponse.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Análise inteligente
    const analise = analisarPlanilha(data);

    // Criar sessão de importação
    const session = await base44.asServiceRole.entities.ImportSession.create({
      user_email: user.email,
      status: 'pending_completion',
      arquivo_url,
      dados_extraidos: analise,
      etapa_atual: 1,
      total_materiais: analise.itens.length,
      materiais_pendentes: 0
    });

    // Matching automático de materiais
    const materiaisPendentes = [];
    
    for (const item of analise.itens) {
      let matchStatus = 'pendente';
      let insumoMatchId = null;
      let insumoNome = null;
      let opcoesMatch = [];

      // Tentar match por código exato
      if (item.codigo) {
        const insumosPorCodigo = await base44.asServiceRole.entities.Insumo.filter({
          codigo: item.codigo
        });
        
        if (insumosPorCodigo.length === 1) {
          matchStatus = 'ok';
          insumoMatchId = insumosPorCodigo[0].id;
          insumoNome = insumosPorCodigo[0].descricao;
        } else if (insumosPorCodigo.length > 1) {
          matchStatus = 'conflito';
          opcoesMatch = insumosPorCodigo.map(i => i.id);
        }
      }

      // Se não match por código, tentar por descrição aproximada
      if (!insumoMatchId && item.descricao) {
        const insumosPorDesc = await base44.asServiceRole.entities.Insumo.filter({
          descricao: item.descricao
        });

        if (insumosPorDesc.length === 1) {
          matchStatus = 'ok';
          insumoMatchId = insumosPorDesc[0].id;
          insumoNome = insumosPorDesc[0].descricao;
        } else if (insumosPorDesc.length > 1) {
          matchStatus = 'conflito';
          opcoesMatch = insumosPorDesc.map(i => i.id);
        }
      }

      if (matchStatus === 'pendente' || matchStatus === 'conflito') {
        materiaisPendentes.push(item.descricao);
      }

      await base44.asServiceRole.entities.ImportMaterial.create({
        session_id: session.id,
        codigo: item.codigo || `IMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        descricao: item.descricao,
        unidade: item.unidade,
        quantidade: item.quantidade,
        valor_unitario: item.valorUnitario,
        valor_total: item.valorTotal,
        banco: item.banco || 'SINAPI',
        grupo: item.grupo,
        match_status: matchStatus,
        insumo_match_id: insumoMatchId,
        insumo_nome: insumoNome,
        opcoes_match: opcoesMatch,
        resolved: matchStatus === 'ok'
      });
    }

    // Atualizar contagem de pendentes
    await base44.asServiceRole.entities.ImportSession.update(session.id, {
      materiais_pendentes: materiaisPendentes.length
    });

    return Response.json({
      success: true,
      session_id: session.id,
      dados_extraidos: analise,
      materiais_pendentes: materiaisPendentes.length,
      total_materiais: analise.itens.length
    });

  } catch (error) {
    console.error('Erro ao iniciar importação:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function analisarPlanilha(data) {
  let headerRowIndex = -1;

  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    if (row && row.some(cell => cell && String(cell).toLowerCase().includes('item'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) headerRowIndex = 2;

  let nomeObra = '';
  if (data[0] && data[0][3]) {
    nomeObra = String(data[0][3]).trim();
  }

  const headerRow = data[headerRowIndex];
  const mapa = mapeiarColunas(headerRow);

  const itens = [];
  let totalGeral = 0;
  const grupos = new Set();

  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[mapa.descricao]) continue;

    const descricao = String(row[mapa.descricao]).trim();
    if (!descricao || descricao.length < 2) continue;

    const codigo = row[mapa.codigo] ? String(row[mapa.codigo]).trim() : '';
    const quantidade = parseFloat(row[mapa.quantidade]) || 0;

    if (!codigo || quantidade === 0) {
      grupos.add(descricao);
      continue;
    }

    const unidade = row[mapa.unidade] ? String(row[mapa.unidade]).trim() : 'un';
    const valorUnit = parseFloat(row[mapa.valorUnitario]) || 0;
    const valorTotal = parseFloat(row[mapa.valorTotal]) || (quantidade * valorUnit);

    itens.push({
      codigo,
      descricao,
      unidade,
      quantidade,
      valorUnitario: valorUnit,
      valorTotal,
      grupo: Array.from(grupos)[grupos.size - 1] || 'Geral',
      banco: row[mapa.banco] ? String(row[mapa.banco]).trim() : 'SINAPI'
    });

    totalGeral += valorTotal;
  }

  return {
    nomeObra,
    itens,
    totalGeral,
    grupos: Array.from(grupos)
  };
}

function mapeiarColunas(headerRow) {
  const indices = {
    item: -1,
    codigo: -1,
    banco: -1,
    descricao: -1,
    unidade: -1,
    quantidade: -1,
    valorUnitario: -1,
    valorTotal: -1
  };

  const nomesColunas = {
    item: ['item', 'n°', 'nº', '#'],
    codigo: ['código', 'code', 'cod'],
    banco: ['banco', 'base', 'tabela'],
    descricao: ['descrição', 'description', 'desc', 'obra'],
    unidade: ['unidade', 'und', 'unit', 'bancos'],
    quantidade: ['quantidade', 'quant', 'qty', 'quantity'],
    valorUnitario: ['valor unit', 'valor unitário', 'unitário', 'preço unit', 'valor unit com bdi', 'encargos sociais'],
    valorTotal: ['valor total', 'total', 'valor', 'subtotal']
  };

  headerRow.forEach((cell, idx) => {
    if (!cell) return;
    const normalized = String(cell).toLowerCase().trim();

    for (const [key, aliases] of Object.entries(nomesColunas)) {
      if (aliases.some(alias => normalized.includes(alias))) {
        indices[key] = idx;
        break;
      }
    }
  });

  if (indices.descricao === -1) indices.descricao = 3;
  if (indices.quantidade === -1) indices.quantidade = 5;
  if (indices.valorUnitario === -1) indices.valorUnitario = 6;
  if (indices.valorTotal === -1) indices.valorTotal = 8;
  if (indices.codigo === -1) indices.codigo = 1;
  if (indices.unidade === -1) indices.unidade = 4;

  return indices;
}
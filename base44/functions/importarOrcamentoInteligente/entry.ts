import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const nomeObra = formData.get('nomeObra');

    if (!file) {
      return Response.json({ error: 'Arquivo não fornecido' }, { status: 400 });
    }

    // Ler arquivo Excel
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { header: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Análise inteligente da planilha
    const analise = analisarPlanilha(data);

    // Criar obra automaticamente
    const obra = await base44.asServiceRole.entities.Obra.create({
      nome: nomeObra || analise.nomeObra || `Obra ${new Date().toISOString().split('T')[0]}`,
      descricao: `Importada de orçamento em ${new Date().toLocaleDateString('pt-BR')}`,
      data_inicio: new Date().toISOString().split('T')[0],
      status: 'planejamento',
      valor_total: analise.totalGeral,
      user_criador: user.email,
      data_importacao: new Date().toISOString()
    });

    // Criar Orçamento Analítico
    const orcamento = await base44.asServiceRole.entities.Orcamento.create({
      obra_id: obra.id,
      nome: `Orçamento - ${obra.nome}`,
      data_criacao: new Date().toISOString().split('T')[0],
      valor_total: analise.totalGeral,
      status: 'em_analise',
      criado_por: user.email,
      versao: 1
    });

    // Criar itens do orçamento
    const itens = [];
    let sequencia = 1;

    for (const item of analise.itens) {
      const oracamentoItem = await base44.asServiceRole.entities.OrcamentoItem.create({
        orcamento_id: orcamento.id,
        codigo: item.codigo,
        descricao: item.descricao,
        unidade: item.unidade,
        quantidade: item.quantidade,
        valor_unitario: item.valorUnitario,
        valor_total: item.valorTotal,
        grupo: item.grupo,
        subgrupo: item.subgrupo,
        sequencia: sequencia++,
        tipo: 'material',
        bdi: analise.bdi,
        encargos_sociais: analise.encargos_sociais
      });

      itens.push(oracamentoItem);

      // Se for material/insumo, criar previsão de consumo no estoque
      if (item.tipo === 'material') {
        await criarPrevisaoEstoque(base44, obra.id, item, user.email);
      }
    }

    // Criar LancamentoFinanceiro para orçamento
    await base44.asServiceRole.entities.LancamentoFinanceiro.create({
      obra_id: obra.id,
      categoria: 'orcamento',
      tipo: 'despesa',
      descricao: `Orçamento importado - ${orcamento.nome}`,
      valor: analise.totalGeral,
      data: new Date().toISOString().split('T')[0],
      status: 'previsto',
      responsavel: user.email
    });

    return Response.json({
      sucesso: true,
      obra: {
        id: obra.id,
        nome: obra.nome,
        valor_total: obra.valor_total
      },
      orcamento: {
        id: orcamento.id,
        nome: orcamento.nome,
        itens_count: itens.length,
        valor_total: orcamento.valor_total
      },
      analise: {
        padraoDetectado: analise.padrao,
        grupos: analise.grupos,
        totalGeral: analise.totalGeral,
        bdi: analise.bdi,
        encargos_sociais: analise.encargos_sociais
      }
    });
  } catch (error) {
    console.error('Erro na importação:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function analisarPlanilha(data) {
  // Encontrar linha de cabeçalho
  let headerRowIndex = -1;
  const colunasEsperadas = ['Item', 'Código', 'Descrição', 'Und', 'Quant', 'Valor Unit', 'Total'];

  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    if (row && row.some(cell => cell && String(cell).toLowerCase().includes('item'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) headerRowIndex = 2; // Fallback

  // Extrair nome da obra (geralmente na primeira linha)
  let nomeObra = '';
  if (data[0] && data[0][3]) {
    nomeObra = String(data[0][3]).trim();
  }

  // Mapear colunas
  const headerRow = data[headerRowIndex];
  const mapa = mapeiarColunas(headerRow);

  // Extrair itens
  const itens = [];
  let bdi = '27%';
  let encargos_sociais = 'Desonerado';
  let totalGeral = 0;
  const grupos = new Set();

  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[mapa.descricao]) continue;

    const descricao = String(row[mapa.descricao]).trim();
    if (!descricao || descricao.length < 2) continue;

    // Detectar se é grupo (sem código ou quantidade)
    const codigo = row[mapa.codigo] ? String(row[mapa.codigo]).trim() : '';
    const quantidade = parseFloat(row[mapa.quantidade]) || 0;

    if (!codigo || quantidade === 0) {
      // É um grupo
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
      subgrupo: null,
      tipo: 'material',
      banco: row[mapa.banco] ? String(row[mapa.banco]).trim() : 'SINAPI'
    });

    totalGeral += valorTotal;
  }

  return {
    nomeObra,
    itens,
    totalGeral,
    grupos: Array.from(grupos),
    padrao: detectarPadrao(headerRow),
    bdi,
    encargos_sociais
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

  // Fallback se não encontrar
  if (indices.descricao === -1) indices.descricao = 3;
  if (indices.quantidade === -1) indices.quantidade = 5;
  if (indices.valorUnitario === -1) indices.valorUnitario = 6;
  if (indices.valorTotal === -1) indices.valorTotal = 8;
  if (indices.codigo === -1) indices.codigo = 1;
  if (indices.unidade === -1) indices.unidade = 4;

  return indices;
}

function detectarPadrao(headerRow) {
  const header = headerRow.map(h => String(h).toLowerCase()).join('|');

  if (header.includes('sinapi')) return 'SINAPI';
  if (header.includes('orse')) return 'ORSE';
  if (header.includes('orcafácil') || header.includes('orca')) return 'OrcaFácil';

  return 'Genérico';
}

async function criarPrevisaoEstoque(base44, obraId, item, userEmail) {
  try {
    // Procurar insumo existente
    let insumo = null;
    const insumos = await base44.asServiceRole.entities.Insumo.filter({
      descricao: item.descricao
    });

    if (insumos.length === 0) {
      // Criar novo insumo
      insumo = await base44.asServiceRole.entities.Insumo.create({
        codigo: item.codigo || `IMP-${Date.now()}`,
        descricao: item.descricao,
        unidade: item.unidade,
        grupo: 'material',
        tipo: 'material',
        origem: 'importado',
        preco_referencia: item.valorUnitario,
        preco_ultima_compra: item.valorUnitario,
        status_precificacao: 'ok',
        ativo: true
      });
    } else {
      insumo = insumos[0];
    }

    // Criar demanda de estoque
    await base44.asServiceRole.entities.DemandaEstoqueObra.create({
      obra_id: obraId,
      insumo_id: insumo.id,
      quantidade_prevista: item.quantidade,
      quantidade_solicitada: 0,
      data_prevista: new Date().toISOString().split('T')[0],
      status: 'prevista',
      prioridade: 'normal',
      registrado_por: userEmail
    });
  } catch (e) {
    console.log('Aviso: Não foi possível criar previsão de estoque:', e.message);
  }
}
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url, tipo, fonte } = await req.json();

    // Download do arquivo
    const fileResponse = await fetch(file_url);
    const arrayBuffer = await fileResponse.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;
    const detalhes_erros = [];

    // Processar cada linha
    for (let i = 0; i < data.length; i++) {
      const linha = data[i];
      const numeroLinha = i + 2; // +2 porque começa em 1 e tem cabeçalho

      try {
        if (tipo === 'composicoes' || tipo === 'completo') {
          // Validações
          if (!linha.CODIGO || !linha.DESCRICAO || !linha.UNIDADE) {
            throw new Error('Campos obrigatórios faltando');
          }

          const unidadesValidas = ['m', 'm2', 'm3', 'un', 'kg', 'l', 'sc', 'cx', 'h', 'dia', 'mes', 't', 'vb'];
          if (!unidadesValidas.includes(linha.UNIDADE)) {
            throw new Error(`Unidade inválida: ${linha.UNIDADE}`);
          }

          const custoUnitario = parseFloat(linha.CUSTO_UNITARIO || 0);
          if (isNaN(custoUnitario)) {
            throw new Error('Custo unitário inválido');
          }

          // Verificar se já existe
          const existentes = await base44.asServiceRole.entities.Composicao.filter({
            codigo: linha.CODIGO
          });

          const dados = {
            codigo: linha.CODIGO,
            descricao: linha.DESCRICAO,
            unidade: linha.UNIDADE,
            custo_unitario: custoUnitario,
            bdi_padrao: parseFloat(linha.BDI || 0),
            encargos_padrao: parseFloat(linha.ENCARGOS || 0),
            fonte: fonte,
            categoria: linha.CATEGORIA || null,
            data_base: new Date().toISOString().split('T')[0],
            ativo: true,
            atualizado_por: user.email
          };

          if (existentes.length > 0) {
            await base44.asServiceRole.entities.Composicao.update(existentes[0].id, dados);
            atualizados++;
          } else {
            await base44.asServiceRole.entities.Composicao.create(dados);
            inseridos++;
          }
        }

        if (tipo === 'insumos' || tipo === 'completo') {
          if (!linha.CODIGO || !linha.DESCRICAO || !linha.UNIDADE || !linha.TIPO || !linha.PRECO) {
            continue; // Pula se não for linha de insumo
          }

          const tiposValidos = ['material', 'mao_obra', 'equipamento', 'servico'];
          if (!tiposValidos.includes(linha.TIPO)) {
            throw new Error(`Tipo de insumo inválido: ${linha.TIPO}`);
          }

          const preco = parseFloat(linha.PRECO);
          if (isNaN(preco) || preco < 0) {
            throw new Error('Preço inválido');
          }

          const existentes = await base44.asServiceRole.entities.Insumo.filter({
            codigo: linha.CODIGO
          });

          const dados = {
            codigo: linha.CODIGO,
            descricao: linha.DESCRICAO,
            unidade: linha.UNIDADE,
            tipo: linha.TIPO,
            preco_unitario: preco,
            data_preco: new Date().toISOString().split('T')[0],
            fonte: fonte,
            ativo: true
          };

          if (existentes.length > 0) {
            // Adicionar ao histórico
            const insumo = existentes[0];
            const historico = insumo.historico_precos || [];
            historico.push({
              preco: insumo.preco_unitario,
              data: insumo.data_preco,
              usuario: user.email
            });

            await base44.asServiceRole.entities.Insumo.update(insumo.id, {
              ...dados,
              historico_precos: historico
            });
            atualizados++;
          } else {
            await base44.asServiceRole.entities.Insumo.create(dados);
            inseridos++;
          }
        }

      } catch (error) {
        erros++;
        detalhes_erros.push({
          linha: numeroLinha,
          codigo: linha.CODIGO || 'N/A',
          mensagem: error.message
        });
      }
    }

    // Registrar log
    await base44.asServiceRole.entities.LogImportacao.create({
      usuario: user.email,
      arquivo: file_url.split('/').pop(),
      tipo: tipo,
      status: erros === 0 ? 'sucesso' : (inseridos + atualizados > 0 ? 'parcial' : 'erro'),
      total_linhas: data.length,
      inseridos,
      atualizados,
      erros,
      detalhes_erros: detalhes_erros.slice(0, 20) // Limitar a 20 erros
    });

    return Response.json({
      status: erros === 0 ? 'sucesso' : 'parcial',
      total_linhas: data.length,
      inseridos,
      atualizados,
      erros,
      detalhes_erros
    });

  } catch (error) {
    console.error('Erro na importação:', error);
    return Response.json({ 
      error: error.message,
      status: 'erro'
    }, { status: 500 });
  }
});
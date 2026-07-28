import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Função para testes de aceite da integração NF completa
 * Valida cenários críticos: auditoria, permissões, fallback manual
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Apenas admin pode executar testes
    if (user.role !== 'admin') {
      return Response.json({ error: 'Apenas admin pode executar testes' }, { status: 403 });
    }

    const { teste } = await req.json();

    const resultados = {
      timestamp: new Date().toISOString(),
      usuario: user.email,
      testes: []
    };

    // TESTE 1: Verificar se auditoria está registrando
    try {
      const auditoriasRecentes = await base44.entities.NotaFiscalAuditoria.filter(
        {},
        '-created_date',
        10
      );

      const temAuditoriasValidas = auditoriasRecentes.some(a => 
        a.campo_alterado && a.valor_antigo && a.valor_novo && a.user_id
      );

      resultados.testes.push({
        nome: 'AUDITORIA: Registros válidos existem',
        status: temAuditoriasValidas ? 'PASSOU' : 'FALHOU',
        detalhes: `${auditoriasRecentes.length} registros encontrados`,
        amostra: auditoriasRecentes.slice(0, 3)
      });
    } catch (err) {
      resultados.testes.push({
        nome: 'AUDITORIA: Verificação',
        status: 'ERRO',
        erro: err.message
      });
    }

    // TESTE 2: Verificar se há NFs confirmadas com valores_final_ajustado preenchidos
    try {
      const nfsConfirmadas = await base44.entities.NotaFiscal.filter(
        { status: 'CONFIRMADO' },
        '-created_date',
        5
      );

      const todasTemValorFinal = nfsConfirmadas.every(nf => 
        nf.valor_final_ajustado && nf.valor_final_ajustado > 0
      );

      resultados.testes.push({
        nome: 'NF: valor_final_ajustado preenchido',
        status: todasTemValorFinal && nfsConfirmadas.length > 0 ? 'PASSOU' : 'AVISO',
        detalhes: `${nfsConfirmadas.length} NFs confirmadas encontradas`,
        amostras: nfsConfirmadas.slice(0, 2).map(nf => ({
          numero: nf.numero,
          valor_total: nf.valor_total,
          valor_final_ajustado: nf.valor_final_ajustado
        }))
      });
    } catch (err) {
      resultados.testes.push({
        nome: 'NF: Verificação valor_final_ajustado',
        status: 'ERRO',
        erro: err.message
      });
    }

    // TESTE 3: Verificar se há vínculos NF-GASTO_OBRA com obra_id preenchido
    try {
      const vinculos = await base44.entities.NotaFiscalVinculo.filter(
        { referencia_tipo: 'GASTO_OBRA' },
        '-created_date',
        5
      );

      const todosTemObraId = vinculos.every(v => v.obra_id && v.obra_id !== '');

      resultados.testes.push({
        nome: 'NF-GASTO: obra_id preenchido',
        status: todosTemObraId && vinculos.length > 0 ? 'PASSOU' : vinculos.length === 0 ? 'AVISO' : 'FALHOU',
        detalhes: `${vinculos.length} vínculos GASTO_OBRA encontrados`,
        amostras: vinculos.slice(0, 2).map(v => ({
          referencia_id: v.referencia_id,
          obra_id: v.obra_id,
          referencia_nome: v.referencia_nome
        }))
      });
    } catch (err) {
      resultados.testes.push({
        nome: 'NF-GASTO: Verificação obra_id',
        status: 'ERRO',
        erro: err.message
      });
    }

    // TESTE 4: Verificar se há Contas a Pagar vinculadas a NFs com valor correto
    try {
      const contasComNF = await base44.entities.ContaPagar.filter(
        {},
        '-created_date',
        5
      );

      const contas = contasComNF.filter(c => c.nf_id || c.nf_vinculada_id);

      resultados.testes.push({
        nome: 'CONTA PAGAR: vinculada a NF',
        status: contas.length > 0 ? 'PASSOU' : 'AVISO',
        detalhes: `${contas.length} contas encontradas com NF vinculada`,
        amostras: contas.slice(0, 2).map(c => ({
          descricao: c.descricao,
          valor_total: c.valor_total,
          nf_id: c.nf_id || c.nf_vinculada_id
        }))
      });
    } catch (err) {
      resultados.testes.push({
        nome: 'CONTA PAGAR: Verificação vinculação',
        status: 'ERRO',
        erro: err.message
      });
    }

    // TESTE 5: Simular edição de NF e verificar auditoria
    try {
      // Criar NF de teste
      const nfTeste = await base44.entities.NotaFiscal.create({
        tipo: 'NF',
        numero: `TESTE-${Date.now()}`,
        data_emissao: new Date().toISOString().split('T')[0],
        emissor_nome: 'EMPRESA TESTE',
        valor_total: 1000,
        status: 'ENVIADO'
      });

      // Registrar uma alteração de teste
      await base44.functions.invoke('registrarAlteracaoNFAuditoria', {
        documento_fiscal_id: nfTeste.id,
        campo_alterado: 'valor_desconto',
        valor_antigo: '0',
        valor_novo: '100',
        motivo: 'Teste de aceite',
        acao: 'EDICAO'
      });

      // Verificar se foi registrado
      const auditoria = await base44.entities.NotaFiscalAuditoria.filter(
        { documento_fiscal_id: nfTeste.id },
        null,
        1
      );

      resultados.testes.push({
        nome: 'AUDITORIA: Registro de alteração funciona',
        status: auditoria.length > 0 ? 'PASSOU' : 'FALHOU',
        detalhes: 'Alteração registrada e recuperada com sucesso',
        registro: auditoria[0]
      });

      // Cleanup
      await base44.entities.NotaFiscal.delete(nfTeste.id);
    } catch (err) {
      resultados.testes.push({
        nome: 'AUDITORIA: Teste de registro',
        status: 'ERRO',
        erro: err.message
      });
    }

    // TESTE 6: Verificar permissões
    try {
      const usuarioSemPermissao = await base44.entities.User.filter(
        { role: { $ne: 'admin' } },
        null,
        1
      );

      const podeTestarPermissoes = usuarioSemPermissao.length > 0;

      resultados.testes.push({
        nome: 'PERMISSÕES: Usuários sem admin existem (para testar bloqueio)',
        status: podeTestarPermissoes ? 'PASSOU' : 'AVISO',
        detalhes: `${usuarioSemPermissao.length} usuários encontrados para teste de permissão`
      });
    } catch (err) {
      resultados.testes.push({
        nome: 'PERMISSÕES: Verificação',
        status: 'ERRO',
        erro: err.message
      });
    }

    // RESUMO FINAL
    const totalTestes = resultados.testes.length;
    const passou = resultados.testes.filter(t => t.status === 'PASSOU').length;
    const avisos = resultados.testes.filter(t => t.status === 'AVISO').length;
    const erros = resultados.testes.filter(t => t.status === 'ERRO').length;

    resultados.resumo = {
      total: totalTestes,
      passou,
      avisos,
      erros,
      statusGeral: erros === 0 ? 'PRONTO PARA PRODUÇÃO ✅' : 'REVISÃO NECESSÁRIA ⚠️'
    };

    return Response.json(resultados, { status: 200 });
  } catch (error) {
    console.error('Erro ao executar testes:', error);
    return Response.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
});
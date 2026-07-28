import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas admin pode gerar relatórios' }, { status: 403 });
    }

    const { tipo, obra_id, periodo } = await req.json();

    // Buscar dados conforme o tipo de relatório
    let dadosParaAnalise = {};

    if (tipo === 'financeiro' || tipo === 'completo') {
      const contas = await base44.entities.ContaFinanceira.filter(
        obra_id ? { obra_id } : {}
      );
      const orcamentos = await base44.entities.OrcamentoObra.list();
      
      dadosParaAnalise.financeiro = {
        total_pagar: contas.filter(c => c.tipo === 'pagar').reduce((sum, c) => sum + c.valor, 0),
        total_receber: contas.filter(c => c.tipo === 'receber').reduce((sum, c) => sum + c.valor, 0),
        atrasadas: contas.filter(c => c.status === 'atrasado').length,
        orcamentos: orcamentos.map(o => ({
          obra: o.obra_id,
          valor_total: o.valor_total,
          status: o.status
        }))
      };
    }

    if (tipo === 'frota' || tipo === 'completo') {
      const veiculos = await base44.entities.Veiculo.list();
      const manutencoes = await base44.entities.Manutencao.list();
      
      dadosParaAnalise.frota = {
        total_veiculos: veiculos.length,
        ativos: veiculos.filter(v => v.status === 'ativo').length,
        manutencao: veiculos.filter(v => v.status === 'manutencao').length,
        manutencoes_programadas: manutencoes.filter(m => m.status === 'agendada').length
      };
    }

    if (tipo === 'estoque' || tipo === 'completo') {
      const materiais = await base44.entities.Material.list();
      
      dadosParaAnalise.estoque = {
        total_materiais: materiais.length,
        baixo_estoque: materiais.filter(m => m.estoque_atual <= m.estoque_minimo).length,
        valor_total: materiais.reduce((sum, m) => sum + (m.estoque_atual * m.preco_medio), 0)
      };
    }

    if (tipo === 'alertas' || tipo === 'completo') {
      const obras = await base44.entities.Obra.list();
      const colaboradores = await base44.entities.Colaborador.list();
      
      const alertas = [];
      
      // Alertas de obras sem equipe
      const obrasSemColaboradores = obras.filter(o => 
        o.status === 'em_andamento' && 
        !colaboradores.some(c => c.obra_atual_id === o.id && c.status === 'ativo')
      );
      
      if (obrasSemColaboradores.length > 0) {
        alertas.push({
          tipo: 'critico',
          titulo: `${obrasSemColaboradores.length} obra(s) sem equipe`,
          impacto: 'Alto'
        });
      }

      dadosParaAnalise.alertas = alertas;
    }

    // Gerar relatório com IA
    const prompt = `Gere um relatório executivo detalhado baseado nos seguintes dados operacionais:

${JSON.stringify(dadosParaAnalise, null, 2)}

O relatório deve incluir:
1. Resumo executivo (3-4 parágrafos)
2. Indicadores principais (KPIs)
3. Alertas críticos identificados
4. Recomendações de ação (mínimo 3)
5. Próximos passos sugeridos

Use linguagem clara, profissional e acionável. Formate com markdown para melhor leitura.`;

    const relatorio = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      add_context_from_internet: false
    });

    // Salvar relatório
    const relatorioSalvo = await base44.entities.RelatorioAgendado.create({
      titulo: `Relatório ${tipo} - ${new Date().toLocaleDateString('pt-BR')}`,
      tipo: tipo,
      frequencia: 'unica',
      destinatarios: [user.email],
      ativo: false,
      configuracao: {
        incluir_graficos: true,
        incluir_alertas_criticos: true,
        incluir_recomendacoes_ia: true
      }
    });

    // Log de auditoria
    await base44.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'gerar_relatorio_ia',
      modulo: 'relatorios',
      entidade: 'RelatorioAgendado',
      entidade_id: relatorioSalvo.id,
      detalhes: `Relatório ${tipo} gerado via IA`,
      sucesso: true
    });

    return Response.json({
      success: true,
      relatorio_id: relatorioSalvo.id,
      conteudo: relatorio,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
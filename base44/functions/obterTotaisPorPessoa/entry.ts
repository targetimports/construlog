import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { periodo } = await req.json();

    const [
      maoDeObra,
      retiradas,
      empreitas,
      investimentos,
      alimentacao,
      aluguel
    ] = await Promise.all([
      base44.asServiceRole.entities.MaoDeObra.list(),
      base44.asServiceRole.entities.Retirada.list(),
      base44.asServiceRole.entities.Empreita.list(),
      base44.asServiceRole.entities.Investimento.list(),
      base44.asServiceRole.entities.Alimentacao.list(),
      base44.asServiceRole.entities.AluguelEquipamento.list()
    ]);

    const pessoas = {};

    // Agrupar por pessoa
    [...maoDeObra, ...retiradas, ...empreitas, ...investimentos, ...alimentacao.filter(a => a.pessoa_vinculada_id), ...aluguel.filter(a => a.pessoa_responsavel_id)].forEach(registro => {
      const pessoaId = registro.pessoa_id || registro.pessoa_vinculada_id || registro.pessoa_responsavel_id;
      if (!pessoaId) return;

      if (!pessoas[pessoaId]) {
        pessoas[pessoaId] = {
          pessoa_id: pessoaId,
          mao_de_obra: 0,
          retiradas: 0,
          empreitas: 0,
          investimentos: 0,
          alimentacao: 0,
          aluguel: 0,
          total: 0
        };
      }

      if (registro.valor) {
        if ('tipo' in registro && ['diaria', 'empreita', 'salario', 'avulso'].includes(registro.tipo)) {
          pessoas[pessoaId].mao_de_obra += registro.valor;
        } else if ('status' in registro && ['pendente', 'aprovada', 'realizada'].includes(registro.status)) {
          pessoas[pessoaId].retiradas += registro.valor;
        } else if ('descricao_servico' in registro) {
          pessoas[pessoaId].empreitas += registro.valor;
        } else if ('descricao' in registro && !('valor_total' in registro)) {
          pessoas[pessoaId].investimentos += registro.valor;
        } else if ('categoria' in registro && ['refeicao', 'cafe', 'mercado'].includes(registro.categoria)) {
          pessoas[pessoaId].alimentacao += registro.valor;
        } else if ('tipo' in registro && ['aluguel_maquina', 'aluguel_equipamento'].includes(registro.tipo)) {
          pessoas[pessoaId].aluguel += registro.valor;
        }
      }
    });

    // Calcular totais
    Object.keys(pessoas).forEach(pessoaId => {
      const p = pessoas[pessoaId];
      p.total = p.mao_de_obra + p.retiradas + p.empreitas + p.investimentos + p.alimentacao + p.aluguel;
    });

    return Response.json({
      success: true,
      pessoas: Object.values(pessoas)
    });
  } catch (error) {
    console.error('Erro ao obter totais por pessoa:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
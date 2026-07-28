import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    console.log('Iniciando verificação de prazos de apontamento...');

    // Buscar todas as obras ativas
    const obras = await base44.asServiceRole.entities.Obra.filter({
      status: 'em_andamento'
    });

    console.log(`Encontradas ${obras.length} obras em andamento`);

    const hoje = new Date();
    const proximosDias = 3;
    const alertasCriados = {
      prazo_proximo: 0,
      apontamento_vencido: 0
    };

    for (const obra of obras) {
      // Buscar encarregados da obra (colaboradores com cargo de encarregado ou mestre)
      const colaboradores = await base44.asServiceRole.entities.Colaborador.filter({
        obra_atual: obra.id
      });

      const encarregados = colaboradores.filter(c => 
        c.cargo && (c.cargo.toLowerCase().includes('encarregado') || 
                   c.cargo.toLowerCase().includes('mestre'))
      );

      console.log(`Obra ${obra.nome}: ${encarregados.length} encarregados`);

      for (const encarregado of encarregados) {
        // Buscar último apontamento
        const apontamentos = await base44.asServiceRole.entities.ApontamentoMateriaisSemanal.filter({
          obra_id: obra.id,
          encarregado: encarregado.email
        }, '-created_date', 1);

        const ultimoApontamento = apontamentos[0];
        let proximaDataApontamento = new Date(hoje);
        
        if (ultimoApontamento?.data_apontamento) {
          const dataUltimo = new Date(ultimoApontamento.data_apontamento);
          proximaDataApontamento = new Date(dataUltimo);
          proximaDataApontamento.setDate(proximaDataApontamento.getDate() + 7);
        } else {
          // Se não tem apontamento, próximo seria hoje
          proximaDataApontamento = new Date(hoje);
        }

        const diasRestantes = Math.ceil(
          (proximaDataApontamento - hoje) / (1000 * 60 * 60 * 24)
        );

        console.log(`Encarregado ${encarregado.nome}: próximo apontamento em ${diasRestantes} dias`);

        // Verificar se já existe alerta para este período
        const alertasExistentes = await base44.asServiceRole.entities.AlertaApontamento.filter({
          encarregado: encarregado.email,
          obra_id: obra.id,
          lido: false
        });

        const jaTemAlerta = alertasExistentes.some(a => a.tipo === 'prazo_proximo' || a.tipo === 'apontamento_vencido');

        if (jaTemAlerta) {
          console.log(`Alerta já existe para ${encarregado.nome}`);
          continue;
        }

        // Criar alerta de prazo próximo (3 dias antes)
        if (diasRestantes <= proximosDias && diasRestantes > 0) {
          await base44.asServiceRole.entities.AlertaApontamento.create({
            encarregado: encarregado.email,
            obra_id: obra.id,
            tipo: 'prazo_proximo',
            mensagem: `⏰ Apontamento semanal vence em ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''}`,
            data_alerta: new Date().toISOString(),
            proxima_data_apontamento: proximaDataApontamento.toISOString().split('T')[0],
            lido: false
          });
          alertasCriados.prazo_proximo++;
          console.log(`Alerta criado: prazo próximo para ${encarregado.nome}`);
        }

        // Criar alerta de apontamento vencido
        if (diasRestantes <= 0) {
          await base44.asServiceRole.entities.AlertaApontamento.create({
            encarregado: encarregado.email,
            obra_id: obra.id,
            tipo: 'apontamento_vencido',
            mensagem: `❌ Apontamento semanal VENCIDO há ${Math.abs(diasRestantes)} dia${Math.abs(diasRestantes) > 1 ? 's' : ''}`,
            data_alerta: new Date().toISOString(),
            proxima_data_apontamento: proximaDataApontamento.toISOString().split('T')[0],
            lido: false
          });
          alertasCriados.apontamento_vencido++;
          console.log(`Alerta criado: apontamento vencido para ${encarregado.nome}`);
        }
      }
    }

    return Response.json({
      success: true,
      message: 'Verificação de prazos concluída',
      alertasCriados
    });

  } catch (error) {
    console.error('Erro ao verificar prazos:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Gera centro de custo automaticamente para custos de veículos
 * Chamada por automação quando Abastecimento, Manutencao ou CustoVeiculo são criados/atualizados
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entidade_tipo, entidade_id, obra_id, veiculo_id, tipo_custo } = await req.json();

    if (!entidade_tipo || !entidade_id || !obra_id || !veiculo_id) {
      return Response.json({
        error: 'Parâmetros obrigatórios: entidade_tipo, entidade_id, obra_id, veiculo_id'
      }, { status: 400 });
    }

    // Buscar veículo para obter placa
    const veiculo = await base44.entities.Veiculo.get(veiculo_id);
    if (!veiculo) {
      return Response.json({ error: 'Veículo não encontrado' }, { status: 404 });
    }

    // Buscar obra
    const obra = await base44.entities.Obra.get(obra_id);
    if (!obra) {
      return Response.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    // Mapear tipo de custo para nome descritivo
    const tiposMap = {
      'combustivel': 'Combustível',
      'preventiva': 'Manutenção Preventiva',
      'corretiva': 'Manutenção Corretiva',
      'hospedagem': 'Hospedagem',
      'alimentacao': 'Alimentação',
      'pedagio': 'Pedágio',
      'estacionamento': 'Estacionamento',
      'multa': 'Multa',
      'seguro': 'Seguro',
      'ipva': 'IPVA',
      'licenciamento': 'Licenciamento',
      'outro': 'Outro Custo'
    };

    const tipoDescritivo = tiposMap[tipo_custo] || tipo_custo;

    // Gerar nome único do centro de custo
    // Formato: "ObraXXXX - Veículo YYYY - Tipo de Custo"
    const centroCustoNome = `${obra.nome} - Veículo ${veiculo.placa} - ${tipoDescritivo}`;

    // Verificar se centro de custo já existe
    const centrosExistentes = await base44.entities.CentroCusto.filter({
      nome: centroCustoNome
    });

    let centroCusto;
    if (centrosExistentes.length > 0) {
      centroCusto = centrosExistentes[0];
      console.log(`[INFO] Centro de custo já existe: ${centroCusto.id}`);
    } else {
      // Criar novo centro de custo
      centroCusto = await base44.entities.CentroCusto.create({
        nome: centroCustoNome,
        codigo: `VE-${veiculo.placa.replace(/\D/g, '')}-${tipo_custo.substring(0, 3).toUpperCase()}`,
        obra_id: obra_id,
        ativo: true
      });

      console.log(`[INFO] Centro de custo criado: ${centroCusto.id}`);
    }

    // Atualizar entidade com centro_custo_id
    if (entidade_tipo === 'Abastecimento') {
      await base44.entities.Abastecimento.update(entidade_id, {
        centro_custo_id: centroCusto.id
      });
    } else if (entidade_tipo === 'Manutencao') {
      await base44.entities.Manutencao.update(entidade_id, {
        centro_custo_id: centroCusto.id
      });
    } else if (entidade_tipo === 'CustoVeiculo') {
      await base44.entities.CustoVeiculo.update(entidade_id, {
        centro_custo_id: centroCusto.id
      });
    }

    // Log
    await base44.entities.LogAuditoria.create({
      function_name: 'gerarCentroCustoCustoVeiculo',
      user_email: user.email,
      user_role: user.role,
      payload: JSON.stringify({ entidade_tipo, entidade_id, obra_id, veiculo_id }),
      result: 'success',
      timestamp: new Date().toISOString(),
      metadata: {
        entidade_tipo,
        centro_custo_id: centroCusto.id,
        centro_custo_nome: centroCusto.nome,
        obra_id,
        veiculo_id
      }
    });

    return Response.json({
      success: true,
      centro_custo: {
        id: centroCusto.id,
        nome: centroCusto.nome,
        codigo: centroCusto.codigo
      }
    });

  } catch (error) {
    console.error('Erro ao gerar centro de custo:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
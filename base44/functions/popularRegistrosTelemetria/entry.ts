import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Buscar veículos
    const veiculos = await base44.entities.Veiculo.list();
    
    if (veiculos.length === 0) {
      return Response.json({ error: 'Nenhum veículo cadastrado' }, { status: 400 });
    }

    // Coordenadas de cidades Brasil (exemplos)
    const locacoes = [
      { cidade: 'São Paulo', lat: -23.550520, lng: -46.633309 },
      { cidade: 'Rio de Janeiro', lat: -22.906847, lng: -43.172897 },
      { cidade: 'Brasília', lat: -15.793889, lng: -47.882778 },
      { cidade: 'Belo Horizonte', lat: -19.910498, lng: -43.936378 },
      { cidade: 'Salvador', lat: -12.971190, lng: -38.510764 },
      { cidade: 'Fortaleza', lat: -3.731862, lng: -38.526831 },
      { cidade: 'Curitiba', lat: -25.428954, lng: -49.273369 },
      { cidade: 'Manaus', lat: -3.119028, lng: -60.021731 }
    ];

    const eventos = ['movimento', 'parado', 'ocioso', 'desligado'];
    const registrosCriados = [];

    // Criar 3-5 registros por veículo
    for (const veiculo of veiculos) {
      const numRegistros = Math.floor(Math.random() * 3) + 3;
      
      for (let i = 0; i < numRegistros; i++) {
        const locacao = locacoes[Math.floor(Math.random() * locacoes.length)];
        const variacao = (Math.random() - 0.5) * 0.05; // Pequena variação
        
        const registro = {
          veiculo_id: veiculo.id,
          latitude: locacao.lat + variacao,
          longitude: locacao.lng + variacao,
          velocidade: Math.floor(Math.random() * 100),
          ignicao: Math.random() > 0.3,
          evento: eventos[Math.floor(Math.random() * eventos.length)],
          cidade: locacao.cidade,
          endereco: `Rua Exemplo, ${Math.floor(Math.random() * 1000)} - ${locacao.cidade}`,
          aceleracao: (Math.random() * 2 - 1).toFixed(2),
          temperatura_motor: Math.floor(Math.random() * 30 + 70),
          combustivel_estimado: Math.floor(Math.random() * 50 + 30),
          rpm: Math.floor(Math.random() * 3000 + 800)
        };

        const criado = await base44.entities.RegistroTelemetria.create(registro);
        registrosCriados.push(criado);
      }
    }

    // Criar alguns alertas também
    const veiculoAleatorio = veiculos[Math.floor(Math.random() * veiculos.length)];
    await base44.entities.AlertaTelemetria.create({
      veiculo_id: veiculoAleatorio.id,
      tipo: 'velocidade_excessiva',
      descricao: `Veículo ${veiculoAleatorio.placa} acelerou acima do limite`,
      severidade: 'media',
      status: 'aberto',
      latitude: -23.550520,
      longitude: -46.633309
    });

    return Response.json({
      sucesso: true,
      registros_criados: registrosCriados.length,
      veiculos_processados: veiculos.length,
      mensagem: `${registrosCriados.length} registros de telemetria criados com sucesso`
    });
  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
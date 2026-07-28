import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'PROMPT13-2026-02-14-A';
  const startTime = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const escopo = body.escopo || 'FULL';
    const obra_id = body.obra_id;
    const de = body.de;
    const ate = body.ate;

    const counts = {};
    const entityMap = {};

    // Ler entidades críticas
    const entitiesToExport = [
      'Obra', 'Equipe', 'Insumo', 'Fornecedor', 'Cliente',
      'OrdemCompra', 'RequisicaoCompra', 'RecebimentoMaterial',
      'MovimentacaoEstoque', 'SaldoEstoque', 'Almoxarifado',
      'ContaFinanceira', 'CategoriaFinanceira', 'CentroCusto', 'RateioAdministrativo',
      'Aprovacao', 'DiarioObra', 'MedicaoObra', 'MedicaoContrato', 'Contrato',
      'ApontamentoHora', 'CustoHoraColaborador', 'PoliticaEstoque', 'SugestaoCompra',
      'AgendaEvento', 'LogAuditoria'
    ];

    for (const entity of entitiesToExport) {
      try {
        let query = {};
        if (obra_id && ['Obra', 'DiarioObra', 'MedicaoObra', 'ApontamentoHora', 'ContaFinanceira'].includes(entity)) {
          query.obra_id = obra_id;
        }
        
        const records = await base44.entities[entity].list(undefined, 100);
        if (records) {
          entityMap[entity] = records;
          counts[entity] = records.length;
        }
      } catch (e) {
        counts[entity] = 0;
      }
    }

    // Serializar para base64
    const jsonData = JSON.stringify(entityMap);
    const encoded = btoa(jsonData);

    // Calcular hash (simples)
    let hash = 0;
    for (let i = 0; i < jsonData.length; i++) {
      const char = jsonData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hashStr = Math.abs(hash).toString(16);

    // Criar snapshot
    const snapshotId = `SNAP-${Date.now()}`;
    const snapshot = await base44.entities.SnapshotSistema.create({
      nome: snapshotId,
      escopo: escopo,
      status: 'criado',
      created_by: user.email,
      created_at: new Date().toISOString(),
      meta: {
        counts: counts,
        filtros: { obra_id: obra_id, de: de, ate: ate, escopo: escopo },
        versao_app: '13.0'
      },
      payload_base64: encoded,
      hash: hashStr,
      tamanho_bytes: encoded.length,
      obra_id: obra_id,
      periodo_de: de,
      periodo_ate: ate
    });

    const durationMs = Date.now() - startTime;

    return Response.json({
      ok: true,
      build_id: buildId,
      snapshot_id: snapshot.id,
      nome: snapshotId,
      counts: counts,
      hash: hashStr,
      tamanho_bytes: encoded.length,
      duracao_ms: durationMs
    });

  } catch (e) {
    return Response.json({ error: e.message, build_id: 'PROMPT13-2026-02-14-A' }, { status: 500 });
  }
});
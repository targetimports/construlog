import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const {
      needles = ["PRINCIPAIS CARACTERÍSTICAS IMPLEMENTADAS", "TESTES EXECUTADOS", "✅ PROMPT", "PROMPT", "HARDENING"],
      limit_per_entity = 50,
      max_matches = 200,
      include_archived = true,
      dry_run = true
    } = body;

    const build_id = `SCAN-${Date.now()}`;
    const matches = [];
    let scanned = 0;

    // Entidades a verificar
    const entities = [
      'Obra', 'OrdemCompra', 'ContaFinanceira', 'Aprovacao', 'HealthCheck',
      'LogAuditoria', 'OpsOutbox', 'OpsChangeRequest', 'RollbackJob',
      'SnapshotSistema', 'AgendaEvento', 'Contrato', 'MedicaoContrato', 'MedicaoObra'
    ];

    // Função para extrair strings de um objeto
    const extractStringsFromObject = (obj, parentKey = '') => {
      const strings = [];
      if (!obj) return strings;
      
      if (typeof obj === 'string') {
        return [{ value: obj, path: parentKey }];
      }
      
      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => {
          strings.push(...extractStringsFromObject(item, `${parentKey}[${idx}]`));
        });
      } else if (typeof obj === 'object') {
        Object.entries(obj).forEach(([key, value]) => {
          if (typeof value === 'string') {
            strings.push({ value, path: `${parentKey}.${key}` });
          } else if (typeof value === 'object') {
            strings.push(...extractStringsFromObject(value, `${parentKey}.${key}`));
          }
        });
      }
      
      return strings;
    };

    // Scanear cada entidade
    for (const entityName of entities) {
      if (matches.length >= max_matches) break;

      try {
        const entityRecords = await base44.asServiceRole.entities[entityName].list('-updated_date', limit_per_entity);
        scanned++;

        for (const record of entityRecords) {
          if (matches.length >= max_matches) break;

          // Skip arquivados se configurado
          if (record.archived && !include_archived) continue;

          // Verificar campos principais e payload/data
          const fieldsToCheck = [
            record.nome, record.descricao, record.observacao, record.payload,
            record.detalhes, record.contexto, record.erro, record.motivo,
            record.data, record.content, record.body
          ];

          const allStrings = [];
          for (const field of fieldsToCheck) {
            allStrings.push(...extractStringsFromObject(field));
          }

          // Verificar needles
          for (const needle of needles) {
            for (const stringObj of allStrings) {
              if (stringObj.value && stringObj.value.includes(needle)) {
                matches.push({
                  entity: entityName,
                  id: record.id,
                  field: stringObj.path,
                  snippet: stringObj.value.substring(0, 150),
                  created_date: record.created_date,
                  updated_date: record.updated_date,
                  needle_found: needle
                });
              }
            }
          }
        }
      } catch (err) {
        console.log(`[WARN] Erro ao scanear ${entityName}: ${err.message}`);
      }
    }

    const hint = matches.length === 0
      ? 'Nenhuma ocorrência encontrada em dados. Se vê na tela, pode ser: (1) painel do editor, (2) URL fragment, (3) cache/extensão.'
      : `${matches.length} ocorrência(s) encontrada(s). Revise os campos acima.`;

    return Response.json({
      ok: true,
      build_id,
      scanned,
      matches_count: matches.length,
      matches: matches.slice(0, max_matches),
      hint,
      dry_run
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Entidades operacionais agrupadas por domínio
const ENTIDADES_BACKUP = {
  obras: ['Obra', 'HistoricoObra', 'MarcoObra', 'AnexoObra', 'DocumentoObra', 'ArquivoObra', 'ObraDocumento', 'EtapaObra', 'Fase', 'Marco', 'AnexoFase'],
  orcamento: ['Orcamento', 'OrcamentoItem', 'OrcamentoGrupo', 'VersaoOrcamento', 'OrcamentoPlanejado', 'OrcamentoPlanejadoEtapa', 'OrcamentoSinteticoObra'],
  medicoes: ['Medicao', 'MedicaoItem', 'MedicaoContrato', 'MedicaoContratoItem', 'ItemMedicaoObra', 'MedicaoObra', 'ItemMedicaoOrcamento'],
  contratos: ['Contrato', 'ContratoObra', 'AditivoContrato', 'AnexoContrato', 'DocumentoContrato', 'DocumentoMedicaoContrato'],
  financeiro: ['ContaFinanceira', 'ContaFinanceiraObra', 'ReceitaObra', 'LancamentoCustoObra', 'LancamentoReceitaObra', 'LancamentoFinanceiro', 'MovimentacaoFinanceira', 'ContaReceberObra'],
  compras: ['RequisicaoCompra', 'OrdemCompra', 'RecebimentoMaterial', 'CotacaoFornecedor', 'PedidoCompra', 'SolicitacaoCompra', 'Recebimento'],
  estoque: ['SaldoEstoque', 'EstoqueMovimentacao', 'EstoqueMovimentacaoItem', 'LocalEstoque', 'NecessidadeMaterialObra', 'DemandaEstoqueObra'],
  diario: ['DiarioObra', 'DiarioObraFoto', 'DiarioObraEquipe', 'DiarioObraMotivo', 'DiarioObraMidia'],
  rh: ['ApontamentoMaoObra', 'ApontamentoHora', 'ObraColaborador', 'ControleJornada', 'FolhaPagamento', 'FolhaPagamentoItem'],
  logistica: ['Viagem', 'Abastecimento', 'MovimentacaoVeiculo', 'Vistoria', 'VistoriaItem', 'VistoriaMidia', 'MovimentacaoVeiculoMidia'],
  nf: ['NotaFiscal', 'NotaFiscalItem', 'NotaFiscalVinculo'],
  cadastros: ['Cliente', 'Fornecedor', 'Colaborador', 'Material', 'Insumo', 'GrupoInsumo', 'Equipamento', 'Veiculo'],
};

// Campos que podem conter URLs de arquivos
const CAMPOS_ARQUIVO = [
  'arquivo_url', 'anexo_boletim_url', 'anexo_nota_fiscal_url', 'url', 'file_url',
  'foto_url', 'documento_url', 'imagem_url', 'midia_url', 'pdf_url',
  'anexo_url', 'upload_url', 'boleto_url', 'comprovante_url'
];

function extrairLinks(registros) {
  const links = [];
  for (const reg of registros) {
    for (const campo of CAMPOS_ARQUIVO) {
      if (reg[campo] && typeof reg[campo] === 'string' && reg[campo].startsWith('http')) {
        links.push({ entidade: reg._entityName || '?', id: reg.id, campo, url: reg[campo] });
      }
    }
    // Arrays de mídia
    if (Array.isArray(reg.midias)) {
      for (const m of reg.midias) {
        if (m?.url) links.push({ entidade: reg._entityName || '?', id: reg.id, campo: 'midias[].url', url: m.url });
      }
    }
  }
  return links;
}

// Monta um arquivo ZIP simples (sem dependência externa) usando formato ZIP padrão
function uint8(str) {
  return new TextEncoder().encode(str);
}

function crc32(data) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (const byte of data) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function buildZip(files) {
  // files: [{name, data: Uint8Array}]
  const parts = [];
  const centralDir = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = uint8(file.name);
    const data = file.data;
    const crc = crc32(data);
    const size = data.length;

    // Local file header
    const lh = new Uint8Array(30 + nameBytes.length);
    const lhDv = new DataView(lh.buffer);
    lhDv.setUint32(0, 0x04034b50, true); // signature
    lhDv.setUint16(4, 20, true);          // version needed
    lhDv.setUint16(6, 0, true);           // flags
    lhDv.setUint16(8, 0, true);           // compression (stored)
    lhDv.setUint16(10, 0, true);          // mod time
    lhDv.setUint16(12, 0, true);          // mod date
    lhDv.setUint32(14, crc, true);
    lhDv.setUint32(18, size, true);
    lhDv.setUint32(22, size, true);
    lhDv.setUint16(26, nameBytes.length, true);
    lhDv.setUint16(28, 0, true);
    lh.set(nameBytes, 30);

    parts.push(lh, data);

    // Central directory entry
    const cd = new Uint8Array(46 + nameBytes.length);
    const cdDv = new DataView(cd.buffer);
    cdDv.setUint32(0, 0x02014b50, true);
    cdDv.setUint16(4, 20, true);
    cdDv.setUint16(6, 20, true);
    cdDv.setUint16(8, 0, true);
    cdDv.setUint16(10, 0, true);
    cdDv.setUint16(12, 0, true);
    cdDv.setUint16(14, 0, true);
    cdDv.setUint32(16, crc, true);
    cdDv.setUint32(20, size, true);
    cdDv.setUint32(24, size, true);
    cdDv.setUint16(28, nameBytes.length, true);
    cdDv.setUint16(30, 0, true);
    cdDv.setUint16(32, 0, true);
    cdDv.setUint16(34, 0, true);
    cdDv.setUint16(36, 0, true);
    cdDv.setUint32(38, 0, true); // ext attrs
    cdDv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    centralDir.push(cd);

    offset += lh.length + data.length;
  }

  const cdBytes = centralDir.reduce((a, b) => {
    const c = new Uint8Array(a.length + b.length);
    c.set(a); c.set(b, a.length);
    return c;
  }, new Uint8Array(0));

  // End of central directory
  const eocd = new Uint8Array(22);
  const eocdDv = new DataView(eocd.buffer);
  eocdDv.setUint32(0, 0x06054b50, true);
  eocdDv.setUint16(4, 0, true);
  eocdDv.setUint16(6, 0, true);
  eocdDv.setUint16(8, files.length, true);
  eocdDv.setUint16(10, files.length, true);
  eocdDv.setUint32(12, cdBytes.length, true);
  eocdDv.setUint32(16, offset, true);
  eocdDv.setUint16(20, 0, true);

  const allParts = [...parts, cdBytes, eocd];
  const total = allParts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const p of allParts) { result.set(p, pos); pos += p.length; }
  return result;
}

Deno.serve(async (req) => {
  const startTime = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { empresa_id, data_inicio, data_fim, dominios } = body;

    // Filtro de domínios selecionados (ou todos)
    const dominiosSelecionados = dominios && dominios.length > 0
      ? dominios
      : Object.keys(ENTIDADES_BACKUP);

    const metadados = {
      gerado_em: new Date().toISOString(),
      gerado_por: user.email,
      empresa_id: empresa_id || 'todas',
      periodo: { data_inicio: data_inicio || null, data_fim: data_fim || null },
      dominios: dominiosSelecionados,
      versao: '2.0'
    };

    const zipFiles = [];
    const resumo = {};
    const todosLinks = [];
    let totalRegistros = 0;

    // Processar cada domínio
    for (const dominio of dominiosSelecionados) {
      const entidades = ENTIDADES_BACKUP[dominio] || [];
      const dominioData = {};

      for (const entityName of entidades) {
        try {
          let registros = await base44.asServiceRole.entities[entityName].list('-created_date', 2000);

          // Filtro por empresa_id (se o campo existir)
          if (empresa_id) {
            registros = registros.filter(r =>
              !r.empresa_id || r.empresa_id === empresa_id
            );
          }

          // Filtro por período (created_date)
          if (data_inicio || data_fim) {
            registros = registros.filter(r => {
              const d = r.created_date ? new Date(r.created_date) : null;
              if (!d) return true;
              if (data_inicio && d < new Date(data_inicio)) return false;
              if (data_fim && d > new Date(data_fim + 'T23:59:59')) return false;
              return true;
            });
          }

          if (registros.length > 0) {
            // Marcar entityName para extração de links
            const comMarca = registros.map(r => ({ ...r, _entityName: entityName }));
            todosLinks.push(...extrairLinks(comMarca));

            // Remover _entityName do dado exportado
            dominioData[entityName] = registros;
            totalRegistros += registros.length;
          }
        } catch (e) {
          console.warn(`Aviso ${entityName}:`, e.message);
        }
      }

      if (Object.keys(dominioData).length > 0) {
        resumo[dominio] = Object.fromEntries(
          Object.entries(dominioData).map(([k, v]) => [k, v.length])
        );
        // Um arquivo JSON por domínio dentro do ZIP
        zipFiles.push({
          name: `dados/${dominio}.json`,
          data: uint8(JSON.stringify(dominioData, null, 2))
        });
      }
    }

    // Arquivo de links de mídia/arquivos
    if (todosLinks.length > 0) {
      zipFiles.push({
        name: 'arquivos/links_arquivos.json',
        data: uint8(JSON.stringify(todosLinks, null, 2))
      });
    }

    // Manifesto
    const manifesto = {
      ...metadados,
      resumo,
      total_registros: totalRegistros,
      total_links_arquivos: todosLinks.length,
      duration_ms: Date.now() - startTime
    };
    zipFiles.push({
      name: 'manifesto.json',
      data: uint8(JSON.stringify(manifesto, null, 2))
    });

    // Montar ZIP
    const zipBytes = buildZip(zipFiles);

    const dataStr = new Date().toISOString().split('T')[0];
    const nomeArquivo = `backup-operacional-${dataStr}.zip`;

    return new Response(zipBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
        'X-Backup-Records': String(totalRegistros),
        'X-Backup-Files': String(zipFiles.length),
        'X-Backup-Duration': String(Date.now() - startTime),
      }
    });

  } catch (error) {
    console.error('Erro no backup operacional:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
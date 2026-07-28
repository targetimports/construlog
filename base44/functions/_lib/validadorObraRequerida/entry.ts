/**
 * VALIDADOR DE OBRA REQUERIDA
 * Bloqueia qualquer criação de entidade crítica sem obraId
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const ENTIDADES_CRITICAS = [
  'SolicitacaoCompra', 'Cotacao', 'OrdemCompra', 'RecebimentoMaterial',
  'MovimentacaoEstoque', 'NotaFiscal', 'ContaFinanceira', 'Medicao',
  'ApontamentoHoras', 'UsoEquipamento', 'LogAuditoriaSistema'
];

export async function validarObraRequerida(payload, entidade, obraId) {
  if (!ENTIDADES_CRITICAS.includes(entidade)) {
    return { valido: true }; // Entidade não crítica
  }

  const obraIdPayload = obraId || payload?.obra_id || payload?.obraId;

  if (!obraIdPayload || obraIdPayload.toString().trim() === '') {
    return {
      valido: false,
      codigo: 'OBRA_REQUERIDA',
      mensagem: `A entidade "${entidade}" requer uma Obra vinculada. Por favor, selecione uma obra antes de continuar.`,
      detalhe: `Campo obrigatório: obraId`
    };
  }

  return { valido: true, obraId: obraIdPayload };
}

export async function buscarRegistrosOrfaos(entidade) {
  try {
    const base44 = createClientFromRequest(new Request('http://dummy'));
    
    // Buscar registros sem obraId em entidade crítica
    const registros = await base44.entities[entidade].filter({});
    
    const orfaos = registros.filter(r => !r.obra_id && !r.obraId);
    
    return {
      entidade,
      total: registros.length,
      orfaos: orfaos.map(r => ({
        id: r.id,
        descricao: r.descricao || r.nome || r.titulo || `ID: ${r.id}`,
        dataCriacao: r.created_date,
        criadoPor: r.created_by
      }))
    };
  } catch (error) {
    console.error(`Erro ao buscar órfãos em ${entidade}:`, error);
    return { entidade, total: 0, orfaos: [], erro: error.message };
  }
}

export async function registrarAuditoria(base44, {
  entidade,
  entidadeId,
  operacao,
  obraId,
  dadosAntes,
  dadosDepois,
  usuarioId,
  funcaoOrigem,
  ipOrigem
}) {
  try {
    await base44.entities.LogAuditoriaSistema.create({
      entidade,
      entidade_id: entidadeId,
      operacao,
      obra_id: obraId,
      dados_antes: dadosAntes || null,
      dados_depois: dadosDepois || null,
      usuario_id: usuarioId,
      data_hora: new Date().toISOString(),
      origem_funcao: funcaoOrigem,
      ip_origem: ipOrigem || 'unknown',
      campos_alterados: dadosAntes && dadosDepois 
        ? Object.keys(dadosDepois).filter(k => dadosAntes[k] !== dadosDepois[k])
        : []
    });
    return { sucesso: true };
  } catch (error) {
    console.error('Erro ao registrar auditoria:', error);
    return { sucesso: false, erro: error.message };
  }
}
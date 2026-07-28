import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const ENTIDADES_CRITICAS = [
  'SolicitacaoCompra', 'OrdemCompra', 'RecebimentoMaterial',
  'MovimentacaoEstoque', 'NotaFiscal', 'ContaFinanceira', 'Medicao',
  'ApontamentoHoras'
];

export async function validarObraObrigatoria(entidade, payload) {
  if (!ENTIDADES_CRITICAS.includes(entidade)) {
    return { valido: true };
  }

  const obraId = payload?.obra_id || payload?.obraId;

  if (!obraId || obraId.toString().trim() === '') {
    return {
      valido: false,
      codigo: 400,
      mensagem: `A entidade "${entidade}" requer uma Obra vinculada. Selecione uma obra antes de continuar.`,
      campo: 'obra_id'
    };
  }

  return { valido: true, obraId };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ erro: 'Método não permitido' }, { status: 405 });
  }

  try {
    const { entidade, payload } = await req.json();
    const resultado = await validarObraObrigatoria(entidade, payload);
    return Response.json(resultado);
  } catch (error) {
    return Response.json({
      valido: false,
      erro: error.message
    }, { status: 500 });
  }
});
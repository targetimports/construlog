import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Cria CSV do template
    const csv = `codigo,descricao,unidade,preco_unitario,categoria_servico,tipo_obra,observacoes
001,Placa de obra em chapa aço galvanizado,un,379.21,mobilizacao,edificacao,SINAPI 12/2025
002,Escavação de solo compactado,m3,45.50,materiais,infraestrutura,Conforme especificação
003,Mão de obra pedreiro,dia,250.00,mao_obra,edificacao,Jornada de 8 horas`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const file = new File([blob], 'template_composicoes.csv', { type: 'text/csv' });

    // Upload do template
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    return Response.json({ file_url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { medicao_id } = await req.json();

    if (!medicao_id) {
      return Response.json({ error: 'medicao_id é obrigatório' }, { status: 400 });
    }

    // Buscar medição
    const medicao = await base44.entities.Medicao.get(medicao_id);
    if (!medicao) {
      return Response.json({ error: 'Medição não encontrada' }, { status: 404 });
    }

    // Buscar contrato vinculado
    const contrato = await base44.entities.Contrato.get(medicao.contrato_id);
    if (!contrato) {
      return Response.json({ error: 'Contrato vinculado não encontrado' }, { status: 404 });
    }

    // Buscar obra
    const obra = await base44.entities.Obra.get(medicao.obra_id);

    // Buscar fornecedor
    const fornecedor = await base44.entities.Fornecedor.get(contrato.fornecedor_id);

    // Gerar HTML do boletim
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Boletim de Medição</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0; font-size: 12px; color: #666; }
    .section { margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; }
    .section-title { font-weight: bold; background-color: #f0f0f0; padding: 10px; margin: -15px -15px 10px -15px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    table th, table td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    table th { background-color: #f0f0f0; font-weight: bold; }
    .row-label { font-weight: bold; width: 30%; }
    .row-value { width: 70%; }
    .highlight { background-color: #ffffcc; }
    .total-row { font-weight: bold; background-color: #f0f0f0; }
    .footer { margin-top: 30px; font-size: 11px; color: #666; text-align: center; }
    .status-badge { display: inline-block; padding: 4px 8px; border-radius: 3px; font-weight: bold; }
    .status-aprovada { background-color: #90EE90; color: #000; }
    .status-pendente { background-color: #FFD700; color: #000; }
    .assinatura { margin-top: 40px; display: flex; justify-content: space-around; }
    .assinatura-box { text-align: center; width: 30%; }
    .linha-assinatura { border-top: 1px solid #000; margin-top: 50px; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>BOLETIM DE MEDIÇÃO</h1>
    <p>Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
  </div>

  <div class="section">
    <div class="section-title">IDENTIFICAÇÃO DA MEDIÇÃO</div>
    <table>
      <tr>
        <td class="row-label">Número da Medição:</td>
        <td class="row-value">${medicao.numero || 'N/A'}</td>
      </tr>
      <tr>
        <td class="row-label">Data da Medição:</td>
        <td class="row-value">${new Date(medicao.data_medicao).toLocaleDateString('pt-BR')}</td>
      </tr>
      <tr>
        <td class="row-label">Status:</td>
        <td class="row-value">
          <span class="status-badge ${medicao.status === 'aprovada' ? 'status-aprovada' : 'status-pendente'}">
            ${medicao.status.toUpperCase()}
          </span>
        </td>
      </tr>
      <tr>
        <td class="row-label">Responsável:</td>
        <td class="row-value">${medicao.responsavel_email || 'N/A'}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">DADOS DO CONTRATO</div>
    <table>
      <tr>
        <td class="row-label">Número:</td>
        <td class="row-value">${contrato.numero}</td>
      </tr>
      <tr>
        <td class="row-label">Título:</td>
        <td class="row-value">${contrato.titulo || 'N/A'}</td>
      </tr>
      <tr>
        <td class="row-label">Tipo:</td>
        <td class="row-value">${contrato.tipo}</td>
      </tr>
      <tr>
        <td class="row-label">Contratado:</td>
        <td class="row-value">${fornecedor?.nome || contrato.contratado || 'N/A'}</td>
      </tr>
      <tr>
        <td class="row-label">Valor Total do Contrato:</td>
        <td class="row-value highlight">R$ ${(contrato.valor_total || 0).toFixed(2).replace('.', ',')}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">DADOS DA OBRA</div>
    <table>
      <tr>
        <td class="row-label">Obra:</td>
        <td class="row-value">${obra?.nome || medicao.obra_id}</td>
      </tr>
      <tr>
        <td class="row-label">Localização:</td>
        <td class="row-value">${obra?.endereco || 'N/A'}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">VALORES DA MEDIÇÃO</div>
    <table>
      <tr>
        <td class="row-label">Valor Total (Bruto):</td>
        <td class="row-value">R$ ${(medicao.valor_total_realizado || 0).toFixed(2).replace('.', ',')}</td>
      </tr>
      <tr>
        <td class="row-label">Retenções (%):</td>
        <td class="row-value">${(medicao.retencoes_percentual || 0).toFixed(2)}%</td>
      </tr>
      <tr>
        <td class="row-label total-row">Valor Líquido:</td>
        <td class="row-value total-row highlight">R$ ${(medicao.valor_liquido || 0).toFixed(2).replace('.', ',')}</td>
      </tr>
      <tr>
        <td class="row-label">Percentual do Contrato Realizado:</td>
        <td class="row-value highlight">${((medicao.valor_liquido / contrato.valor_total) * 100).toFixed(2)}%</td>
      </tr>
    </table>
  </div>

  ${medicao.status === 'aprovada' ? `
  <div class="section">
    <div class="section-title">APROVAÇÃO</div>
    <table>
      <tr>
        <td class="row-label">Aprovado por:</td>
        <td class="row-value">${medicao.aprovado_por || 'N/A'}</td>
      </tr>
      <tr>
        <td class="row-label">Data de Aprovação:</td>
        <td class="row-value">${medicao.data_aprovacao ? new Date(medicao.data_aprovacao).toLocaleDateString('pt-BR') : 'N/A'}</td>
      </tr>
    </table>
  </div>
  ` : ''}

  ${medicao.observacoes ? `
  <div class="section">
    <div class="section-title">OBSERVAÇÕES</div>
    <p>${medicao.observacoes}</p>
  </div>
  ` : ''}

  <div class="assinatura">
    <div class="assinatura-box">
      <div class="linha-assinatura"></div>
      <p>Responsável pela Medição</p>
    </div>
    <div class="assinatura-box">
      <div class="linha-assinatura"></div>
      <p>Fiscal do Contrato</p>
    </div>
    <div class="assinatura-box">
      <div class="linha-assinatura"></div>
      <p>Gestor da Obra</p>
    </div>
  </div>

  <div class="footer">
    <p>Este boletim foi gerado automaticamente pelo sistema ERP Construlog.</p>
    <p>Documento gerado em ${new Date().toLocaleString('pt-BR')}</p>
  </div>
</body>
</html>
    `;

    // Fazer upload do HTML como PDF
    const htmlBase64 = btoa(html);

    // Log
    await base44.entities.LogAuditoria.create({
      function_name: 'exportarBoletimMedicao',
      user_email: user.email,
      user_role: user.role,
      payload: JSON.stringify({ medicao_id }),
      result: 'success',
      timestamp: new Date().toISOString(),
      metadata: {
        medicao_id,
        contrato_id: medicao.contrato_id,
        tipo_exportacao: 'boletim_html'
      }
    });

    return Response.json({
      success: true,
      html,
      resumo: {
        medicao_numero: medicao.numero,
        contrato_numero: contrato.numero,
        valor_liquido: medicao.valor_liquido,
        status: medicao.status
      }
    });

  } catch (error) {
    console.error('Erro ao exportar boletim:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
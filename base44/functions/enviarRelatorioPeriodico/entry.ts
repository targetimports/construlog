import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDF from 'npm:jspdf@2.5.1';

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(d) {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '—';
}

function deveEnviar(rel, agora) {
  const { frequencia, dia_semana, dia_mes, hora_envio } = rel;
  if (!hora_envio) return true; // sem horário = envia sempre

  const [h, m] = (hora_envio || '08:00').split(':').map(Number);
  const horaOk = agora.getHours() === h;
  if (!horaOk) return false;

  if (frequencia === 'diaria') return true;
  if (frequencia === 'semanal') return agora.getDay() === (dia_semana ?? 1);
  if (frequencia === 'mensal') return agora.getDate() === (dia_mes ?? 1);
  return false;
}

// ─── Seções de dados por tipo ─────────────────────────────────────────────
async function coletarDados(tipos, obraIds, base44) {
  const secoes = [];

  for (const tipo of tipos) {
    if (tipo === 'resumo_orcamento' || tipo === 'progresso_obra') {
      const filtro = obraIds?.length ? {} : {};
      let obras = await base44.asServiceRole.entities.Obra.list('-updated_date', 50);
      if (obraIds?.length) obras = obras.filter(o => obraIds.includes(o.id));

      const linhas = obras.map(o => ({
        nome: o.nome || '—',
        status: o.status || '—',
        orcado: fmtBRL(o.total_orcamento || o.total_final_orcamento || 0),
        realizado: fmtBRL(o.total_gasto || 0),
        progresso: `${o.percentual_concluido || 0}%`,
      }));

      secoes.push({
        titulo: tipo === 'resumo_orcamento' ? 'Resumo de Orçamento' : 'Progresso de Obras',
        colunas: ['Obra', 'Status', 'Orçado', 'Realizado', 'Progresso'],
        linhas: linhas.map(l => [l.nome, l.status, l.orcado, l.realizado, l.progresso]),
        total: `${obras.length} obra(s)`
      });
    }

    if (tipo === 'financeiro') {
      const pagar = await base44.asServiceRole.entities.LancamentoCustoObra.list('-created_date', 30);
      const receber = await base44.asServiceRole.entities.LancamentoReceitaObra.list('-created_date', 30);
      const totalPagar = pagar.reduce((s, l) => s + (l.valor || 0), 0);
      const totalReceber = receber.reduce((s, l) => s + (l.valor || 0), 0);
      secoes.push({
        titulo: 'Financeiro',
        colunas: ['Indicador', 'Valor'],
        linhas: [
          ['Total a Pagar (últimos lançamentos)', fmtBRL(totalPagar)],
          ['Total a Receber (últimos lançamentos)', fmtBRL(totalReceber)],
          ['Saldo Previsto', fmtBRL(totalReceber - totalPagar)],
        ],
        total: ''
      });
    }

    if (tipo === 'medicoes') {
      const medicoes = await base44.asServiceRole.entities.Medicao.list('-created_date', 30);
      const linhas = medicoes.slice(0, 20).map(m => [
        m.descricao || m.titulo || '—',
        m.status || '—',
        fmtBRL(m.valor_total || m.valor || 0),
        fmtData(m.data_medicao || m.created_date),
      ]);
      secoes.push({
        titulo: 'Medições',
        colunas: ['Descrição', 'Status', 'Valor', 'Data'],
        linhas,
        total: `${medicoes.length} medição(ões)`
      });
    }

    if (tipo === 'estoque') {
      const saldos = await base44.asServiceRole.entities.SaldoEstoque.list('-updated_date', 30);
      const linhas = saldos.slice(0, 20).map(s => [
        s.material_nome || s.insumo_nome || '—',
        String(s.saldo_atual || 0),
        s.unidade || '—',
        fmtData(s.updated_date),
      ]);
      secoes.push({
        titulo: 'Estoque',
        colunas: ['Material', 'Saldo', 'Unidade', 'Atualizado'],
        linhas,
        total: `${saldos.length} item(ns)`
      });
    }

    if (tipo === 'frota') {
      const viagens = await base44.asServiceRole.entities.Viagem.list('-created_date', 30);
      const km = viagens.reduce((s, v) => s + (v.km_percorrido || 0), 0);
      secoes.push({
        titulo: 'Frota',
        colunas: ['Indicador', 'Valor'],
        linhas: [
          ['Total de viagens', String(viagens.length)],
          ['KM total percorrido', `${km.toLocaleString('pt-BR')} km`],
        ],
        total: ''
      });
    }

    if (tipo === 'rh') {
      const apontamentos = await base44.asServiceRole.entities.ApontamentoHora.list('-created_date', 30);
      const horas = apontamentos.reduce((s, a) => s + (a.horas || 0), 0);
      secoes.push({
        titulo: 'RH & Mão de Obra',
        colunas: ['Indicador', 'Valor'],
        linhas: [
          ['Apontamentos (período)', String(apontamentos.length)],
          ['Total de horas apontadas', `${horas.toFixed(1)}h`],
        ],
        total: ''
      });
    }
  }

  return secoes;
}

// ─── Gerar PDF como base64 ───────────────────────────────────────────────────
function gerarPDF(nomeRelatorio, secoes, dataGeracao) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 14;
  let y = 20;

  // Cabeçalho
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(nomeRelatorio, margin, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em ${dataGeracao}`, margin, 22);
  y = 38;

  for (const secao of secoes) {
    if (y > 250) { doc.addPage(); y = 20; }

    // Título da seção
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, y - 4, pageW - margin * 2, 10, 'F');
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(secao.titulo, margin + 2, y + 3);
    if (secao.total) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text(secao.total, pageW - margin - doc.getTextWidth(secao.total), y + 3);
    }
    y += 12;

    // Cabeçalho tabela
    const colW = (pageW - margin * 2) / secao.colunas.length;
    doc.setFillColor(219, 234, 254);
    doc.rect(margin, y - 4, pageW - margin * 2, 8, 'F');
    doc.setTextColor(37, 99, 235);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    secao.colunas.forEach((col, i) => doc.text(col, margin + i * colW + 1, y + 1));
    y += 7;

    // Linhas
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    secao.linhas.forEach((linha, rowIdx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      if (rowIdx % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, y - 4, pageW - margin * 2, 7, 'F');
      }
      linha.forEach((cell, i) => {
        const txt = String(cell || '').substring(0, 30);
        doc.text(txt, margin + i * colW + 1, y + 1);
      });
      y += 7;
    });
    y += 6;
  }

  // Rodapé
  doc.setTextColor(156, 163, 175);
  doc.setFontSize(8);
  doc.text('Relatório gerado automaticamente pelo sistema ERP', margin, 290);

  return doc.output('datauristring').split(',')[1]; // base64
}

// ─── Montar HTML do e-mail ───────────────────────────────────────────────────
function montarEmailHtml(nomeRelatorio, secoes, dataGeracao) {
  const secoesHtml = secoes.map(secao => {
    const headerCols = secao.colunas.map(c => `<th style="padding:8px 10px;background:#2563EB;color:white;text-align:left;font-size:12px">${c}</th>`).join('');
    const bodyRows = secao.linhas.map((linha, i) => {
      const bg = i % 2 === 0 ? '#f9fafb' : '#ffffff';
      const cols = linha.map(c => `<td style="padding:7px 10px;font-size:12px;border-bottom:1px solid #e5e7eb">${c || '—'}</td>`).join('');
      return `<tr style="background:${bg}">${cols}</tr>`;
    }).join('');
    return `
      <div style="margin-bottom:24px">
        <h3 style="margin:0 0 8px 0;font-size:14px;color:#1e3a8a;border-bottom:2px solid #2563EB;padding-bottom:4px">${secao.titulo}${secao.total ? ` <span style="font-size:11px;color:#6b7280;font-weight:normal">(${secao.total})</span>` : ''}</h3>
        <table style="width:100%;border-collapse:collapse;border-radius:6px;overflow:hidden">
          <thead><tr>${headerCols}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>`;
  }).join('');

  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:700px;margin:0 auto;background:#f8fafc;padding:0">
      <div style="background:linear-gradient(135deg,#1e3a8a,#2563EB);padding:28px 32px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;color:white;font-size:20px">📊 ${nomeRelatorio}</h1>
        <p style="margin:8px 0 0 0;color:#bfdbfe;font-size:13px">Gerado automaticamente em ${dataGeracao}</p>
      </div>
      <div style="background:white;padding:28px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
        ${secoesHtml}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
        <p style="font-size:11px;color:#9ca3af;text-align:center;margin:0">
          Este é um relatório automático. Para mais detalhes acesse o sistema ERP.
        </p>
      </div>
    </div>`;
}

// ─── Handler principal ───────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: admins ou chamada interna (sem usuário = automação)
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (user && user.role !== 'admin' && user.role !== 'programador') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const { relatorio_id, force } = payload;

    const agora = new Date();
    const dataGeracao = agora.toLocaleString('pt-BR');

    // Buscar relatórios
    let relatorios;
    if (relatorio_id) {
      const r = await base44.asServiceRole.entities.RelatorioAgendado.filter({ id: relatorio_id });
      relatorios = r;
    } else {
      relatorios = await base44.asServiceRole.entities.RelatorioAgendado.filter({ ativo: true });
    }

    let emailsEnviados = 0;
    let erros = [];

    for (const rel of relatorios) {
      // Verificar se é hora de enviar (ou force=true)
      if (!force && !deveEnviar(rel, agora)) continue;

      const tipos = rel.tipos || (rel.tipo ? [rel.tipo] : ['resumo_orcamento']);

      // Coletar dados
      const secoes = await coletarDados(tipos, rel.obra_ids, base44);
      if (secoes.length === 0) continue;

      // Gerar PDF
      const pdfBase64 = gerarPDF(rel.nome, secoes, dataGeracao);

      // Enviar para cada destinatário
      const destinatarios = rel.destinatarios || [];
      for (const email of destinatarios) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: email,
            subject: `📊 ${rel.nome} - ${agora.toLocaleDateString('pt-BR')}`,
            body: montarEmailHtml(rel.nome, secoes, dataGeracao)
          });
          emailsEnviados++;
        } catch (e) {
          erros.push(`Erro email ${email}: ${e.message}`);
          console.error('Erro email:', e);
        }
      }

      // Atualizar último envio
      await base44.asServiceRole.entities.RelatorioAgendado.update(rel.id, {
        ultimo_envio: agora.toISOString()
      });
    }

    return Response.json({
      sucesso: true,
      relatorios_processados: relatorios.length,
      emails_enviados: emailsEnviados,
      erros: erros.length > 0 ? erros : undefined,
      timestamp: agora.toISOString()
    });

  } catch (error) {
    console.error('Erro enviarRelatorioPeriodico:', error);
    return Response.json({ sucesso: false, error: error.message }, { status: 500 });
  }
});
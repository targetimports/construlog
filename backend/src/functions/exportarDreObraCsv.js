import getDreObra from './getDreObra.js';

// Exporta a DRE da obra em CSV (base64). Reusa o cálculo de getDreObra.
export default async function exportarDreObraCsv({ body, user }) {
  const dre = await getDreObra({ body, user });
  if (dre.error) return dre;

  const cell = (x) => `"${String(x).replace(/"/g, '""')}"`;
  const linhas = [
    ['DRE por Obra'],
    ['Receita Prevista', dre.receita_prevista.toFixed(2)],
    ['Receita Realizada', dre.receita_realizada.toFixed(2)],
    ['Total de Custos', dre.custos.total_custos.toFixed(2)],
    ['Margem Bruta', dre.margem_bruta.toFixed(2)],
    ['Margem %', dre.margem_percentual.toFixed(2)],
    [],
    ['Categoria', 'Grupo', 'Total'],
    ...dre.breakdown_por_categoria.map((c) => [c.categoria_nome, c.grupo, c.total.toFixed(2)]),
  ];
  // Propaga avisos de qualidade (ex.: possível dupla contagem de custos) para o CSV,
  // igual ao que a tela mostra — quem só abre o arquivo não perde o alerta.
  if (Array.isArray(dre.warnings) && dre.warnings.length) {
    linhas.push([], ['Avisos'], ...dre.warnings.map((w) => [w]));
  }
  const csv = '﻿' + linhas.map((l) => l.map(cell).join(';')).join('\n');

  return { csv_base64: Buffer.from(csv, 'utf8').toString('base64'), filename: `dre_obra_${body?.obra_id || ''}.csv` };
}

// GERAÇÃO AUTOMÁTICA DAS MENSALIDADES.
//
// Todo mês, para cada cliente que deve pagar, cria a Cobranca da competência.
// Antes isso dependia de alguém abrir o painel e clicar em "Gerar mensalidades";
// esquecer significava não cobrar — e, pior, os avisos de vencimento também não
// saem, porque eles agem sobre cobranças que existem. Cobrança que ninguém lançou
// é receita que ninguém recebe.
//
// As regras são as MESMAS da geração manual (a prévia na tela de Cobranças):
//   - fora: contrato cancelado ou suspenso
//   - fora: cliente em teste (salvo COBRANCA_INCLUIR_TESTE=true)
//   - fora: quem já tem cobrança não cancelada na competência
//   - fora: mensalidade zerada — geraria fatura de R$ 0,00
//
// Idempotente: pode rodar mil vezes no mesmo dia sem duplicar, porque a checagem
// de "já tem cobrança nesta competência" vem antes de criar.

import { store } from './entityStore.js';

const INCLUIR_TESTE = String(process.env.COBRANCA_INCLUIR_TESTE || '').toLowerCase() === 'true';

// Dia do mês em que a geração roda. Padrão 1: a competência nasce no começo do
// mês, dando margem para o aviso prévio sair antes do vencimento.
const DIA_GERACAO = Math.min(28, Math.max(1, Number(process.env.COBRANCA_DIA_GERACAO || 1)));

const competenciaAtual = () => new Date().toISOString().slice(0, 7);
const diaDeHoje = () => new Date().getDate();

/**
 * Gera as mensalidades da competência informada (padrão: o mês corrente).
 * `forcar` ignora a checagem de dia — usado no disparo manual.
 */
export async function gerarMensalidades({ competencia, forcar = false } = {}) {
  const comp = competencia || competenciaAtual();

  if (!/^\d{4}-\d{2}$/.test(comp)) {
    return { ok: false, motivo: 'competencia_invalida' };
  }
  // Competência futura geraria cobrança que ninguém deve ainda — e o aviso de
  // vencimento sairia meses antes. Só o mês corrente (ou anterior, para acertar
  // um mês esquecido).
  if (comp > competenciaAtual()) {
    return { ok: false, motivo: 'competencia_futura', competencia: comp };
  }

  if (!forcar && diaDeHoje() < DIA_GERACAO) {
    return { ok: true, motivo: 'ainda_nao_e_o_dia', dia_geracao: DIA_GERACAO };
  }

  const [clientes, cobrancas] = await Promise.all([
    store.filter('ClienteSaaS', {}, null, 500).catch(() => []),
    store.filter('Cobranca', {}, '-vencimento', 2000).catch(() => []),
  ]);

  const jaTem = new Set(
    cobrancas.filter((c) => c.competencia === comp && c.status !== 'cancelado').map((c) => c.cliente_id),
  );

  const criadas = [];
  const fora = { cancelado: 0, suspenso: 0, teste: 0, ja_lancada: 0, sem_valor: 0 };

  for (const cli of clientes) {
    if (cli.status === 'cancelado') { fora.cancelado += 1; continue; }
    if (cli.status === 'suspenso') { fora.suspenso += 1; continue; }
    if (cli.status === 'teste' && !INCLUIR_TESTE) { fora.teste += 1; continue; }
    if (jaTem.has(cli.id)) { fora.ja_lancada += 1; continue; }

    const valor = Number(cli.valor_mensal) || 0;
    if (valor <= 0) { fora.sem_valor += 1; continue; }

    const dia = String(Math.min(28, Number(cli.dia_vencimento) || 10)).padStart(2, '0');
    await store.create('Cobranca', {
      cliente_id: cli.id,
      cliente_nome: cli.nome,
      competencia: comp,
      vencimento: `${comp}-${dia}`,
      valor,
      status: 'pendente',
      // Marca a origem: numa conferência, saber o que o sistema lançou sozinho
      // e o que alguém lançou à mão evita discussão.
      origem: 'automatica',
    });
    criadas.push({ cliente: cli.nome, valor, vencimento: `${comp}-${dia}` });
  }

  if (criadas.length) {
    console.log('[cobranca-mensal] %s: %d cobrança(s) gerada(s) — %s',
      comp, criadas.length, criadas.map((c) => c.cliente).join(', '));
  }

  return { ok: true, competencia: comp, criadas: criadas.length, detalhe: criadas, fora };
}

/** Chamada pelo agendador: roda uma vez por dia, no máximo. */
let ultimaTentativa = '';
export async function gerarMensalidadesSeForDia() {
  const hoje = new Date().toISOString().slice(0, 10);
  if (ultimaTentativa === hoje) return { ok: true, motivo: 'ja_rodou_hoje' };
  ultimaTentativa = hoje;
  return gerarMensalidades();
}

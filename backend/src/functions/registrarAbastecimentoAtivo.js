import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { isGlobal } from '../middleware.js';

// ABASTECIMENTO de veículo/máquina.
//
// Diferente do uso do ativo (que é RATEIO interno — ver frotaCore.js), combustível é
// uma DESPESA REAL com terceiro: alguém abastece no posto e a nota tem de ser paga.
// Por isso aqui SIM nasce uma ContaFinanceira a pagar, com o posto como fornecedor.
//
// A quem pertence o custo: à obra onde o ativo está operando no momento (o empréstimo
// em aberto), e por consequência à empresa daquela obra — "o custo segue quem usou",
// a mesma regra da mão de obra e da frota. Sem obra (ativo no pátio), a despesa fica
// na Matriz, sem obra_id.
const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;
const hoje = () => new Date().toISOString().slice(0, 10);

export default async function registrarAbastecimentoAtivo({ body, user }) {
  requirePermission(user, 'EQUIPAMENTOS_VIEW');

  const {
    ativo_id, data, medidor, litros, valor_litro, valor_total,
    combustivel, posto, fornecedor_id, nota_fiscal, observacao,
    fotos = [], obra_id: obraInformada, tanque_cheio,
  } = body || {};

  if (!ativo_id) return { success: false, error: 'Selecione o veículo/máquina.' };
  const litrosN = num(litros);
  if (litrosN <= 0) return { success: false, error: 'Informe a quantidade de litros.' };

  const ativo = (await store.filter('Ativo', { id: ativo_id }))[0];
  if (!ativo) return { success: false, error: 'Ativo não encontrado' };

  // Valor: aceita (litros × preço) ou o total da bomba. Um completa o outro.
  let total = num(valor_total);
  let precoLitro = num(valor_litro);
  if (total <= 0 && precoLitro > 0) total = r2(litrosN * precoLitro);
  if (precoLitro <= 0 && total > 0) precoLitro = r2(total / litrosN);
  if (total <= 0) return { success: false, error: 'Informe o valor por litro ou o valor total.' };

  const ehVeiculo = /veiculo|carro|moto|caminh/.test(String(ativo.tipo || '').toLowerCase());
  const medidorTipo = ehVeiculo ? 'km' : 'horimetro';
  const medidorAtual = ehVeiculo ? num(ativo.km_atual) : num(ativo.horimetro_atual);
  const medidorN = num(medidor);

  // Medidor só anda para a frente. Aceita igual (abastecimento no mesmo dia, sem rodar),
  // mas menor é quase sempre erro de digitação — e estragaria o consumo calculado.
  if (medidorN > 0 && medidorN < medidorAtual) {
    return {
      success: false,
      error: `A leitura informada (${medidorN}) é menor que a atual do ativo (${medidorAtual} ${ehVeiculo ? 'km' : 'h'}). Confira o painel.`,
    };
  }

  // Obra: a informada, senão a do empréstimo em aberto, senão a que consta no ativo.
  let obraId = obraInformada || null;
  if (!obraId) {
    const emAberto = (await store.filter('EmprestimoAtivo', { ativo_id }, '-created_date', 1000).catch(() => []))
      .find((e) => e.status === 'em_uso');
    obraId = emAberto?.obra_id || ativo.obra_atual_id || null;
  }
  const obra = obraId ? (await store.filter('Obra', { id: obraId }))[0] : null;

  // Consumo desde o último abastecimento (km/l ou l/h) — é o número que denuncia
  // desvio de combustível e problema mecânico. Só faz sentido com os dois medidores.
  const anteriores = (await store.filter('Abastecimento', { ativo_id }, '-data', 1000).catch(() => []))
    .filter((a) => num(a.medidor) > 0)
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  const ultimo = anteriores[0];
  let consumo = null, percorrido = null;
  if (ultimo && medidorN > num(ultimo.medidor)) {
    percorrido = r2(medidorN - num(ultimo.medidor));
    // Veículo: km rodados por litro. Máquina: litros gastos por hora trabalhada.
    consumo = ehVeiculo ? r2(percorrido / litrosN) : r2(litrosN / percorrido);
  }

  const dataAbast = data || hoje();

  // APROVAÇÃO: quem lança na obra (encarregado, almoxarife) NÃO cria despesa sozinho —
  // fica PENDENTE até o responsável da Matriz conferir em /Ativos. Quem já é da Matriz
  // (global) lança e aprova no mesmo ato, senão criaríamos uma fila para o próprio
  // aprovador se autoaprovar. A conta a pagar só nasce na aprovação.
  const jaAprovado = isGlobal(user);
  const abastecimento = await store.create('Abastecimento', {
    ativo_id,
    ativo_nome: ativo.nome || ativo.codigo || null,
    ativo_placa: ativo.placa || null,
    data: dataAbast,
    medidor: medidorN || medidorAtual,
    medidor_tipo: medidorTipo,
    litros: r2(litrosN),
    valor_litro: precoLitro,
    valor_total: total,
    combustivel: combustivel || null,
    tanque_cheio: !!tanque_cheio,
    posto: posto || null,
    fornecedor_id: fornecedor_id || null,
    nota_fiscal: nota_fiscal || null,
    observacao: observacao || null,
    fotos: Array.isArray(fotos) ? fotos.filter(Boolean) : [],
    obra_id: obraId || null,
    obra_nome: obra?.nome || null,
    consumo,                 // km/l (veículo) ou l/h (máquina)
    distancia_percorrida: percorrido,
    status: jaAprovado ? 'APROVADO' : 'PENDENTE',
    registrado_por: user?.email || null,
  }, user?.email || null);

  // Medidor do ativo acompanha a leitura da bomba, mesmo antes da aprovação: é a
  // leitura física mais recente que temos, e o próximo consumo depende dela.
  if (medidorN > medidorAtual) {
    await store.update('Ativo', ativo_id, ehVeiculo ? { km_atual: medidorN } : { horimetro_atual: medidorN }).catch(() => {});
  }

  let conta = null;
  if (jaAprovado) conta = await gerarContaDoAbastecimento(abastecimento, user);

  return {
    success: true,
    abastecimento_id: abastecimento.id,
    status: jaAprovado ? 'APROVADO' : 'PENDENTE',
    conta_financeira_id: conta?.id || null,
    valor_total: total,
    valor_litro: precoLitro,
    consumo,
    unidade_consumo: ehVeiculo ? 'km/l' : 'l/h',
    obra_id: obraId,
    obra_nome: obra?.nome || null,
  };
}

/**
 * Cria a conta a pagar do posto a partir de um abastecimento aprovado.
 * Fica aqui (e não na função de aprovar) para os dois caminhos — lançamento direto
 * pela Matriz e aprovação de um lançamento da obra — gerarem exatamente a mesma conta.
 */
export async function gerarContaDoAbastecimento(ab, user) {
  const dataFmt = String(ab.data || '').split('-').reverse().join('/');
  const descricao = `Abastecimento ${ab.ativo_nome || 'ativo'}${ab.ativo_placa ? ` (${ab.ativo_placa})` : ''} — ${ab.litros} L${ab.posto ? ` · ${ab.posto}` : ''} em ${dataFmt}`;

  const conta = await store.create('ContaFinanceira', {
    tipo: 'pagar',
    obra_id: ab.obra_id || null,
    obra_nome: ab.obra_nome || null,
    descricao,
    categoria: 'Combustível',
    valor: num(ab.valor_total),
    status: 'pendente',
    data_vencimento: ab.data,
    fornecedor_cliente: ab.posto || 'Posto de combustível',
    fornecedor_id: ab.fornecedor_id || null,
    numero_documento: ab.nota_fiscal || null,
    referencia_tipo: 'Abastecimento',
    referencia_id: ab.id,
  }, user?.email || null);

  await store.update('Abastecimento', ab.id, { conta_financeira_id: conta.id }).catch(() => {});
  return conta;
}

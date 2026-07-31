// SEPARAÇÃO ENTRE CUSTO E VENDA NO ORÇAMENTO.
//
// O problema que este módulo resolve: a planilha do OrçaFácil traz o preço em
// duas naturezas — o custo do serviço e o preço cobrado do cliente (custo + BDI)
// — mas a importação gravava o MESMO número nos dois campos do ItemOrcamento.
// Com custo == venda, a margem do orçamento dava 0% e não havia contra o que
// comparar o custo real depois: sem custo previsto, medir avanço não produz
// "o que isto deveria ter custado", e desvio nenhum existe.
//
// A tela /Orcamentos já tinha as colunas "Custo Unit." e "Valor Unit." e já
// calculava margem: ela nasceu esperando esta distinção. Aqui não se inventa
// semântica nova, restaura-se a pretendida.
//
// COMO O CUSTO É DESCOBERTO, em ordem de confiança:
//
//   1. Duas colunas na planilha ("P. Unit." e "P. Unit. c/ BDI").
//      Caso ideal: o custo está escrito, não se deduz nada.
//
//   2. Uma coluna só + BDI conhecido. Aqui é preciso descobrir se essa coluna
//      já embute o BDI ou não — errar inverte custo e venda. Em vez de confiar
//      no rótulo do cabeçalho (que varia de escritório para escritório),
//      COMPARAMOS a soma da coluna com a soma da venda: se a venda é ~(1+BDI)
//      vezes maior, a coluna é o custo; se são praticamente iguais, a coluna já
//      é a venda e o custo sai por divisão. É uma verificação que a própria
//      planilha responde.
//
//   3. Sem BDI e sem segunda coluna: o custo é desconhecido. Devolvemos null e
//      o importador mantém o comportamento antigo. Nunca chutamos uma margem —
//      um custo inventado é pior que custo em branco, porque parece confiável.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Tolerância ao comparar somas. A planilha arredonda cada linha, então a soma
// nunca bate no centavo; 2% acomoda o arredondamento sem confundir "tem BDI"
// (tipicamente 20–30% de diferença) com "não tem".
const TOLERANCIA = 0.02;

/**
 * Preço de venda unitário de um item da planilha.
 *
 * Preferimos derivar de total/qtd, e não ler a coluna de preço, porque é o
 * total que soma o Total Geral do orçamento — e é assim que
 * gerarContratoDoOrcamento já monta o contrato. Ler a coluna unitária criaria
 * uma segunda verdade, e qtd × preço deixaria de bater com o total.
 */
export function vendaUnitaria(item) {
  const qtd = num(item?.quantidade ?? item?.qtd);
  const total = num(item?.total ?? item?.valor_total);
  if (qtd > 0 && total > 0) return total / qtd;
  // Últimos recursos, na ordem em que os parsers nomeiam o campo. `custo_unitario`
  // entra por último porque só aparece em payloads antigos, onde ele era o preço.
  return num(item?.valor_unit_bdi) || num(item?.valor_unit) || num(item?.valor_unitario)
    || num(item?.preco_unit) || num(item?.custo_unitario);
}

/**
 * Decide, para o orçamento inteiro, de onde sai o custo.
 *
 * A decisão é do CONJUNTO, não linha a linha: uma planilha tem um layout só, e
 * decidir por item deixaria itens vizinhos com critérios diferentes — pior,
 * itens com valores atípicos cairiam no ramo errado.
 *
 * @returns {{modo: string, bdi: number, fator: number, explicacao: string}}
 */
export function detectarModoCusto(itens, meta = {}) {
  const folhas = (itens || []).filter((it) => !it.is_grupo);
  const bdi = num(meta.bdi_percent ?? meta.bdiPercent ?? meta.percentualBDI ?? meta.bdi_percentual);
  const fator = 1 + bdi / 100;

  // A planilha trouxe a coluna "c/ BDI" preenchida e maior que a coluna de
  // custo? Então as duas naturezas estão escritas e não há o que deduzir.
  const temDuasColunas = folhas.some(
    (it) => num(it.valor_unit_bdi) > 0 && num(it.valor_unit) > 0 && num(it.valor_unit_bdi) > num(it.valor_unit),
  );
  if (temDuasColunas) {
    return { modo: 'colunas', bdi, fator, explicacao: 'planilha traz preço unitário com e sem BDI' };
  }

  if (bdi <= 0) {
    return { modo: 'indisponivel', bdi: 0, fator: 1, explicacao: 'planilha sem BDI e sem coluna de custo' };
  }

  // Uma coluna só. Ela é custo ou já é venda? A razão entre a venda somada e a
  // coluna somada responde: ~(1+BDI) significa que a coluna está sem BDI.
  let somaColuna = 0;
  let somaVenda = 0;
  for (const it of folhas) {
    const qtd = num(it.quantidade ?? it.qtd);
    somaColuna += qtd * num(it.valor_unit);
    somaVenda += qtd * vendaUnitaria(it);
  }

  if (somaColuna > 0 && somaVenda > 0) {
    const razao = somaVenda / somaColuna;
    if (Math.abs(razao - fator) <= TOLERANCIA * fator) {
      return {
        modo: 'coluna_sem_bdi',
        bdi,
        fator,
        explicacao: `coluna unitária confere como custo (venda ÷ coluna = ${razao.toFixed(3)} ≈ BDI ${bdi}%)`,
      };
    }
    if (Math.abs(razao - 1) <= TOLERANCIA) {
      return {
        modo: 'derivado_bdi',
        bdi,
        fator,
        explicacao: `coluna unitária já é a venda; custo derivado do BDI ${bdi}%`,
      };
    }
    // Nem uma coisa nem outra: layout fora do previsto. Derivar do BDI é a
    // escolha conservadora — mantém venda ÷ custo = 1+BDI, que é a única
    // relação que a planilha afirma explicitamente.
    return {
      modo: 'derivado_bdi',
      bdi,
      fator,
      explicacao: `razão inesperada (${razao.toFixed(3)}); custo derivado do BDI ${bdi}%`,
    };
  }

  return { modo: 'derivado_bdi', bdi, fator, explicacao: `sem coluna unitária; custo derivado do BDI ${bdi}%` };
}

/**
 * Custo unitário de um item, dado o modo já decidido para a planilha.
 * Devolve null quando o custo é desconhecido — o chamador decide o que fazer.
 */
export function custoUnitario(item, modo) {
  const venda = vendaUnitaria(item);
  switch (modo?.modo) {
    case 'colunas': {
      const c = num(item.valor_unit);
      // Item sem a coluna preenchida no meio de uma planilha que a tem:
      // cai no BDI para não deixar buraco na linha-base.
      if (c > 0) return c;
      return modo.fator > 1 && venda > 0 ? venda / modo.fator : null;
    }
    case 'coluna_sem_bdi': {
      const c = num(item.valor_unit);
      return c > 0 ? c : (venda > 0 ? venda / modo.fator : null);
    }
    case 'derivado_bdi':
      return venda > 0 ? venda / modo.fator : null;
    default:
      return null;
  }
}

/**
 * Aplica a decisão ao orçamento inteiro.
 *
 * Devolve os valores prontos para gravar, sem tocar no banco: quem persiste é o
 * importador. Assim esta regra fica testável isoladamente e reutilizável por
 * outros caminhos de entrada (planilha manual da ObraForm, por exemplo).
 */
export function calcularCustoVenda(itens, meta = {}) {
  const modo = detectarModoCusto(itens, meta);
  let totalCusto = 0;
  let totalVenda = 0;
  // A margem só pode ser calculada sobre o que tem os DOIS lados. Dividir um
  // custo parcial pela venda inteira inventa lucro: uma planilha sem custo
  // nenhum apareceria com 100% de margem.
  let vendaComCusto = 0;
  let comCusto = 0;
  let semCusto = 0;

  const resultado = (itens || []).map((it) => {
    const qtd = num(it.quantidade ?? it.qtd);
    const venda = vendaUnitaria(it);
    const custo = it.is_grupo ? null : custoUnitario(it, modo);

    if (!it.is_grupo) {
      totalVenda += venda * qtd;
      if (custo != null) {
        totalCusto += custo * qtd;
        vendaComCusto += venda * qtd;
        comCusto += 1;
      } else {
        semCusto += 1;
      }
    }

    return {
      ...it,
      venda_unit: r2(venda),
      venda_total: r2(venda * qtd),
      custo_unit: custo == null ? null : r2(custo),
      custo_total_calc: custo == null ? null : r2(custo * qtd),
    };
  });

  const margem = vendaComCusto > 0 ? ((vendaComCusto - totalCusto) / vendaComCusto) * 100 : null;
  return {
    itens: resultado,
    modo,
    resumo: {
      total_venda: r2(totalVenda),
      total_custo: r2(totalCusto),
      // null quando não há custo em lugar nenhum — a tela mostra "—", não 0%.
      margem_percentual: margem == null ? null : Math.round(margem * 100) / 100,
      itens_com_custo: comCusto,
      itens_sem_custo: semCusto,
      // Quanto da venda tem custo conhecido. Abaixo de 100% a margem acima é
      // real, mas parcial — e a tela precisa dizer isso.
      cobertura_percentual: totalVenda > 0 ? Math.round((vendaComCusto / totalVenda) * 10000) / 100 : 0,
    },
  };
}

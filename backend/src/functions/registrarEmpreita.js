import { store } from '../entityStore.js';
import { podeEditarObra } from '../rbac.js';

// ATALHO: "REGISTRAR EMPREITA" — a porta que fala a língua do cliente.
//
// Para ele, empreita é "um acordo com o profissional por um valor fechado" (ex.:
// R$ 10.000 para levantar o bloco A). No sistema, isso É um contrato de empreitada
// medido — que já existe, já trava saldo (aprovarMedicaoContrato) e já gera a conta
// a pagar. Faltava só a entrada: ninguém no canteiro pensa "vou cadastrar um
// contrato", e o cadastro de contrato ainda pede número, tipo e contratado.
//
// IMPORTANTE — isto NÃO é um segundo caminho de pagamento. É a MESMA mecânica com
// outra porta: cria o Contrato e para. O dinheiro continua saindo só pelo Medir.
// Dois mecanismos de pagamento em paralelo, cada um com seu controle de saldo,
// deixariam o contrato ser pago acima do valor combinado.
const num = (v) => Number(v) || 0;

export default async function registrarEmpreita({ body, user }) {
  const { terceirizado_id, obra_id, servico, valor, data_inicio, data_fim_prevista } = body || {};
  if (!terceirizado_id || !obra_id) {
    throw Object.assign(new Error('Profissional e obra são obrigatórios.'), { status: 400 });
  }
  if (num(valor) <= 0) {
    throw Object.assign(new Error('Informe o valor fechado da empreita.'), { status: 400 });
  }

  const obra = (await store.filter('Obra', { id: obra_id }))[0];
  if (!obra) throw Object.assign(new Error('Obra não encontrada.'), { status: 404 });
  if (!podeEditarObra(user, obra)) {
    throw Object.assign(new Error('Apenas responsáveis pela obra (ou Admin/TI/Financeiro) podem registrar empreita nela.'), { status: 403 });
  }

  const prof = (await store.filter('ProfissionalTerceirizado', { id: terceirizado_id }))[0];
  if (!prof) throw Object.assign(new Error('Profissional não encontrado.'), { status: 404 });

  // Numeração automática: o cliente não tem que inventar número de contrato para
  // fechar uma empreita. EMP-<ano>-<sequência>.
  const ano = new Date().toISOString().slice(0, 4);
  const existentes = (await store.filter('Contrato', {}, undefined, 5000)) || [];
  const seq = existentes.filter((c) => String(c.numero || '').startsWith(`EMP-${ano}-`)).length + 1;
  const numero = `EMP-${ano}-${String(seq).padStart(3, '0')}`;

  const contrato = await store.create('Contrato', {
    numero,
    titulo: servico?.trim() || `Empreita — ${prof.nome}`,
    tipo: 'empreitada',
    obra_id,
    empresa_id: obra.empresa_id || prof.empresa_id || null,
    contratado_tipo: 'terceirizado',
    fornecedor_id: terceirizado_id,
    contratado_nome: prof.nome,
    valor_inicial: num(valor),
    valor_total: num(valor),
    data_assinatura: data_inicio || new Date().toISOString().split('T')[0],
    data_inicio: data_inicio || new Date().toISOString().split('T')[0],
    data_fim_prevista: data_fim_prevista || null,
    status: 'ativo',
    observacoes: 'Empreita registrada pelo cadastro do profissional terceirizado.',
  }, user?.email || null);

  return {
    success: true,
    contrato_id: contrato.id,
    numero,
    obra_nome: obra.nome,
    valor: num(valor),
    // A tela usa isto para mandar o usuário ao lugar certo de cobrar/pagar.
    proximo_passo: 'Para pagar, use "Medir" no contrato (Obra → Orçamento & Contratos → Contratos).',
  };
}

import { store } from '../entityStore.js';
import { can } from '../rbac.js';

// ORDEM DE SERVIÇO do empréstimo — o comprovante de entrega do ativo.
// Junta, num pacote só: dados do ativo, da obra, do empréstimo (período, tarifa),
// a vistoria de SAÍDA (medidor, checklist, fotos) e a ASSINATURA de quem recebeu.
// Usada pela tela e pelo PDF. SÓ LEITURA.
export default async function getOrdemServicoEmprestimo({ body, user }) {
  if (!can(user, 'EQUIPAMENTOS_VIEW') && !can(user, 'OBRAS_VIEW')) {
    throw Object.assign(new Error('Sem permissão.'), { status: 403 });
  }
  const { emprestimo_id } = body || {};
  if (!emprestimo_id) throw Object.assign(new Error('emprestimo_id é obrigatório'), { status: 400 });

  const emp = (await store.filter('EmprestimoAtivo', { id: emprestimo_id }))[0];
  if (!emp) throw Object.assign(new Error('Empréstimo não encontrado'), { status: 404 });

  const [ativo] = emp.ativo_id ? await store.filter('Ativo', { id: emp.ativo_id }) : [];
  const [obra] = emp.obra_id ? await store.filter('Obra', { id: emp.obra_id }) : [];
  const [empresa] = emp.empresa_id ? await store.filter('Empresa', { id: emp.empresa_id }) : [];
  const vistorias = (await store.filter('Vistoria', { emprestimo_id })) || [];

  return {
    success: true,
    os: {
      numero: emp.os_numero || null,
      emitida_em: emp.os_emitida_em || null,
      emprestimo_numero: emp.numero,
      status: emp.status,
      solicitante: emp.solicitante || null,
      aprovador: emp.aprovador || null,
      motivo: emp.motivo || null,
      data_saida: emp.data_saida || null,
      data_prevista_retorno: emp.data_prevista_retorno || null,
      data_retorno: emp.data_retorno || null,
      medidor_tipo: emp.medidor_tipo,
      medidor_saida: emp.medidor_saida ?? null,
      medidor_retorno: emp.medidor_retorno ?? null,
      tarifa_tipo: emp.tarifa_tipo, tarifa_valor: emp.tarifa_valor,
      uso_calculado: emp.uso_calculado ?? null, custo_total: emp.custo_total ?? null,
    },
    ativo: ativo ? {
      nome: ativo.nome, codigo: ativo.codigo, tipo: ativo.tipo,
      marca: ativo.marca, modelo: ativo.modelo, ano: ativo.ano, placa: ativo.placa,
    } : null,
    obra: obra ? { nome: obra.nome, endereco: obra.endereco, cidade: obra.cidade, estado: obra.estado } : null,
    empresa: empresa ? { nome: empresa.nome, cnpj: empresa.cnpj, logo_url: empresa.logo_url } : null,
    vistoria_saida: vistorias.find((v) => v.tipo === 'SAIDA') || null,
    vistoria_entrada: vistorias.find((v) => v.tipo === 'ENTRADA') || null,
  };
}

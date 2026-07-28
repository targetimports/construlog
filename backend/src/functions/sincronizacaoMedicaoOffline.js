import { store } from '../entityStore.js';

// Sincroniza medições criadas/editadas offline (componentes de campo) para o
// servidor. Cria ou atualiza entidades Medicao, devolvendo um resumo por item.

export default async function sincronizacaoMedicaoOffline({ body, user }) {
  const { medicacoesPendentes = [] } = body || {};
  const resultados = { sucesso: [], erros: [], avisos: [] };

  for (const med of medicacoesPendentes) {
    try {
      if (!med.obra_id || !med.numero || !med.itens) {
        resultados.erros.push({ medicacao: med.numero, motivo: 'Dados incompletos' });
        continue;
      }
      if (med.id) {
        await store.update('Medicao', med.id, {
          ...med,
          data_sincronizacao: new Date().toISOString(),
          sincronizado_offline: false
        });
        resultados.sucesso.push({ medicacao: med.numero, acao: 'atualizada', id: med.id });
      } else {
        const criada = await store.create('Medicao', {
          ...med,
          data_sincronizacao: new Date().toISOString(),
          status: 'rascunho'
        }, user?.email || null);
        resultados.sucesso.push({ medicacao: med.numero, acao: 'criada', id: criada.id });
      }
    } catch (erro) {
      resultados.erros.push({ medicacao: med.numero, motivo: erro.message });
    }
  }

  const log = {
    usuario: user?.email,
    data_sincronizacao: new Date().toISOString(),
    total_processadas: medicacoesPendentes.length,
    total_sucesso: resultados.sucesso.length,
    total_erros: resultados.erros.length
  };

  return { sucesso: resultados.sucesso.length === medicacoesPendentes.length, resultados, log };
}

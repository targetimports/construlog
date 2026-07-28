import { store } from '../entityStore.js';

// Importa clientes em lote a partir de linhas já parseadas no frontend (planilha Orça Fácil).
// O frontend faz o parse do xlsx e envia { rows: [...] } (saída de sheet_to_json).
const pick = (row, keys) => {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== '') return String(row[k]).trim();
  }
  return '';
};

const soDigitos = (s) => String(s || '').replace(/\D/g, '');

export default async function importarClientesOrcaFacil({ body, user }) {
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (!rows.length) return { success: false, mensagem: 'Nenhuma linha recebida do arquivo' };

  // Dedupe POR DOCUMENTO: carrega os CNPJ/CPF já cadastrados uma vez. Linhas
  // cujo documento já existe são puladas (não duplica). O mesmo Set também
  // evita duplicar dentro da própria planilha.
  const existentes = await store.filter('Cliente', {}, null, 100000).catch(() => []);
  const docsExistentes = new Set();
  for (const c of (existentes || [])) {
    const d = soDigitos(c.cnpj_cpf);
    if (d.length >= 11) docsExistentes.add(d);
  }

  let clientesImportados = 0;
  let jaExistentes = 0;
  const erros = [];

  for (const row of rows) {
    try {
      const cliente = {
        nome: pick(row, ['Nome', 'Cliente', 'Contratante', 'NOME', 'nome']),
        cnpj_cpf: pick(row, ['CNPJ', 'CPF', 'CNPJ/CPF', 'CNPJ/CPF ', 'Cnpj', 'Cpf']),
        email: pick(row, ['Email', 'E-mail', 'EMAIL', 'email']),
        telefone: pick(row, ['Telefone', 'Celular', 'Fone', 'telefone']),
        endereco: pick(row, ['Endereço', 'Endereco', 'Logradouro']),
        bairro: pick(row, ['Bairro']),
        cep: pick(row, ['CEP', 'Cep', 'cep']),
        cidade: pick(row, ['Cidade', 'Município', 'Municipio']),
        estado: pick(row, ['Estado', 'UF', 'Uf']),
        status: 'ativo',
      };
      if (!cliente.nome) { erros.push('Linha sem nome do cliente'); continue; }

      // Documento já cadastrado → não duplica (mantém o existente).
      const doc = soDigitos(cliente.cnpj_cpf);
      if (doc.length >= 11 && docsExistentes.has(doc)) {
        jaExistentes++;
        continue;
      }

      await store.create('Cliente', cliente, user?.email || null);
      if (doc.length >= 11) docsExistentes.add(doc);
      clientesImportados++;
    } catch (err) {
      erros.push(`Erro na linha: ${err.message}`);
    }
  }

  return {
    success: true,
    clientesImportados,
    jaExistentes,
    erros: erros.length ? erros : null,
    mensagem:
      `${clientesImportados} cliente(s) importado(s)` +
      (jaExistentes ? `, ${jaExistentes} já existente(s) por documento (ignorado)` : '') +
      '.',
  };
}

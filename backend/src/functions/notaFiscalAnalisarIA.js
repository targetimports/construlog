import { store } from '../entityStore.js';
import { extractData, llmAvailable } from '../llm.js';

const num = (v) => Number(v) || 0;

// Tenta extrair os dados da NF via IA (PDF/imagem). Se a IA não estiver
// configurada ou falhar, devolve a NF como está para preenchimento manual.
export default async function notaFiscalAnalisarIA({ body }) {
  const { documento_fiscal_id } = body || {};
  const arr = await store.filter('NotaFiscal', { id: documento_fiscal_id }, undefined, 1);
  let nf = arr[0];
  if (!nf) throw Object.assign(new Error('Documento fiscal não encontrado.'), { status: 404 });

  if (llmAvailable() && nf.arquivo_url) {
    try {
      const schema = {
        type: 'object',
        properties: {
          numero: { type: 'string' },
          chave_acesso: { type: 'string' },
          emissor_nome: { type: 'string' },
          emissor_cnpj: { type: 'string' },
          data_emissao: { type: 'string', description: 'AAAA-MM-DD' },
          valor_total: { type: 'number' },
          valor_desconto: { type: 'number' },
          valor_frete: { type: 'number' },
          valor_outros: { type: 'number' },
        },
      };
      const out = await extractData({
        file_url: nf.arquivo_url,
        json_schema: schema,
        prompt: 'Extraia os dados desta nota fiscal / documento fiscal brasileiro.',
      });
      const d = out?.output || {};
      const patch = {
        numero: d.numero || nf.numero,
        chave_acesso: d.chave_acesso || nf.chave_acesso,
        emissor_nome: d.emissor_nome || nf.emissor_nome,
        emissor_cnpj: d.emissor_cnpj || nf.emissor_cnpj,
        data_emissao: d.data_emissao || nf.data_emissao,
        valor_total: num(d.valor_total) || num(nf.valor_total),
        valor_desconto: num(d.valor_desconto) || num(nf.valor_desconto),
        valor_frete: num(d.valor_frete) || num(nf.valor_frete),
        valor_outros: num(d.valor_outros) || num(nf.valor_outros),
      };
      patch.valor_final_ajustado = patch.valor_total - patch.valor_desconto + patch.valor_frete + patch.valor_outros;
      nf = await store.update('NotaFiscal', documento_fiscal_id, patch);
    } catch {
      // IA indisponível/falhou — segue para preenchimento manual
    }
  }

  return { nf };
}

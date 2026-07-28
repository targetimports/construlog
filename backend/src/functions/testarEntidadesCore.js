import { store } from '../entityStore.js';

// Suite de teste (Ferramentas Admin): cada entidade essencial está acessível
// (tabela existe e responde a leitura). Verifica migrações/schema dos módulos centrais.
const CORE = ['Obra', 'Insumo', 'Colaborador', 'Medicao', 'ContaFinanceira', 'Fornecedor', 'OrdemCompra', 'Empresa'];

export default async function testarEntidadesCore({ user }) {
  if (!user) throw Object.assign(new Error('Login necessário'), { status: 401 });
  if (user.role !== 'admin' && user.role !== 'programador') {
    throw Object.assign(new Error('Apenas admin/programador'), { status: 403 });
  }

  const t0 = Date.now();
  const results = [];
  for (const ent of CORE) {
    try {
      const amostra = await store.filter(ent, {}, '-created_date', 1);
      results.push({ test: ent, status: 'PASS', message: `Tabela acessível (amostra: ${amostra.length}).` });
    } catch (e) {
      results.push({ test: ent, status: 'FAIL', message: e.message });
    }
  }

  const passCount = results.filter((r) => r.status === 'PASS').length;
  return {
    resumo: `${passCount}/${results.length} entidades OK`,
    all_passed: passCount === results.length,
    elapsed_ms: Date.now() - t0,
    executado_por: user.email,
    executado_em: new Date().toISOString(),
    results,
  };
}

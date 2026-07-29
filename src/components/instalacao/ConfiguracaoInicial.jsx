import { useState } from 'react';
import { Building2, Plus, Trash2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

// CONFIGURAÇÃO INICIAL — o primeiro acesso de uma instalação nova.
//
// Substitui os dados de exemplo que o sistema criava sozinho. Aqui o cliente
// informa a empresa dele, e é disso que sai a estrutura toda: matriz, caixa,
// estoque central e o nome que aparece no sistema.
//
// Só o nome é obrigatório. O resto se completa depois em Configurações — pedir
// CNPJ e endereço agora só atrasaria quem quer começar a usar.

const VAZIO = {
  nome: '', razao_social: '', cnpj: '', email: '', telefone: '',
  endereco: '', nome_sistema: '',
};

export default function ConfiguracaoInicial({ onPronto }) {
  const [form, setForm] = useState(VAZIO);
  const [empresas, setEmpresas] = useState([]);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErros((e) => (e[k] ? { ...e, [k]: null } : e));
  };

  const validar = () => {
    const e = {};
    if (!form.nome.trim()) e.nome = 'Informe o nome da empresa (ou do grupo)';
    // Empresa sem nome viraria uma linha fantasma na lista — barra antes.
    empresas.forEach((emp, i) => {
      if (!String(emp.nome || '').trim()) e[`empresa_${i}`] = 'Informe o nome ou remova a linha';
    });
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const salvar = async () => {
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    setSalvando(true);
    try {
      await base44.api('/instalacao/configurar', {
        method: 'POST',
        body: { ...form, empresas: empresas.filter((e) => String(e.nome || '').trim()) },
      });
      toast.success('Tudo pronto! Bem-vindo ao sistema.');
      onPronto?.();
    } catch (err) {
      toast.error('Não foi possível concluir: ' + (err?.message || 'tente novamente'));
      setSalvando(false);
    }
  };

  const campo = (chave, rotulo, extras = {}) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{rotulo}</label>
      <input
        {...extras}
        value={form[chave]}
        onChange={(e) => set(chave, e.target.value)}
        className={`w-full h-11 rounded-lg border px-3 text-sm outline-none transition
          focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
          ${erros[chave] ? 'border-red-400' : 'border-gray-300'}`}
      />
      {erros[chave] && <p className="text-xs text-red-500 mt-1">{erros[chave]}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex items-start sm:items-center justify-center p-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="grid place-items-center w-11 h-11 rounded-xl bg-blue-600 text-white shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Configuração inicial</h1>
            <p className="text-sm text-gray-500">
              Vamos cadastrar sua empresa. Isso é feito uma única vez.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
          <div className="p-5 sm:p-6 space-y-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Empresa principal
            </p>
            {campo('nome', 'Nome da empresa ou do grupo *', { placeholder: 'Ex: Grupo Alvorada' })}
            <div className="grid sm:grid-cols-2 gap-4">
              {campo('razao_social', 'Razão social', { placeholder: 'Alvorada Participações Ltda' })}
              {campo('cnpj', 'CNPJ', { placeholder: '00.000.000/0001-00' })}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {campo('email', 'E-mail de contato', { type: 'email', placeholder: 'contato@empresa.com.br' })}
              {campo('telefone', 'Telefone', { placeholder: '(00) 00000-0000' })}
            </div>
            {campo('endereco', 'Endereço', { placeholder: 'Rua, número, bairro, cidade' })}
            {campo('nome_sistema', 'Nome exibido no sistema', { placeholder: 'Em branco, usa o nome da empresa' })}
          </div>

          <div className="p-5 sm:p-6 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Outras empresas do grupo
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Opcional. Se você opera com uma empresa só, pode pular — dá para
                  adicionar depois.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEmpresas((e) => [...e, { nome: '', cnpj: '' }])}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>

            {empresas.map((emp, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 grid sm:grid-cols-2 gap-2">
                  <div>
                    <input
                      value={emp.nome}
                      onChange={(e) => setEmpresas((lista) => lista.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
                      placeholder="Nome da empresa"
                      className={`w-full h-11 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${
                        erros[`empresa_${i}`] ? 'border-red-400' : 'border-gray-300'
                      }`}
                    />
                    {erros[`empresa_${i}`] && <p className="text-xs text-red-500 mt-1">{erros[`empresa_${i}`]}</p>}
                  </div>
                  <input
                    value={emp.cnpj}
                    onChange={(e) => setEmpresas((lista) => lista.map((x, j) => (j === i ? { ...x, cnpj: e.target.value } : x)))}
                    placeholder="CNPJ (opcional)"
                    className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setEmpresas((lista) => lista.filter((_, j) => j !== i))}
                  className="h-11 px-2 text-gray-400 hover:text-red-500"
                  aria-label="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-gray-500">
              Criaremos o caixa e o estoque central da empresa — tudo zerado, pronto
              para você começar.
            </p>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {salvando ? 'Configurando...' : 'Concluir'}
              {!salvando && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

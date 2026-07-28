// Máscaras pt-BR centralizadas (raiz única do sistema).
// Usadas pela prop `mask` do <Input> (src/components/ui/input.jsx) e onde precisar
// aplicar/parsear manualmente. Máscaras de string (cpf/cnpj/telefone/cep) formatam
// e armazenam o texto já formatado; parsers abaixo extraem só dígitos/número quando
// for preciso validar ou salvar cru.

export const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');

// CPF: 000.000.000-00
export const maskCPF = (v) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
};

// CNPJ: 00.000.000/0000-00
export const maskCNPJ = (v) => {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length > 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length > 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  if (d.length > 5) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length > 2) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return d;
};

// CPF ou CNPJ conforme a quantidade de dígitos.
export const maskCpfCnpj = (v) => (onlyDigits(v).length > 11 ? maskCNPJ(v) : maskCPF(v));

// Telefone: (00) 00000-0000 (celular) ou (00) 0000-0000 (fixo)
export const maskTelefone = (v) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

// CEP: 00000-000
export const maskCEP = (v) => {
  const d = onlyDigits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

// Linha digitável de boleto:
//  - Bancário (47 díg.): AAAAA.AAAAA BBBBB.BBBBBB CCCCC.CCCCCC D EEEEEEEEEEEEEE
//  - Arrecadação/concessionária (começa com 8, 48 díg.): 4 grupos de 12.
export const maskLinhaDigitavel = (v) => {
  const d = onlyDigits(v);
  if (d[0] === '8') {
    return d.slice(0, 48).replace(/(\d{12})(?=\d)/g, '$1 ').trim();
  }
  const x = d.slice(0, 47);
  let out = x.slice(0, 5);
  if (x.length > 5) out += `.${x.slice(5, 10)}`;
  if (x.length > 10) out += ` ${x.slice(10, 15)}`;
  if (x.length > 15) out += `.${x.slice(15, 21)}`;
  if (x.length > 21) out += ` ${x.slice(21, 26)}`;
  if (x.length > 26) out += `.${x.slice(26, 32)}`;
  if (x.length > 32) out += ` ${x.slice(32, 33)}`;
  if (x.length > 33) out += ` ${x.slice(33, 47)}`;
  return out;
};

// Número/valor pt-BR: milhar "." · decimal "," (ex.: 1.502,01). maxDec = casas decimais.
export const maskNumeroBR = (raw, maxDec = 2) => {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).replace(/[^\d,]/g, ''); // mantém dígitos e vírgula decimal
  if (s === '') return '';
  const i = s.indexOf(',');
  if (i === -1) return Number(s).toLocaleString('pt-BR');
  const intRaw = s.slice(0, i).replace(/,/g, '');
  const decRaw = s.slice(i + 1).replace(/,/g, '').slice(0, maxDec);
  const intFmt = intRaw === '' ? '0' : Number(intRaw).toLocaleString('pt-BR');
  return `${intFmt},${decRaw}`;
};

// Converte "1.502,01" -> 1502.01
export const parseNumeroBR = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

// Dispatcher usado pela prop `mask` do <Input>.
export const applyMask = (mask, value) => {
  switch (mask) {
    case 'cpf': return maskCPF(value);
    case 'cnpj': return maskCNPJ(value);
    case 'cpfcnpj':
    case 'cpf_cnpj': return maskCpfCnpj(value);
    case 'telefone':
    case 'celular':
    case 'phone': return maskTelefone(value);
    case 'cep': return maskCEP(value);
    case 'linhadigitavel':
    case 'linha_digitavel':
    case 'boleto': return maskLinhaDigitavel(value);
    case 'numero':
    case 'number': return maskNumeroBR(value, 3);
    case 'moeda':
    case 'valor':
    case 'currency': return maskNumeroBR(value, 2);
    default: return value;
  }
};

// Máscaras cujo valor é string formatada (seguras para passar direto no onChange do pai).
export const STRING_MASKS = new Set(['cpf', 'cnpj', 'cpfcnpj', 'cpf_cnpj', 'telefone', 'celular', 'phone', 'cep', 'linhadigitavel', 'linha_digitavel', 'boleto']);

/**
 * Analisa nome de orçamento e extrai dados da obra automaticamente
 * @param {string} nomeOrcamento - Nome do arquivo ou título da obra
 * @returns {Object} { municipio, estado, tipoPublica, categoria, categoriaTecnica, nomeSimplificado }
 */
export function parseNomeObra(nomeOrcamento) {
  if (!nomeOrcamento || typeof nomeOrcamento !== 'string') {
    return {
      municipio: '',
      estado: '',
      tipoPublica: false,
      categoria: '',
      categoriaTecnica: '',
      nomeSimplificado: ''
    };
  }

  const texto = nomeOrcamento.toUpperCase().trim();

  // 1. Extrair Município e Estado
  let municipio = '';
  let estado = '';

  // Padrão: "NO MUNICIPIO DE X/UF" ou "NO MUNICIPIO DE X, UF"
  const padraoBD = /NO MUNICIPIO DE\s+([A-ZÁÉÍÓÚÃÕÇa-záéíóúãõç\s\-]+)\s*\/\s*([A-Z]{2})/i;
  const matchBD = texto.match(padraoBD);
  
  if (matchBD) {
    municipio = matchBD[1].trim();
    estado = matchBD[2].trim();
  } else {
    // Padrão alternativo: "X/UF" (última ocorrência)
    const padraoSimples = /([A-ZÁÉÍÓÚÃÕÇa-záéíóúãõç\s\-]+)\s*\/\s*([A-Z]{2})(?!.*\/)/;
    const matchSimples = texto.match(padraoSimples);
    if (matchSimples) {
      municipio = matchSimples[1].trim();
      estado = matchSimples[2].trim();
    }
  }

  // 2. Detectar Tipo Público
  const tipoPublica = /\b(FNDE|PREFEITURA|MUNICÍPIO|MUNICIPIO)\b/.test(texto);
  const cliente = /\bFNDE\b/.test(texto) ? 'FNDE' : '';

  // 3. Detectar Categoria
  let categoria = '';
  if (/\bESCOLA\b/.test(texto)) {
    categoria = 'Educação';
  } else if (/\bHOSPITAL\b/.test(texto)) {
    categoria = 'Saúde';
  } else if (/\b(CENTRO DE SAÚ?DE|POLICLINICA|UNIDADE DE SAÚ?DE)\b/.test(texto)) {
    categoria = 'Saúde';
  }

  // 4. Detectar Categoria Técnica
  let categoriaTecnica = '';
  if (/\b(MURO|CONTENÇÃO|CONTENÇÃO EM MURO|ARRIMO)\b/.test(texto)) {
    categoriaTecnica = 'Infraestrutura';
  } else if (/\b(PAVIMENTAÇÃO|DRENAGEM|ASFALTO)\b/.test(texto)) {
    categoriaTecnica = 'Infraestrutura';
  } else if (/\b(PINTURA|REFORMA|REVITALIZAÇÃO)\b/.test(texto)) {
    categoriaTecnica = 'Reabilitação';
  }

  // 5. Gerar Nome Simplificado
  let nomeSimplificado = '';
  
  // Estratégia 1: Capturar primeira frase (até 60 caracteres)
  const primeiraParte = texto.substring(0, 60).trim();
  if (primeiraParte.length > 0) {
    nomeSimplificado = primeiraParte.replace(/\s+/g, ' ');
    // Se tiver mais texto, cortar no último espaço
    if (texto.length > 60) {
      const ultimoEspaco = nomeSimplificado.lastIndexOf(' ');
      if (ultimoEspaco > 20) {
        nomeSimplificado = nomeSimplificado.substring(0, ultimoEspaco);
      }
    }
  }

  // Estratégia 2: Se tiver municipio, criar nome mais compacto
  if (municipio && estado) {
    // Extrair primeira palavra significativa
    const palavrasSignificativas = texto
      .split(/\s+/)
      .filter(p => p.length > 3 && !['PELA', 'PARA', 'PELA', 'PELA', 'PELA'].includes(p))
      .slice(0, 3);
    
    if (palavrasSignificativas.length > 0) {
      const base = palavrasSignificativas.join(' ');
      nomeSimplificado = `${base} – ${municipio}/${estado}`.substring(0, 80);
    }
  }

  // Fallback: capitalizar primeira letra de cada palavra
  if (nomeSimplificado) {
    nomeSimplificado = nomeSimplificado
      .toLowerCase()
      .split(/\s+/)
      .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
      .join(' ');
  }

  return {
    municipio: municipio.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    estado,
    tipoPublica,
    categoria,
    categoriaTecnica,
    nomeSimplificado,
    cliente
  };
}
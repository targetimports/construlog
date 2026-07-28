/**
 * analisarTextoDaObra(texto: string) -> objeto
 * 
 * Parser inteligente que detecta automaticamente:
 * - Privada vs Pública
 * - Tipo estrutural
 * - Reforma vs Construção nova
 * - Centro de custo
 * - Categoria DRE
 */

// Normalizar texto: maiúsculo, sem acentos, espaços únicos
function normalizar(texto) {
  if (!texto) return '';
  return texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, ' ')            // Espaços únicos
    .trim();
}

// ===== PASSO 5: LOCALIZAÇÃO (CIDADE/ESTADO) =====
function extrairEstado(texto) {
  const normalizado = normalizar(texto);
  
  // Mapeamento completo de estados brasileiros
  const estadosMap = {
    'SAO PAULO': 'SP', 'MINAS GERAIS': 'MG', 'RIO DE JANEIRO': 'RJ',
    'BAHIA': 'BA', 'CEARA': 'CE', 'PERNAMBUCO': 'PE', 'PARAIBA': 'PB',
    'MARANHAO': 'MA', 'PARA': 'PA', 'AMAZONAS': 'AM', 'RORAIMA': 'RR',
    'RONDONIA': 'RO', 'ACRE': 'AC', 'DISTRITO FEDERAL': 'DF',
    'GOIAS': 'GO', 'MATO GROSSO': 'MT', 'MATO GROSSO DO SUL': 'MS',
    'SAO PAULO': 'SP', 'PARANA': 'PR', 'SANTA CATARINA': 'SC', 'RIO GRANDE DO SUL': 'RS',
    'ESPIRITO SANTO': 'ES', 'ALAGOAS': 'AL', 'PIAUI': 'PI', 'SERGIPE': 'SE',
    'TOCANTINS': 'TO', 'RIO GRANDE DO NORTE': 'RN'
  };
  
  // Padrão "MUNICIPIO DE X/BA" ou "MUNICIPIO DE X - BA"
  const m1 = normalizado.match(/MUNICIPIO\s+DE\s+[A-Z\s]+[\/\-]\s*([A-Z]{2})\b/);
  if (m1) return m1[1];
  
  // Padrão "X/BA" (qualquer coisa antes da barra)
  const m2 = normalizado.match(/\/([A-Z]{2})\b/);
  if (m2) return m2[1];
  
  // Padrão "X - BA" (com hífen)
  const m3 = normalizado.match(/\-\s*([A-Z]{2})\b/);
  if (m3) return m3[1];
  
  // Buscar nome de estado por extenso (ex: "BAHIA" -> "BA")
  for (const [estado, uf] of Object.entries(estadosMap)) {
    if (normalizado.includes(estado)) return uf;
  }
  
  return null;
}

function extrairMunicipio(texto) {
  const normalizado = normalizar(texto);
  
  // Padrão "MUNICIPIO DE X/BA" ou "MUNICIPIO DE X - BA"
  const m1 = normalizado.match(/MUNICIPIO\s+DE\s+([A-Z]+)[\/\-]/);
  if (m1) {
    return m1[1].trim().split(/\s+/)[0];
  }
  
  // Padrão "MUNICIPIO X" (sem "DE")
  const m2 = normalizado.match(/MUNICIPIO\s+([A-Z]+)/);
  if (m2) {
    return m2[1].trim().split(/\s+/)[0];
  }
  
  // Padrão "X/BA" ou "X - BA"
  const m3 = normalizado.match(/^([A-Z\s]+)[\/\-]/);
  if (m3) {
    return m3[1].trim().split(/\s+/)[0];
  }
  
  return null;
}

/**
 * Main parser
 */
export function analisarTextoDaObra(texto) {
  const normalizado = normalizar(texto);
  
  // ===== PASSO 2: NATUREZA (PRIVADA vs PÚBLICA) =====
  // Palavras que indicam projeto PÚBLICO
  const palavrasPublicas = [
    'FNDE', 'PREFEITURA', 'MUNICIPIO', 'SECRETARIA', 'GOVERNO', 'ESTADO',
    'CONVENIO', 'LICITACAO', 'ESCOLA MUNICIPAL', 'ESCOLA ESTADUAL', 'ESCOLA PUBLICA'
  ];
  
  // Palavras que indicam projeto PRIVADO
  const palavrasPrivadas = [
    'CONDOMINIO', 'RESIDENCIAL', 'CASA', 'APARTAMENTO', 'LOTEAMENTO',
    'EMPRESA', 'INDUSTRIAL', 'GALPAO', 'COMERCIAL', 'SHOPPING', 'HOTEL',
    'CLIENTE'
  ];
  
  let naturezaObra = 'INDEFINIDA';
  let clienteSugerido = null;
  let confiancaNatureza = 0;
  
  // Verificar PÚBLICO
  for (const palavra of palavrasPublicas) {
    if (normalizado.includes(palavra)) {
      naturezaObra = 'PUBLICA';
      confiancaNatureza = 0.95;
      
      // Identificar cliente específico (FNDE > PREFEITURA > GOVERNO)
      if (normalizado.includes('FNDE')) {
        clienteSugerido = 'FNDE';
      } else if (normalizado.includes('PREFEITURA') || normalizado.includes('MUNICIPIO')) {
        clienteSugerido = 'PREFEITURA';
      } else if (normalizado.includes('SECRETARIA')) {
        clienteSugerido = 'SECRETARIA';
      } else {
        clienteSugerido = 'GOVERNO';
      }
      break;
    }
  }
  
  // Se não detectou público, verificar PRIVADO
  if (naturezaObra === 'INDEFINIDA') {
    for (const palavra of palavrasPrivadas) {
      if (normalizado.includes(palavra)) {
        naturezaObra = 'PRIVADA';
        confiancaNatureza = 0.9;
        clienteSugerido = 'PARTICULAR';
        break;
      }
    }
  }
  
  // ===== PASSO 3: TIPO ESTRUTURAL (TÉCNICO) =====
  // Mapeamento por palavras-chave para identificar tipo técnico da obra
  const tiposEstruturais = {
    CONTENCAO: ['MURO', 'ARRIMO', 'CONTENCAO', 'GABIAO', 'TERRA ARMADA'],
    FUNDACAO: ['ESTACA', 'SAPATA', 'BLOCO', 'RADIER', 'FUNDACAO'],
    ESTRUTURA: ['PILAR', 'VIGA', 'LAJE', 'CONCRETO ARMADO'],
    ALVENARIA: ['ALVENARIA', 'BLOCO', 'TIJOLO', 'PEDRA ARGAMASSADA'],
    COBERTURA: ['TELHADO', 'TELHA', 'COBERTURA', 'ESTRUTURA METALICA'],
    ACABAMENTO: ['PISO', 'REVESTIMENTO', 'PINTURA', 'CERAMICA'],
    INSTALACOES: ['ELETRICA', 'HIDRAULICA', 'SANITARIA', 'SPDA'],
    PAVIMENTACAO: ['ASFALTO', 'PAVIMENTACAO', 'PISO INTERTRAVADO'],
    DRENAGEM: ['DRENAGEM', 'GALERIA', 'SARJETA', 'BUEIRO']
  };
  
  let tipoEstrutural = 'OUTRO';
  let confiancaEstrutural = 0;
  
  // Buscar tipo estrutural por palavras-chave
  for (const [tipo, palavras] of Object.entries(tiposEstruturais)) {
    for (const palavra of palavras) {
      if (normalizado.includes(palavra)) {
        tipoEstrutural = tipo;
        confiancaEstrutural = 0.85;
        break;
      }
    }
    if (tipoEstrutural !== 'OUTRO') break;
  }
  
  // ===== PASSO 4: TIPO INTERVENÇÃO (REFORMA vs CONSTRUÇÃO NOVA vs AMPLIAÇÃO) =====
  let tipoIntervencao = 'INDEFINIDA';
  let confiancaIntervencao = 0;
  
  if (/REFORMA|RECUPERACAO|MANUTENCAO|REVITALIZACAO/.test(normalizado)) {
    tipoIntervencao = 'REFORMA';
    confiancaIntervencao = 0.9;
  } else if (/CONSTRUCAO|IMPLANTACAO|EXECUCAO|CONSTRUIR|OBRA NOVA|NOVA/.test(normalizado)) {
    tipoIntervencao = 'CONSTRUCAO_NOVA';
    confiancaIntervencao = 0.9;
  } else if (/AMPLIACAO|EXPANSAO|ACRESCIMO/.test(normalizado)) {
    tipoIntervencao = 'AMPLIACAO';
    confiancaIntervencao = 0.9;
  }
  
  // ===== PASSO 5: LOCALIZAÇÃO (CIDADE/ESTADO) =====
  // Detecta padrões: "MUNICIPIO DE X/UF", "MUNICIPIO DE X - UF", "X/BAHIA" -> BA, "X/UF"
  const estado = extrairEstado(texto);
  const cidade = extrairMunicipio(texto);
  
  // ===== PASSO 7: CATEGORIA PARA DRE (bem simples) =====
  let categoriaDRE = 'OUTRO';
  let confiancaDRE = 0;
  
  if (/ESCOLA|CRECHE|FNDE/.test(normalizado)) {
    categoriaDRE = 'EDUCACAO';
    confiancaDRE = 0.9;
  } else if (/POSTO DE SAUDE|HOSPITAL|UBS/.test(normalizado)) {
    categoriaDRE = 'SAUDE';
    confiancaDRE = 0.9;
  } else if (/PAVIMENTACAO|DRENAGEM|PONTE|ESTRADA|CONTENCAO/.test(normalizado)) {
    categoriaDRE = 'INFRA';
    confiancaDRE = 0.9;
  } else if (/ESCRITORIO|ADMINISTRATIVO|SEDE/.test(normalizado)) {
    categoriaDRE = 'ADMINISTRATIVO';
    confiancaDRE = 0.85;
  }
  
  // ===== NOME SUGERIDO (simplificado) =====
  // Remove palavras genéricas
  let nomeSugerido = texto
    .replace(/MUNICÍPIO\s*(?:DE\s*)?/gi, '')
    .replace(/^\s*[-\/]\s*/g, '')
    .replace(/\/[A-Z]{2}$/g, '')
    .replace(/\s*\([^)]*\)/g, '')
    .trim();
  
  // Limitar a 100 caracteres
  if (nomeSugerido.length > 100) {
    nomeSugerido = nomeSugerido.substring(0, 97) + '...';
  }
  
  // ===== PASSO 6: CENTRO DE CUSTO AUTOMÁTICO =====
  // Nome: CC-{CIDADE}-{CATEGORIA_DRE}-{TIPO_ESTRUTURAL}
  // Código: OB-{ANO}-{SEQUENCIAL} (gerado no backend ao criar obra)
  const centroCustoNome = cidade && categoriaDRE
    ? `CC-${cidade}-${categoriaDRE}-${tipoEstrutural}`
    : null;
  
  return {
    nomeSugerido,
    cidade: cidade || null,
    estado: estado || null,
    naturezaObra,
    tipoEstrutural,
    tipoIntervencao,
    categoriaDRE,
    clienteSugerido,
    centroCustoNome,
    confianca: {
      natureza: confiancaNatureza,
      estrutural: confiancaEstrutural,
      intervencao: confiancaIntervencao,
      dre: confiancaDRE
    }
  };
}